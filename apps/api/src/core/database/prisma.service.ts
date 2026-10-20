import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Logger,
} from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { Prisma } from '@prisma/client';
import { AsyncLocalStorage } from 'node:async_hooks';
import {
  assertRestrictedRuntimeRole,
  type RuntimeDatabaseRole,
} from './runtime-role';

export interface DatabaseSecurityContext {
  schoolId: string | null;
  userId?: string | null;
  isPlatformAdmin?: boolean;
  bypassRls?: boolean;
}

interface TransactionStore {
  client: Prisma.TransactionClient;
  security: DatabaseSecurityContext;
}

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);
  private readonly transactionStorage =
    new AsyncLocalStorage<TransactionStore>();

  constructor() {
    const isProd = process.env.NODE_ENV === 'production';
    const connectionLimit =
      process.env.PRISMA_CONNECTION_LIMIT || (isProd ? '20' : '5');

    // Ensure the connection URL has a connection limit
    let url = process.env.DATABASE_URL || '';
    if (url && !url.includes('connection_limit')) {
      const separator = url.includes('?') ? '&' : '?';
      url = `${url}${separator}connection_limit=${connectionLimit}`;
    }

    super({
      datasourceUrl: url || undefined,
      log: isProd
        ? [
            { emit: 'stdout', level: 'warn' },
            { emit: 'stdout', level: 'error' },
          ]
        : [
            { emit: 'event', level: 'query' },
            { emit: 'stdout', level: 'info' },
            { emit: 'stdout', level: 'warn' },
            { emit: 'stdout', level: 'error' },
          ],
    });

    return new Proxy(this, {
      get: (target, property) => {
        const store = target.transactionStorage.getStore();
        const activeClient = store?.client;

        // Prisma does not support nested transactions. Domain services may
        // still call $transaction while a request-level RLS transaction is
        // active, so reuse the current transaction instead of escaping onto
        // a connection that has no tenant context.
        if (activeClient && property === '$transaction') {
          return async (
            operation:
              | ((client: Prisma.TransactionClient) => Promise<unknown>)
              | Promise<unknown>[],
          ) =>
            typeof operation === 'function'
              ? operation(activeClient)
              : Promise.all(operation);
        }

        const source =
          activeClient && property in activeClient ? activeClient : target;
        const value: unknown = Reflect.get(source, property, source);
        if (typeof value === 'function') {
          return (...args: unknown[]) => {
            const result: unknown = Reflect.apply(value, source, args);
            return result;
          };
        }
        return value;
      },
    });
  }

  getSecurityContext(): DatabaseSecurityContext | undefined {
    return this.transactionStorage.getStore()?.security;
  }

  async runWithSecurityContext<T>(
    security: DatabaseSecurityContext,
    work: () => Promise<T>,
  ): Promise<T> {
    const existing = this.transactionStorage.getStore();
    if (existing) {
      const broadensAccess =
        (!existing.security.bypassRls && security.bypassRls) ||
        (!existing.security.isPlatformAdmin && security.isPlatformAdmin) ||
        (existing.security.schoolId !== security.schoolId &&
          security.schoolId !== null);
      if (broadensAccess) {
        throw new Error(
          'Cannot broaden database security context inside an active transaction',
        );
      }
      return work();
    }

    return this.$transaction(
      async (transaction) => {
        await transaction.$queryRaw`
          SELECT
            set_config('app.current_school_id', ${security.schoolId ?? ''}, true),
            set_config('app.current_user_id', ${security.userId ?? ''}, true),
            set_config('app.is_platform_admin', ${security.isPlatformAdmin ? 'on' : 'off'}, true),
            set_config('app.bypass_rls', ${security.bypassRls ? 'on' : 'off'}, true)
        `;

        return this.transactionStorage.run(
          { client: transaction, security },
          work,
        );
      },
      {
        maxWait: Number(process.env.PRISMA_TRANSACTION_MAX_WAIT_MS || 5000),
        timeout: Number(process.env.PRISMA_TRANSACTION_TIMEOUT_MS || 15000),
      },
    );
  }

  runAsSystem<T>(work: () => Promise<T>): Promise<T> {
    return this.runWithSecurityContext(
      {
        schoolId: null,
        userId: 'system',
        isPlatformAdmin: true,
        bypassRls: true,
      },
      work,
    );
  }

  async onModuleInit() {
    await this.$connect();
    if (
      process.env.DATABASE_RLS_ENABLED === 'true' ||
      process.env.NODE_ENV === 'production'
    ) {
      const roles = await this.$queryRaw<RuntimeDatabaseRole[]>`
        SELECT r.rolsuper AS "superuser", r.rolbypassrls AS "bypassRls",
          EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
            WHERE n.nspname = 'public' AND c.relrowsecurity AND NOT c.relforcerowsecurity
            AND pg_has_role(current_user, c.relowner, 'USAGE')) AS "ownsTenantTables"
        FROM pg_roles r WHERE r.rolname = current_user
      `;
      assertRestrictedRuntimeRole(roles[0]);
    }
    this.logger.log('✅ Database connected');

    // Log slow queries in development
    if (process.env.NODE_ENV === 'development') {
      const clientWithEvents = this as unknown as {
        $on: (
          event: 'query',
          cb: (e: { duration: number; query: string }) => void,
        ) => void;
      };
      clientWithEvents.$on('query', (e) => {
        if (e.duration > 100) {
          this.logger.warn(`Slow query (${e.duration}ms): ${e.query}`);
        }
      });
    }
  }

  async onModuleDestroy() {
    await this.$disconnect();
    this.logger.log('Database disconnected');
  }

  /**
   * Soft truncate all tables (for testing only)
   */
  async cleanDatabase() {
    if (process.env.NODE_ENV !== 'test') {
      throw new Error('cleanDatabase can only be called in test environment');
    }
    const tablenames = await this.$queryRaw<{ tablename: string }[]>`
      SELECT tablename FROM pg_tables
      WHERE schemaname='public'
      AND tablename NOT IN ('_prisma_migrations')
    `;
    for (const { tablename } of tablenames) {
      await this.$executeRawUnsafe(`TRUNCATE TABLE "${tablename}" CASCADE;`);
    }
  }
}
