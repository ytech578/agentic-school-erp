import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Roles } from '../../core/decorators/roles.decorator';
import { RolesGuard } from '../../core/guards/roles.guard';
import type { AuthenticatedRequest } from '../../core/types/auth-request.interface';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { BreakGlassService } from './break-glass.service';
import { IdentityProviderService } from './identity-provider.service';
import {
  BreakGlassApproveSchema,
  BreakGlassRequestSchema,
  BreakGlassRevokeSchema,
  ScimTokenSchema,
} from './identity.schemas';
import { ScimService } from './scim.service';
import { SessionAdministrationService } from './session-administration.service';
import { z } from 'zod';

@ApiTags('Enterprise Identity')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('enterprise-identity')
export class EnterpriseIdentityController {
  constructor(
    private readonly providers: IdentityProviderService,
    private readonly breakGlass: BreakGlassService,
    private readonly scim: ScimService,
    private readonly sessions: SessionAdministrationService,
  ) {}

  @Get('providers')
  @Roles('SUPER_ADMIN', 'SCHOOL_ADMIN')
  listProviders(@Request() request: AuthenticatedRequest) {
    return this.providers.list(this.requireSchool(request));
  }

  @Post('providers')
  @Roles('SUPER_ADMIN', 'SCHOOL_ADMIN')
  createProvider(
    @Request() request: AuthenticatedRequest,
    @Body() body: unknown,
  ) {
    return this.providers.create(
      this.requireSchool(request),
      request.user.id,
      body,
    );
  }

  @Patch('providers/:id')
  @Roles('SUPER_ADMIN', 'SCHOOL_ADMIN')
  updateProvider(
    @Request() request: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    return this.providers.update(
      this.requireSchool(request),
      id,
      request.user.id,
      body,
    );
  }

  @Get('break-glass')
  @Roles('SUPER_ADMIN')
  listBreakGlass() {
    return this.breakGlass.list();
  }

  @Post('break-glass')
  @Roles('SUPER_ADMIN')
  async requestBreakGlass(
    @Request() request: AuthenticatedRequest,
    @Body() body: unknown,
  ) {
    const dto = BreakGlassRequestSchema.parse(body);
    await this.sessions.requireRecentMfa(
      request.user.id,
      request.user.sessionId,
    );
    return this.breakGlass.request(request.user.id, dto.schoolId, dto.reason);
  }

  @Post('break-glass/:id/approve')
  @Roles('SUPER_ADMIN')
  async approveBreakGlass(
    @Request() request: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    const dto = BreakGlassApproveSchema.parse(body);
    await this.sessions.requireRecentMfa(
      request.user.id,
      request.user.sessionId,
    );
    return this.breakGlass.approve(id, request.user.id, dto.durationMinutes);
  }

  @Post('break-glass/:id/revoke')
  @Roles('SUPER_ADMIN')
  async revokeBreakGlass(
    @Request() request: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    const dto = BreakGlassRevokeSchema.parse(body);
    await this.sessions.requireRecentMfa(
      request.user.id,
      request.user.sessionId,
    );
    return this.breakGlass.revoke(id, request.user.id, dto.reason);
  }

  @Post('scim-tokens')
  @Roles('SUPER_ADMIN', 'SCHOOL_ADMIN')
  @ApiOperation({ summary: 'Create a one-time-displayed SCIM bearer token' })
  createScimToken(
    @Request() request: AuthenticatedRequest,
    @Body() body: unknown,
  ) {
    const dto = ScimTokenSchema.parse(body);
    const schoolId = this.authorizedSchool(request, dto.schoolId);
    if (!schoolId) throw new BadRequestException('A school is required');
    return this.scim.createToken(
      request.user.id,
      schoolId,
      dto.name,
      dto.expiresAt,
    );
  }

  @Get('scim-tokens')
  @Roles('SUPER_ADMIN', 'SCHOOL_ADMIN')
  @ApiOperation({ summary: 'List SCIM tokens without exposing token secrets' })
  listScimTokens(
    @Request() request: AuthenticatedRequest,
    @Query('schoolId') schoolId?: string,
  ) {
    return this.scim.listTokens(this.authorizedSchool(request, schoolId));
  }

  @Delete('scim-tokens/:id')
  @Roles('SUPER_ADMIN', 'SCHOOL_ADMIN')
  revokeScimToken(
    @Request() request: AuthenticatedRequest,
    @Param('id') id: string,
  ) {
    return this.scim.revokeToken(
      request.user.id,
      id,
      request.user.role === 'SUPER_ADMIN'
        ? undefined
        : this.requireSchool(request),
    );
  }

  @Get('users/:userId/sessions')
  @Roles('SUPER_ADMIN', 'SCHOOL_ADMIN')
  listUserSessions(
    @Request() request: AuthenticatedRequest,
    @Param('userId') userId: string,
  ) {
    return this.sessions.list(this.requireSchool(request), userId);
  }

  @Post('users/:userId/revoke-sessions')
  @Roles('SUPER_ADMIN', 'SCHOOL_ADMIN')
  revokeUserSessions(
    @Request() request: AuthenticatedRequest,
    @Param('userId') userId: string,
    @Body() body: unknown,
  ) {
    const dto = z
      .object({ reason: z.string().trim().min(10).max(500) })
      .parse(body);
    return this.sessions.revoke(
      this.requireSchool(request),
      userId,
      request.user.id,
      request.user.sessionId,
      dto.reason,
    );
  }

  private requireSchool(request: AuthenticatedRequest) {
    if (!request.user.schoolId) {
      throw new BadRequestException('A school context is required');
    }
    return request.user.schoolId;
  }

  private authorizedSchool(
    request: AuthenticatedRequest,
    requestedSchoolId?: string,
  ) {
    if (request.user.role === 'SUPER_ADMIN') return requestedSchoolId;
    if (!request.user.schoolId) {
      throw new BadRequestException('A school context is required');
    }
    if (requestedSchoolId && requestedSchoolId !== request.user.schoolId) {
      throw new BadRequestException('School context does not match session');
    }
    return request.user.schoolId;
  }
}
