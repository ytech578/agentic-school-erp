import { Module } from '@nestjs/common';
import { DpdpService } from './dpdp.service';
import { DpdpController } from './dpdp.controller';
import { PrismaModule } from '../../core/database/prisma.module';
import { StorageModule } from '../../services/storage/storage.module';

@Module({
  imports: [PrismaModule, StorageModule],
  controllers: [DpdpController],
  providers: [DpdpService],
  exports: [DpdpService],
})
export class DpdpModule {}
