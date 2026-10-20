import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ScimService } from './scim.service';

interface ScimGuardRequest {
  headers: { authorization?: string };
  user?: Record<string, unknown>;
  scimToken?: unknown;
}

@Injectable()
export class ScimTokenGuard implements CanActivate {
  constructor(private readonly scim: ScimService) {}

  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<ScimGuardRequest>();
    const authorization = request.headers.authorization;
    const match =
      typeof authorization === 'string' &&
      authorization.match(/^Bearer\s+(.+)$/i);
    if (!match) throw new UnauthorizedException('SCIM bearer token required');
    const token = await this.scim.authenticate(match[1]);
    if (!token)
      throw new UnauthorizedException(
        'SCIM bearer token is invalid or expired',
      );
    request.user = {
      id: token.createdById,
      sub: token.createdById,
      email: 'scim-provisioner@system.invalid',
      role: 'SCHOOL_ADMIN',
      schoolId: token.schoolId,
      sessionId: token.id,
      authMethod: 'SCIM',
      amr: ['scim_token'],
    };
    request.scimToken = token;
    return true;
  }
}
