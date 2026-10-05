import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  UseGuards,
  Request,
  Response,
  Res,
} from '@nestjs/common';
import { CertificatesService } from './certificates.service';
import {
  CreateCertificateTemplateDto,
  UpdateCertificateTemplateDto,
  IssueCertificateDto,
  BulkIssueCertificateDto,
  RevokeCertificateDto,
} from './dto/certificate.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../core/guards/roles.guard';
import { Roles } from '../../core/decorators/roles.decorator';
import { ApiBearerAuth, ApiTags, ApiOperation } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';

@ApiTags('Certificates')
@Controller('certificates')
export class CertificatesController {
  constructor(private readonly certService: CertificatesService) {}

  // ─── PUBLIC VERIFICATION (Tamper-evident verification, no auth required) ────

  @Get('verify/:hash')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @ApiOperation({ summary: 'Public tamper-evident certificate verification' })
  verifyCertificate(@Param('hash') hash: string) {
    return this.certService.verifyCertificateByHash(hash);
  }

  // ─── TEMPLATES ────────────────────────────────────────────────────────────

  @Post('templates')
  @ApiBearerAuth('JWT-auth')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN', 'SCHOOL_ADMIN', 'PRINCIPAL')
  @ApiOperation({ summary: 'Create a certificate template' })
  createTemplate(
    @Request() req: any,
    @Body() dto: CreateCertificateTemplateDto,
  ) {
    return this.certService.createTemplate(req.user.schoolId, dto);
  }

  @Put('templates/:id')
  @ApiBearerAuth('JWT-auth')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN', 'SCHOOL_ADMIN', 'PRINCIPAL')
  @ApiOperation({ summary: 'Update a certificate template' })
  updateTemplate(
    @Request() req: any,
    @Param('id') id: string,
    @Body() dto: UpdateCertificateTemplateDto,
  ) {
    return this.certService.updateTemplate(req.user.schoolId, id, dto);
  }

  @Get('templates')
  @ApiBearerAuth('JWT-auth')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN', 'SCHOOL_ADMIN', 'PRINCIPAL', 'TEACHER')
  @ApiOperation({ summary: 'Get certificate templates' })
  getTemplates(@Request() req: any) {
    return this.certService.getTemplates(req.user.schoolId);
  }

  @Get()
  @ApiBearerAuth('JWT-auth')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN', 'SCHOOL_ADMIN', 'PRINCIPAL', 'TEACHER')
  @ApiOperation({ summary: 'Get all certificates issued for school or fleet' })
  getCertificates(@Request() req: any) {
    return this.certService.getCertificates(req.user.schoolId);
  }

  // ─── ISSUANCE ─────────────────────────────────────────────────────────────

  @Post('issue')
  @ApiBearerAuth('JWT-auth')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN', 'SCHOOL_ADMIN', 'PRINCIPAL')
  @ApiOperation({ summary: 'Generate and issue a formal student certificate' })
  issueCertificate(@Request() req: any, @Body() dto: IssueCertificateDto) {
    return this.certService.issueCertificate(
      req.user.schoolId,
      req.user.id,
      dto,
    );
  }

  @Post('bulk-issue')
  @ApiBearerAuth('JWT-auth')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN', 'SCHOOL_ADMIN', 'PRINCIPAL')
  @ApiOperation({ summary: 'Bulk generate and issue student certificates' })
  bulkIssueCertificates(
    @Request() req: any,
    @Body() dto: BulkIssueCertificateDto,
  ) {
    return this.certService.bulkIssueCertificates(
      req.user.schoolId,
      req.user.id,
      dto,
    );
  }

  @Get('students/:studentId')
  @ApiBearerAuth('JWT-auth')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiOperation({ summary: 'Get certificates issued for a student' })
  getStudentCertificates(
    @Request() req: any,
    @Param('studentId') studentId: string,
  ) {
    return this.certService.getStudentCertificates(
      req.user.schoolId,
      studentId,
      req.user.id,
      req.user.role,
    );
  }

  @Put(':id/revoke')
  @ApiBearerAuth('JWT-auth')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN', 'SCHOOL_ADMIN', 'PRINCIPAL')
  @ApiOperation({ summary: 'Revoke an issued certificate' })
  revokeCertificate(
    @Request() req: any,
    @Param('id') id: string,
    @Body() dto: RevokeCertificateDto,
  ) {
    return this.certService.revokeCertificate(req.user.schoolId, id, dto);
  }

  @Get(':id')
  @ApiBearerAuth('JWT-auth')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN', 'SCHOOL_ADMIN', 'PRINCIPAL', 'TEACHER')
  @ApiOperation({ summary: 'Get detailed certificate record with particulars' })
  getCertificateById(@Request() req: any, @Param('id') id: string) {
    return this.certService.getCertificateById(req.user.schoolId, id);
  }

  @Get(':id/download')
  @ApiBearerAuth('JWT-auth')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiOperation({ summary: 'Download certificate PDF' })
  async downloadCertificate(
    @Request() req: any,
    @Param('id') id: string,
    @Res() res: any,
  ) {
    const { stream } = await this.certService.getCertificateStream(
      req.user.schoolId,
      id,
    );
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="certificate-${id}.pdf"`,
    );
    return stream.pipe(res);
  }
}
