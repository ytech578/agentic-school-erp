import {
  Controller,
  Get,
  Put,
  Post,
  Body,
  Param,
  UseGuards,
  Request,
  ForbiddenException,
} from '@nestjs/common';
import { SubscriptionsService } from './subscriptions.service';
import { UpdateSubscriptionDto } from './dto/subscription.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../core/guards/roles.guard';
import { Roles } from '../../core/decorators/roles.decorator';
import { ApiBearerAuth, ApiTags, ApiOperation } from '@nestjs/swagger';

@ApiTags('Subscriptions')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('subscriptions')
export class SubscriptionsController {
  constructor(private readonly subscriptionsService: SubscriptionsService) {}

  @Get()
  @Roles('SUPER_ADMIN', 'SCHOOL_ADMIN', 'PRINCIPAL', 'TEACHER')
  @ApiOperation({
    summary:
      'Get current school subscription plan and resource utilization metrics',
  })
  getCurrentSubscription(@Request() req: any) {
    const targetSchoolId =
      req.user?.schoolId || req.headers?.['x-school-id'] || req.query?.schoolId;
    return this.subscriptionsService.getSubscription(targetSchoolId);
  }

  @Get(':schoolId')
  @Roles('SUPER_ADMIN')
  @ApiOperation({
    summary:
      'Get school subscription plan by schoolId (Super Admin fleet overview)',
  })
  getSchoolSubscription(@Param('schoolId') schoolId: string) {
    return this.subscriptionsService.getSubscription(schoolId);
  }

  @Post('upgrade')
  @Roles('SUPER_ADMIN', 'SCHOOL_ADMIN', 'PRINCIPAL')
  @ApiOperation({ summary: 'Upgrade current school subscription plan' })
  upgradeCurrentSubscription(
    @Request() req: any,
    @Body() dto: UpdateSubscriptionDto,
  ) {
    const targetSchoolId =
      req.user?.schoolId || req.headers?.['x-school-id'] || req.query?.schoolId;
    return this.subscriptionsService.updateSubscription(targetSchoolId, dto);
  }

  @Put(':schoolId')
  @Roles('SUPER_ADMIN', 'SCHOOL_ADMIN', 'PRINCIPAL')
  @ApiOperation({
    summary: 'Upgrade or update school subscription tier and quotas',
  })
  updateSubscription(
    @Request() req: any,
    @Param('schoolId') schoolId: string,
    @Body() dto: UpdateSubscriptionDto,
  ) {
    if (req.user.role !== 'SUPER_ADMIN' && req.user.schoolId !== schoolId) {
      throw new ForbiddenException(
        'You can only manage your own school subscription.',
      );
    }
    return this.subscriptionsService.updateSubscription(schoolId, dto);
  }
}
