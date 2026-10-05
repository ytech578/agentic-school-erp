import { Injectable, ExecutionContext } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';

@Injectable()
export class UserThrottlerGuard extends ThrottlerGuard {
  protected async getTracker(req: Record<string, any>): Promise<string> {
    // If the request is authenticated, throttle by user ID
    if (req.user && req.user.id) {
      return `user-${req.user.id}`;
    }
    // Otherwise fallback to IP
    return req.ips?.length ? req.ips[0] : req.ip;
  }
}
