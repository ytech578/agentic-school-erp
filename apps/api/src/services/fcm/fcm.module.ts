import { Module, Global } from '@nestjs/common';
import { FcmService } from './fcm.service';
import { PrismaModule } from '../../core/database/prisma.module';
import { ConfigModule } from '@nestjs/config';

@Global()
@Module({
  imports: [PrismaModule, ConfigModule],
  providers: [FcmService],
  exports: [FcmService],
})
export class FcmModule {}
