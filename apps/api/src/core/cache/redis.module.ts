import { Global, Module } from '@nestjs/common';
import { RedisService } from './redis.service';
import { TenantCacheService } from './tenant-cache.service';

@Global()
@Module({
  providers: [RedisService, TenantCacheService],
  exports: [RedisService, TenantCacheService],
})
export class RedisModule {}
