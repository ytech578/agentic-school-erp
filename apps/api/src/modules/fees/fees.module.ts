import { Module } from '@nestjs/common';
import { FeesService } from './fees.service';
import { FeesController } from './fees.controller';
import { FeesWebhookController } from './fees-webhook.controller';

@Module({
  controllers: [FeesController, FeesWebhookController],
  providers: [FeesService],
  exports: [FeesService],
})
export class FeesModule {}
