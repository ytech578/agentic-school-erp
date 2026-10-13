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
import type { AuthenticatedRequest } from '../../core/types/auth-request.interface';

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
    @Request() req: AuthenticatedRequest,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('role') role?: string,
    @Query('status') status?: string,
    @Query('search') search?: string,
  ) {
    return this.usersService.findAll(
      req.user.schoolId || '',
      {
        page: page ? +page : 1,
        limit: limit ? +limit : 20,
        role,
        status,
        search,
      },
      req.user,
    );
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
  getMe(@Request() req: AuthenticatedRequest) {
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
  updateMyProfile(
    @Request() req: AuthenticatedRequest,
    @Body()
    data: {
      avatarUrl?: string;
      phone?: string;
      firstName?: string;
      lastName?: string;
    },
  ) {
    // Only allow updating safe fields
    const safeData = {
      avatarUrl: data.avatarUrl,
      phone: data.phone,
      firstName: data.firstName,
      lastName: data.lastName,
    };
    return this.usersService.updateProfile(req.user.id, safeData);
  }

  @Get('stats')
  @Roles('SUPER_ADMIN', 'SCHOOL_ADMIN', 'PRINCIPAL')
  @ApiOperation({ summary: 'Get global user stats and role breakdown' })
  getStats(@Request() req: AuthenticatedRequest) {
    return this.usersService.getStats(req.user.schoolId || '', req.user);
  }

  @Get(':id')
  @Roles('SUPER_ADMIN', 'SCHOOL_ADMIN', 'PRINCIPAL')
  findOne(@Request() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.usersService.findById(
      id,
      req.user?.schoolId || undefined,
      req.user?.role === 'SUPER_ADMIN',
    );
  }

  @Post()
  @Roles('SUPER_ADMIN', 'SCHOOL_ADMIN')
  create(
    @Request() req: AuthenticatedRequest,
    @Body()
    data: {
      email: string;
      firstName: string;
      lastName: string;
      role: string;
      phone?: string;
      password?: string;
    },
  ) {
    return this.usersService.createUser(
      req.user.schoolId || '',
      data,
      req.user,
    );
  }

  @Patch(':id')
  @Roles('SUPER_ADMIN', 'SCHOOL_ADMIN', 'PRINCIPAL')
  update(
    @Request() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body()
    data: {
      firstName?: string;
      lastName?: string;
      phone?: string;
      role?: string;
    },
  ) {
    return this.usersService.updateUser(id, data, req.user);
  }

  @Patch(':id/status')
  @Roles('SUPER_ADMIN', 'SCHOOL_ADMIN')
  updateStatus(
    @Request() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() body: { status: string },
  ) {
    return this.usersService.updateStatus(id, body.status, req.user);
  }

  @Post(':id/reset-password')
  @Roles('SUPER_ADMIN', 'SCHOOL_ADMIN')
  resetPassword(
    @Request() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() body: { newPassword: string },
  ) {
    return this.usersService.resetPassword(id, body.newPassword, req.user);
  }

  @Delete(':id')
  @Roles('SUPER_ADMIN', 'SCHOOL_ADMIN')
  remove(@Request() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.usersService.deactivateUser(id, req.user);
  }
}
