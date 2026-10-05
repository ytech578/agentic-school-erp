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
  protected getTracker(req: RequestWithUser): Promise<string> {
    // If the request is authenticated, throttle by user ID
    if (req.user?.id) {
      return Promise.resolve(`user-${req.user.id}`);
    }
    // Otherwise fallback to IP
    return Promise.resolve(
      (req.ips?.length ? req.ips[0] : req.ip) || 'unknown',
    );
  }
}
