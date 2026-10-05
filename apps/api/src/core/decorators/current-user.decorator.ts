import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { JwtPayload } from '@school-erp/shared';

/**
 * Parameter decorator that extracts the current authenticated user from the request.
 *
 * Usage:
 * @Get('profile')
 * getProfile(@CurrentUser() user: JwtPayload) { ... }
 *
 * @Get('profile')
 * getProfile(@CurrentUser('id') userId: string) { ... }
 */
export const CurrentUser = createParamDecorator(
  (data: keyof JwtPayload | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest<{ user?: JwtPayload }>();
    const user = request.user;
    return data ? user?.[data] : user;
  },
);
