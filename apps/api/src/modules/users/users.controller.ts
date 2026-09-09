import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../core/guards/roles.guard';
import { Roles } from '../../core/decorators/roles.decorator';

@ApiTags('Users')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('users')
export class UsersController {
  constructor(private usersService: UsersService) {}

  @Get()
  @Roles('SUPER_ADMIN', 'SCHOOL_ADMIN', 'PRINCIPAL')
  @ApiOperation({ summary: 'List all users with filters' })
  findAll(
    @Request() req: any,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('role') role?: string,
    @Query('status') status?: string,
    @Query('search') search?: string,
  ) {
    return this.usersService.findAll(req.user.schoolId, {
      page: page ? +page : 1,
      limit: limit ? +limit : 20,
      role,
      status,
      search,
    });
  }

  @Get('me')
  @Roles(
    'SUPER_ADMIN',
    'SCHOOL_ADMIN',
    'PRINCIPAL',
    'TEACHER',
    'STUDENT',
    'PARENT',
  )
  getMe(@Request() req: any) {
    return this.usersService.findById(req.user.id);
  }

  @Patch('me/profile')
  @Roles(
    'SUPER_ADMIN',
    'SCHOOL_ADMIN',
    'PRINCIPAL',
    'TEACHER',
    'STUDENT',
    'PARENT',
  )
  updateMyProfile(@Request() req: any, @Body() data: any) {
    // Only allow updating safe fields like avatarUrl or phone
    const safeData = {
      avatarUrl: data.avatarUrl,
      // Add other safe fields if needed
    };
    return this.usersService.updateProfile(req.user.id, safeData);
  }

  @Get(':id')
  @Roles('SUPER_ADMIN', 'SCHOOL_ADMIN', 'PRINCIPAL')
  findOne(@Param('id') id: string) {
    return this.usersService.findById(id);
  }

  @Post()
  @Roles('SUPER_ADMIN', 'SCHOOL_ADMIN')
  create(@Request() req: any, @Body() data: any) {
    return this.usersService.createUser(req.user.schoolId, data, req.user);
  }

  @Patch(':id')
  @Roles('SUPER_ADMIN', 'SCHOOL_ADMIN', 'PRINCIPAL')
  update(@Request() req: any, @Param('id') id: string, @Body() data: any) {
    return this.usersService.updateUser(id, data, req.user);
  }

  @Patch(':id/status')
  @Roles('SUPER_ADMIN', 'SCHOOL_ADMIN')
  updateStatus(@Request() req: any, @Param('id') id: string, @Body() body: { status: string }) {
    return this.usersService.updateStatus(id, body.status, req.user);
  }

  @Post(':id/reset-password')
  @Roles('SUPER_ADMIN', 'SCHOOL_ADMIN')
  resetPassword(
    @Request() req: any,
    @Param('id') id: string,
    @Body() body: { newPassword: string },
  ) {
    return this.usersService.resetPassword(id, body.newPassword, req.user);
  }

  @Delete(':id')
  @Roles('SUPER_ADMIN', 'SCHOOL_ADMIN')
  remove(@Request() req: any, @Param('id') id: string) {
    return this.usersService.deactivateUser(id, req.user);
  }
}
