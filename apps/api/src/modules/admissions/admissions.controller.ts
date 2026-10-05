import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Delete,
  Param,
  UseGuards,
  Request,
  Res,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import { ApiTags, ApiOperation, ApiConsumes, ApiBody } from '@nestjs/swagger';
import { AdmissionsService } from './admissions.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../core/guards/roles.guard';
import { Roles } from '../../core/decorators/roles.decorator';
import { AdmissionStatus, EnquiryStatus } from '@prisma/client';

interface AuthenticatedRequest {
  user: {
    id: string;
    schoolId: string;
    role?: string;
    [key: string]: unknown;
  };
}

@ApiTags('Admissions')
@Controller('admissions')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AdmissionsController {
  constructor(private readonly admissionsService: AdmissionsService) {}

  // ================= ENQUIRIES =================

  @Post('enquiries')
  @Roles('SUPER_ADMIN', 'SCHOOL_ADMIN', 'PRINCIPAL')
  createEnquiry(@Request() req: AuthenticatedRequest, @Body() data: any) {
    return this.admissionsService.createEnquiry(req.user.schoolId, data);
  }

  @Get('enquiries')
  @Roles('SUPER_ADMIN', 'SCHOOL_ADMIN', 'PRINCIPAL')
  findAllEnquiries(@Request() req: AuthenticatedRequest) {
    return this.admissionsService.findAllEnquiries(req.user.schoolId);
  }

  @Patch('enquiries/:id/status')
  @Roles('SUPER_ADMIN', 'SCHOOL_ADMIN', 'PRINCIPAL')
  updateEnquiryStatus(
    @Request() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body('status') status: EnquiryStatus,
  ) {
    return this.admissionsService.updateEnquiryStatus(
      req.user.schoolId,
      id,
      status,
    );
  }

  @Post('enquiries/calculate-scores')
  @Roles('SUPER_ADMIN', 'SCHOOL_ADMIN', 'PRINCIPAL')
  calculateLeadScores(@Request() req: AuthenticatedRequest) {
    return this.admissionsService.calculateLeadScores(req.user.schoolId);
  }

  // ================= APPLICATIONS =================

  @Post('applications')
  @Roles('SUPER_ADMIN', 'SCHOOL_ADMIN', 'PRINCIPAL')
  createApplication(@Request() req: AuthenticatedRequest, @Body() data: any) {
    return this.admissionsService.createApplication(req.user.schoolId, data);
  }

  @Get('applications')
  @Roles('SUPER_ADMIN', 'SCHOOL_ADMIN', 'PRINCIPAL')
  findAllApplications(@Request() req: AuthenticatedRequest) {
    return this.admissionsService.findAllApplications(req.user.schoolId);
  }

  @Get('applications/:id')
  @Roles('SUPER_ADMIN', 'SCHOOL_ADMIN', 'PRINCIPAL')
  getApplicationById(@Request() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.admissionsService.getApplicationById(req.user.schoolId, id);
  }

  @Patch('applications/:id/status')
  @Roles('SUPER_ADMIN', 'SCHOOL_ADMIN', 'PRINCIPAL')
  updateApplicationStatus(
    @Request() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body('status') status: AdmissionStatus,
  ) {
    return this.admissionsService.updateApplicationStatus(
      req.user.schoolId,
      id,
      status,
    );
  }

  @Get('applications/:id/enrollment-preview')
  @Roles('SUPER_ADMIN', 'SCHOOL_ADMIN', 'PRINCIPAL')
  getEnrollmentPreview(@Request() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.admissionsService.getEnrollmentPreview(req.user.schoolId, id);
  }

  @Post('applications/:id/reject')
  @Roles('SUPER_ADMIN', 'SCHOOL_ADMIN', 'PRINCIPAL')
  rejectApplication(
    @Request() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body('reason') reason?: string,
  ) {
    return this.admissionsService.rejectApplication(
      req.user.schoolId,
      id,
      reason,
    );
  }

  @Post('applications/:id/convert')
  @Roles('SUPER_ADMIN', 'SCHOOL_ADMIN', 'PRINCIPAL')
  convertApplicationToStudent(
    @Request() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body()
    body?: { classId?: string; sectionId?: string; rollNumber?: string },
  ) {
    return this.admissionsService.convertApplicationToStudent(
      req.user.schoolId,
      id,
      body,
    );
  }

  // ================= ANALYTICS =================

  @Get('analytics')
  @Roles('SUPER_ADMIN', 'SCHOOL_ADMIN', 'PRINCIPAL')
  getAnalytics(@Request() req: AuthenticatedRequest) {
    return this.admissionsService.getAnalytics(req.user.schoolId);
  }

  // ================= ADMISSION DOCUMENTS =================

  @Post('applications/:id/documents')
  @Roles('SUPER_ADMIN', 'SCHOOL_ADMIN', 'PRINCIPAL')
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Upload an admission application document' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
        documentType: {
          type: 'string',
          example: 'BIRTH_CERTIFICATE',
        },
      },
    },
  })
  async uploadApplicationDocument(
    @Request() req: AuthenticatedRequest,
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
    @Body('documentType') documentType: string,
  ) {
    const schoolId = req.user.schoolId;
    return this.admissionsService.uploadApplicationDocument(
      schoolId,
      id,
      file,
      documentType,
    );
  }

  @Get('applications/:id/documents')
  @Roles('SUPER_ADMIN', 'SCHOOL_ADMIN', 'PRINCIPAL')
  @ApiOperation({ summary: 'List documents for an admission application' })
  async getApplicationDocuments(@Request() req: AuthenticatedRequest, @Param('id') id: string) {
    const schoolId = req.user.schoolId;
    return this.admissionsService.getApplicationDocuments(schoolId, id);
  }

  @Get('applications/:id/documents/:docId/download')
  @Roles('SUPER_ADMIN', 'SCHOOL_ADMIN', 'PRINCIPAL')
  @ApiOperation({
    summary: 'Download an authenticated admission application document',
  })
  async downloadApplicationDocument(
    @Request() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Param('docId') docId: string,
    @Res() res: Response,
  ) {
    const schoolId = req.user.schoolId;
    const { doc, fileStreamResult } =
      await this.admissionsService.getApplicationDocumentStream(
        schoolId,
        id,
        docId,
      );

    res.setHeader(
      'Content-Type',
      fileStreamResult.mimeType || 'application/octet-stream',
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${encodeURIComponent(fileStreamResult.fileName)}"`,
    );
    if (fileStreamResult.fileSize) {
      res.setHeader('Content-Length', fileStreamResult.fileSize.toString());
    }

    fileStreamResult.stream.pipe(res);
  }

  @Delete('applications/:id/documents/:docId')
  @Roles('SUPER_ADMIN', 'SCHOOL_ADMIN', 'PRINCIPAL')
  @ApiOperation({ summary: 'Delete an admission application document' })
  async deleteApplicationDocument(
    @Request() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Param('docId') docId: string,
  ) {
    const schoolId = req.user.schoolId;
    return this.admissionsService.deleteApplicationDocument(
      schoolId,
      id,
      docId,
    );
  }
}
