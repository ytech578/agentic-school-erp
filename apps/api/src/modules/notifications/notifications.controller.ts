import {
  Controller,
  Get,
  Patch,
  Post,
  Body,
  Query,
  Param,
  UseGuards,
  Request,
  Sse,
  MessageEvent,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { NotificationsService } from './notifications.service';
import { SmsWhatsAppService } from './sms-whatsapp.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('Notifications')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard)
@Controller('notifications')
export class NotificationsController {
  constructor(
    private service: NotificationsService,
    private smsWhatsAppService: SmsWhatsAppService,
  ) {}

  @Sse('stream')
  @ApiOperation({
    summary: 'Stream real-time notification events for current user',
  })
  streamNotifications(@Request() req: any): Observable<MessageEvent> {
    return this.service.getEventStream(req.user.id, req.user.schoolId);
  }

  @Get()
  @ApiOperation({ summary: 'Get notifications for current user' })
  async getNotifications(
    @Request() req: any,
    @Query('limit') limit?: string,
    @Query('unreadOnly') unreadOnly?: string,
  ) {
    return this.service.getNotifications(
      req.user.id,
      req.user.schoolId,
      limit ? parseInt(limit) : 20,
      unreadOnly === 'true',
    );
  }

  @Get('count')
  @ApiOperation({ summary: 'Get unread notification count' })
  async getUnreadCount(@Request() req: any) {
    const count = await this.service.getUnreadCount(
      req.user.id,
      req.user.schoolId,
    );
    return { count };
  }

  @Patch(':id/read')
  @ApiOperation({ summary: 'Mark notification as read' })
  async markAsRead(@Param('id') id: string, @Request() req: any) {
    return this.service.markAsRead(id, req.user.id);
  }

  @Patch('read-all')
  @ApiOperation({ summary: 'Mark all notifications as read' })
  async markAllRead(@Request() req: any) {
    return this.service.markAllRead(req.user.id, req.user.schoolId);
  }

  @Post('test-gateway')
  @ApiOperation({ summary: 'Send test SMS or WhatsApp dispatch' })
  async testGateway(
    @Body()
    dto: {
      channel: 'SMS' | 'WHATSAPP';
      phone: string;
      message?: string;
    },
  ) {
    if (dto.channel === 'WHATSAPP') {
      return this.smsWhatsAppService.sendWhatsApp(
        dto.phone,
        'attendance_alert',
        {
          student_name: 'Test Student',
          status: 'Present',
          date: new Date().toISOString().split('T')[0],
        },
      );
    }
    return this.smsWhatsAppService.sendSMS(
      dto.phone,
      dto.message ||
        'Edusphere Test Dispatch: Gateway verification successful.',
    );
  }
}
