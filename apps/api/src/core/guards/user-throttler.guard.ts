import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';

interface RequestWithUser {
  user?: { id?: string };
  ips?: string[];
  ip?: string;
  [key: string]: unknown;
}

@Injectable()
export class UserThrottlerGuard extends ThrottlerGuard {
  protected async getTracker(req: RequestWithUser): Promise<string> {
    // If the request is authenticated, throttle by user ID
    if (req.user?.id) {
      return `user-${req.user.id}`;
    }
    // Otherwise fallback to IP
    return (req.ips?.length ? req.ips[0] : req.ip) || 'unknown';
  }
}
