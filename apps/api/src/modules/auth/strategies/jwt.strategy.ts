import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import * as jwt from 'jsonwebtoken';
import { PrismaService } from '../../../core/database/prisma.service';
import type { JwtPayload } from '@school-erp/shared';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    private readonly config: ConfigService,
    private prisma: PrismaService,
  ) {
    const accessSecret = config.getOrThrow<string>('jwt.accessSecret');
    const accessSecretPrev = config.get<string>('jwt.accessSecretPrev');

    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        ExtractJwt.fromAuthHeaderAsBearerToken(),
        ExtractJwt.fromUrlQueryParameter('token'),
      ]),
      ignoreExpiration: false,
      secretOrKeyProvider: (
        _request: any,
        rawJwtToken: any,
        done: (err: any, secretOrKey?: string) => void,
      ) => {
        if (!accessSecretPrev) {
          return done(null, accessSecret);
        }
        try {
          jwt.verify(rawJwtToken, accessSecret);
          return done(null, accessSecret);
        } catch {
          try {
            jwt.verify(rawJwtToken, accessSecretPrev);
            return done(null, accessSecretPrev);
          } catch {
            return done(null, accessSecret);
          }
        }
      },
      passReqToCallback: true,
    });
  }

  async validate(req: any, payload: JwtPayload) {
    const user = await this.prisma.runAsSystem(() =>
      this.prisma.user.findUnique({
        where: { id: payload.sub },
        select: {
          id: true,
          status: true,
          role: true,
          schoolId: true,
          sessions: {
            where: { id: payload.sessionId },
            select: {
              id: true,
              status: true,
              expiresAt: true,
              lastSeenAt: true,
            },
            take: 1,
          },
        },
      }),
    );

    if (!user || user.status === 'INACTIVE' || user.status === 'SUSPENDED') {
      throw new UnauthorizedException('User account is inactive');
    }
    const session = user.sessions[0];
    if (
      !payload.sessionId ||
      !session ||
      session.status !== 'ACTIVE' ||
      session.expiresAt <= new Date()
    ) {
      throw new UnauthorizedException('Session has been revoked or expired');
    }

    let schoolId = user.schoolId || payload.schoolId;

    if (user.role === 'SUPER_ADMIN') {
      const headerSchoolId = req?.headers?.['x-school-id'];
      const querySchoolId = req?.query?.schoolId;
      const targetSchoolId = headerSchoolId || querySchoolId;

      if (
        targetSchoolId &&
        typeof targetSchoolId === 'string' &&
        targetSchoolId.trim()
      ) {
        const candidate = targetSchoolId.trim();
        const requireBreakGlass =
          this.config.get<string>('BREAK_GLASS_REQUIRED') === 'true' ||
          this.config.get<string>('app.nodeEnv') === 'production';
        const [schoolExists, grant] = await this.prisma.runAsSystem(() =>
          Promise.all([
            this.prisma.school.findUnique({
              where: { id: candidate },
              select: { id: true },
            }),
            requireBreakGlass
              ? this.prisma.breakGlassGrant.findFirst({
                  where: {
                    requesterId: user.id,
                    schoolId: candidate,
                    status: 'ACTIVE',
                    expiresAt: { gt: new Date() },
                  },
                  orderBy: { approvedAt: 'desc' },
                  select: { id: true },
                })
              : Promise.resolve(null),
          ]),
        );
        if (schoolExists) {
          if (requireBreakGlass && !grant) {
            throw new UnauthorizedException(
              'An active break-glass grant is required for this school',
            );
          }
          schoolId = schoolExists.id;
          if (grant) {
            await this.prisma.runAsSystem(() =>
              this.prisma.breakGlassGrant.update({
                where: { id: grant.id },
                data: { lastUsedAt: new Date() },
              }),
            );
          }
        }
      }

      // Security: Do NOT fall back to findFirst() for SUPER_ADMIN.
      // Without an explicit x-school-id, the super admin operates in global fleet mode (schoolId: null).
      // School-scoped service methods will enforce requireSchoolId() and fail-closed if schoolId is null.
    }

    if (Date.now() - session.lastSeenAt.getTime() > 60_000) {
      await this.prisma.runAsSystem(() =>
        this.prisma.userSession.update({
          where: { id: session.id },
          data: { lastSeenAt: new Date() },
        }),
      );
    }

    return {
      ...payload,
      id: user.id,
      schoolId: schoolId ?? null,
      role: user.role,
      authMethod:
        user.role === 'SUPER_ADMIN' && schoolId
          ? 'BREAK_GLASS'
          : payload.authMethod,
    }; // Attached to req.user
  }
}
