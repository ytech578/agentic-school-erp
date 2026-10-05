import { Module } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { NotificationsController } from './notifications.controller';
import { SmsWhatsAppService } from './sms-whatsapp.service';
import { NotificationsGateway } from './notifications.gateway';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [NotificationsController],
  providers: [NotificationsService, SmsWhatsAppService, NotificationsGateway],
  exports: [NotificationsService, SmsWhatsAppService, NotificationsGateway],
})
export class NotificationsModule {}
