import type { Request } from 'express';
import type { UserRole } from '@school-erp/shared';

/**
 * The shape of the user object attached to `req.user` by JwtStrategy.validate().
 * This is the decoded JWT payload enriched with database values.
 */
export interface AuthenticatedUser {
  /** Database user id (same as payload.sub) */
  id: string;
  sub: string;
  email: string;
  role: UserRole;
  schoolId: string | null;
  sessionId: string;
  iat?: number;
  exp?: number;
}

/**
 * Express request extended with typed `req.user` after JWT authentication.
 */
export interface AuthenticatedRequest extends Request {
  user: AuthenticatedUser;
}
