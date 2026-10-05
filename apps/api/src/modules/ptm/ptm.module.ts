import { Module } from '@nestjs/common';
import { PtmService } from './ptm.service';
import { PtmController } from './ptm.controller';
import { PrismaModule } from '../../core/database/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [PtmController],
  providers: [PtmService],
  exports: [PtmService],
})
export class PtmModule {}
