import { Module } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { NotificationsController } from './notifications.controller';
import { SmsWhatsAppService } from './sms-whatsapp.service';

@Module({
  controllers: [NotificationsController],
  providers: [NotificationsService, SmsWhatsAppService],
  exports: [NotificationsService, SmsWhatsAppService],
})
export class NotificationsModule {}
