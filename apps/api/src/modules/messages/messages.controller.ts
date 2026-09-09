import { Controller, Get, Post, Put, Delete, Body, Param, Query, Request, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { MessagesService } from './messages.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('Messages')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard)
@Controller('messages')
export class MessagesController {
  constructor(private service: MessagesService) {}

  @Get('inbox')
  @ApiOperation({ summary: 'Get inbox messages' })
  getInbox(@Request() req: any) {
    return this.service.getInbox(req.user.id, req.user.schoolId);
  }

  @Get('sent')
  @ApiOperation({ summary: 'Get sent messages' })
  getSent(@Request() req: any) {
    return this.service.getSent(req.user.id, req.user.schoolId);
  }

  @Get('unread-count')
  @ApiOperation({ summary: 'Get unread messages count' })
  getUnreadCount(@Request() req: any) {
    return this.service.getUnreadCount(req.user.id);
  }

  @Get('users')
  @ApiOperation({ summary: 'Get list of users to message' })
  getUsers(@Request() req: any) {
    return this.service.getUsers(req.user.schoolId, req.user.id);
  }

  @Post('send')
  @ApiOperation({ summary: 'Send a new message' })
  send(
    @Request() req: any,
    @Body() body: { recipientId: string; subject?: string; body: string; parentId?: string },
  ) {
    return this.service.sendMessage({
      schoolId: req.user.schoolId,
      senderId: req.user.id,
      recipientId: body.recipientId,
      subject: body.subject,
      body: body.body,
      parentId: body.parentId,
    });
  }

  @Post('broadcast')
  @ApiOperation({ summary: 'Broadcast announcement to all/role' })
  broadcast(
    @Request() req: any,
    @Body() body: { subject: string; body: string; targetRole?: string },
  ) {
    return this.service.broadcastAnnouncement({
      schoolId: req.user.schoolId,
      senderId: req.user.id,
      subject: body.subject,
      body: body.body,
      targetRole: body.targetRole,
    });
  }

  @Put(':id/read')
  @ApiOperation({ summary: 'Mark message as read' })
  markRead(@Param('id') id: string, @Request() req: any) {
    return this.service.markAsRead(id, req.user.id);
  }

  @Put('read-all')
  @ApiOperation({ summary: 'Mark all messages as read' })
  markAllRead(@Request() req: any) {
    return this.service.markAllRead(req.user.id);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a message' })
  delete(@Param('id') id: string, @Request() req: any) {
    return this.service.deleteMessage(id, req.user.id);
  }
}
