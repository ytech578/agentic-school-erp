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
    config: ConfigService,
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
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, status: true, role: true, schoolId: true },
    });

    if (!user || user.status === 'INACTIVE' || user.status === 'SUSPENDED') {
      throw new UnauthorizedException('User account is inactive');
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
        const schoolExists = await this.prisma.school.findUnique({
          where: { id: candidate },
          select: { id: true },
        });
        if (schoolExists) {
          schoolId = schoolExists.id;
        }
      }

      // Security: Do NOT fall back to findFirst() for SUPER_ADMIN.
      // Without an explicit x-school-id, the super admin operates in global fleet mode (schoolId: null).
      // School-scoped service methods will enforce requireSchoolId() and fail-closed if schoolId is null.
    }

    return {
      ...payload,
      id: user.id,
      schoolId: schoolId ?? null,
      role: user.role,
    }; // Attached to req.user
  }
}
