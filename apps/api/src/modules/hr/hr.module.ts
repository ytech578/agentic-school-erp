import { Module } from '@nestjs/common';
import { HRService } from './hr.service';
import { HRController } from './hr.controller';

@Module({
  controllers: [HRController],
  providers: [HRService],
  exports: [HRService],
})
export class HRModule {}
