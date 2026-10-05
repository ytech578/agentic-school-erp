import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  Res,
} from '@nestjs/common';
import { AlumniService } from './alumni.service';
import {
  UpsertAlumniProfileDto,
  CreateTranscriptRequestDto,
  UpdateTranscriptRequestStatusDto,
  AlumniSelfRegisterDto,
} from './dto/alumni.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../core/guards/roles.guard';
import { Roles } from '../../core/decorators/roles.decorator';
import { ApiBearerAuth, ApiTags, ApiOperation } from '@nestjs/swagger';

@ApiTags('Alumni Management & Transcripts')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('alumni')
export class AlumniController {
  constructor(private readonly alumniService: AlumniService) {}

  // ─── 1. ALUMNI PROFILES ────────────────────────────────────────────────────

  @Post('profiles')
  @Roles('SUPER_ADMIN', 'SCHOOL_ADMIN', 'PRINCIPAL', 'STUDENT')
  @ApiOperation({ summary: 'Register or update an alumni profile' })
  upsertProfile(@Request() req: any, @Body() dto: UpsertAlumniProfileDto) {
    return this.alumniService.upsertAlumniProfile(req.user.schoolId, dto);
  }

  @Get('profiles')
  @Roles('SUPER_ADMIN', 'SCHOOL_ADMIN', 'PRINCIPAL', 'TEACHER')
  @ApiOperation({ summary: 'Search and browse alumni directory with filters' })
  getProfiles(
    @Request() req: any,
    @Query('graduationYear') graduationYear?: number,
    @Query('currentStatus') currentStatus?: string,
    @Query('search') search?: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.alumniService.getAlumniProfiles(req.user.schoolId, {
      graduationYear: graduationYear ? Number(graduationYear) : undefined,
      currentStatus,
      search,
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
    });
  }

  @Get('profiles/:studentId')
  @Roles('SUPER_ADMIN', 'SCHOOL_ADMIN', 'PRINCIPAL', 'TEACHER', 'STUDENT')
  @ApiOperation({ summary: 'Get alumni profile by student ID' })
  getProfileByStudentId(
    @Request() req: any,
    @Param('studentId') studentId: string,
  ) {
    return this.alumniService.getAlumniProfileByStudentId(
      req.user.schoolId,
      studentId,
    );
  }

  @Get('stats')
  @Roles('SUPER_ADMIN', 'SCHOOL_ADMIN', 'PRINCIPAL')
  @ApiOperation({ summary: 'Get alumni directory aggregate statistics' })
  getDirectoryStats(@Request() req: any) {
    return this.alumniService.getAlumniDirectoryStats(req.user.schoolId);
  }

  // ─── 2. TRANSCRIPT REQUESTS ────────────────────────────────────────────────

  @Post('transcripts')
  @Roles('SUPER_ADMIN', 'SCHOOL_ADMIN', 'PRINCIPAL', 'STUDENT', 'PARENT')
  @ApiOperation({ summary: 'Submit a new transcript request' })
  createTranscriptRequest(
    @Request() req: any,
    @Body() dto: CreateTranscriptRequestDto,
  ) {
    return this.alumniService.createTranscriptRequest(req.user.schoolId, dto);
  }

  @Get('transcripts')
  @Roles('SUPER_ADMIN', 'SCHOOL_ADMIN', 'PRINCIPAL')
  @ApiOperation({ summary: 'List transcript requests for school' })
  getTranscriptRequests(
    @Request() req: any,
    @Query('status') status?: string,
    @Query('studentId') studentId?: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.alumniService.getTranscriptRequests(req.user.schoolId, {
      status,
      studentId,
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
    });
  }

  @Get('transcripts/:id')
  @Roles('SUPER_ADMIN', 'SCHOOL_ADMIN', 'PRINCIPAL', 'STUDENT', 'PARENT')
  @ApiOperation({ summary: 'Get transcript request details by ID' })
  getTranscriptRequestById(@Request() req: any, @Param('id') id: string) {
    return this.alumniService.getTranscriptRequestById(req.user.schoolId, id);
  }

  @Patch('transcripts/:id/status')
  @Roles('SUPER_ADMIN', 'SCHOOL_ADMIN', 'PRINCIPAL')
  @ApiOperation({
    summary:
      'Update transcript request status (PROCESSING, DISPATCHED, COMPLETED, REJECTED)',
  })
  updateTranscriptRequestStatus(
    @Request() req: any,
    @Param('id') id: string,
    @Body() dto: UpdateTranscriptRequestStatusDto,
  ) {
    return this.alumniService.updateTranscriptRequestStatus(
      req.user.schoolId,
      id,
      dto,
    );
  }

  @Get('transcripts/:id/download')
  @Roles('SUPER_ADMIN', 'SCHOOL_ADMIN', 'PRINCIPAL', 'STUDENT', 'PARENT')
  @ApiOperation({ summary: 'Download official academic transcript PDF' })
  async downloadTranscript(
    @Request() req: any,
    @Param('id') id: string,
    @Res() res: any,
  ) {
    const { buffer, fileName } = await this.alumniService.generateTranscriptPdf(
      req.user.schoolId,
      id,
    );

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.setHeader('Content-Length', buffer.length);
    return res.end(buffer);
  }

  @Post('self-register')
  @ApiOperation({ summary: 'Public or alumni self-registration' })
  selfRegister(
    @Request() req: any,
    @Body() dto: AlumniSelfRegisterDto,
    @Query('schoolId') querySchoolId?: string,
  ) {
    const schoolId =
      req?.user?.schoolId || querySchoolId || (dto as any).schoolId;
    return this.alumniService.selfRegisterAlumni(schoolId, dto);
  }
}
