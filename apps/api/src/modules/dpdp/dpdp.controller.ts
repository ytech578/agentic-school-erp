import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
  Request,
  Req,
  Res,
} from '@nestjs/common';
import { DpdpService } from './dpdp.service';
import { GrantConsentDto, CreateDataPrivacyRequestDto } from './dto/dpdp.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../core/guards/roles.guard';
import { Roles } from '../../core/decorators/roles.decorator';
import { ApiBearerAuth, ApiTags, ApiOperation } from '@nestjs/swagger';

@ApiTags('DPDP Privacy Compliance')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('privacy')
export class DpdpController {
  constructor(private readonly dpdpService: DpdpService) {}

  @Get('stats')
  @Roles('SUPER_ADMIN', 'SCHOOL_ADMIN', 'PRINCIPAL')
  @ApiOperation({ summary: 'Get DPDP Act statutory compliance metrics and DPO contact details' })
  getComplianceStats(@Request() req: any) {
    return this.dpdpService.getComplianceStats(req.user.schoolId);
  }

  @Post('consents')
  @Roles('PARENT', 'SUPER_ADMIN', 'SCHOOL_ADMIN')
  @ApiOperation({
    summary: 'Grant or revoke verifiable parental consent (DPDP Act Sec 9)',
  })
  grantConsent(@Request() req: any, @Body() dto: GrantConsentDto) {
    const ipAddress = req.ip || req.connection?.remoteAddress;
    return this.dpdpService.grantOrRevokeConsent(
      req.user.schoolId,
      req.user.id,
      ipAddress,
      dto,
    );
  }

  @Get('students/:studentId/consents')
  @ApiOperation({ summary: 'View recorded parental consents for a student' })
  getStudentConsents(
    @Request() req: any,
    @Param('studentId') studentId: string,
  ) {
    return this.dpdpService.getStudentConsents(
      req.user.schoolId,
      studentId,
      req.user.id,
      req.user.role,
    );
  }

  @Post('requests')
  @ApiOperation({
    summary: 'Submit DPDP data subject request (Export or Erasure)',
  })
  createPrivacyRequest(
    @Request() req: any,
    @Body() dto: CreateDataPrivacyRequestDto,
  ) {
    return this.dpdpService.createPrivacyRequest(
      req.user.schoolId,
      req.user.id,
      dto,
    );
  }

  @Get('requests')
  @ApiOperation({ summary: 'List data privacy requests' })
  getPrivacyRequests(@Request() req: any) {
    return this.dpdpService.getPrivacyRequests(
      req.user.schoolId,
      req.user.id,
      req.user.role,
    );
  }

  @Post('requests/:id/process')
  @Roles('SUPER_ADMIN', 'SCHOOL_ADMIN', 'PRINCIPAL')
  @ApiOperation({ summary: 'Manually process DPDP export request and generate ZIP' })
  processPrivacyRequest(@Request() req: any, @Param('id') id: string) {
    return this.dpdpService.processExportRequest(req.user.schoolId, id);
  }

  @Get('requests/:id/download')
  @ApiOperation({ summary: 'Download completed personal data export ZIP archive' })
  async downloadExportArchive(
    @Request() req: any,
    @Param('id') id: string,
    @Res() res: any,
  ) {
    const { stream, fileName, mimeType } =
      await this.dpdpService.getExportDownloadStream(
        req.user.schoolId,
        id,
        req.user.id,
        req.user.role,
      );

    res.setHeader('Content-Type', mimeType || 'application/zip');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${fileName || `dpdp-archive-${id}.zip`}"`,
    );
    return (stream as any).pipe(res);
  }

  @Get('export/:userId')
  @ApiOperation({
    summary: 'Export full personal data archive in structured JSON (Sec 11)',
  })
  exportUserData(@Request() req: any, @Param('userId') targetUserId: string) {
    // Regular users can only export their own data
    const isElevated = ['SUPER_ADMIN', 'SCHOOL_ADMIN', 'PRINCIPAL'].includes(
      req.user.role,
    );
    const userId = isElevated ? targetUserId : req.user.id;
    return this.dpdpService.exportUserData(req.user.schoolId, userId);
  }

  @Post('anonymize/:userId')
  @Roles('SUPER_ADMIN', 'SCHOOL_ADMIN', 'PRINCIPAL')
  @ApiOperation({
    summary: 'Execute Right to be Forgotten / Data Anonymization (Sec 12)',
  })
  anonymizeUserData(
    @Request() req: any,
    @Param('userId') targetUserId: string,
    @Body('reason') reason: string,
  ) {
    return this.dpdpService.anonymizeUserData(
      req.user.schoolId,
      targetUserId,
      reason || 'Exercised Right to be Forgotten under DPDP Act 2023',
    );
  }
}
