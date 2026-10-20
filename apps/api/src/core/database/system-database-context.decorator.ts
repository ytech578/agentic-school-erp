import { PrismaService } from './prisma.service';

/** Ensures scheduled/background work has an explicit RLS bypass context. */
export function RunWithSystemDatabaseContext() {
  return (
    _target: object,
    _propertyKey: string,
    descriptor: PropertyDescriptor,
  ) => {
    const original = descriptor.value as (
      ...args: unknown[]
    ) => Promise<unknown>;
    descriptor.value = function (
      this: { prisma: PrismaService },
      ...args: unknown[]
    ) {
      if (!this.prisma?.runAsSystem) {
        throw new Error('System database context requires PrismaService');
      }
      return this.prisma.runAsSystem(() => original.apply(this, args));
    };
  };
}
