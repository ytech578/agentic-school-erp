import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  Res,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import { ApiTags, ApiOperation, ApiConsumes, ApiBody } from '@nestjs/swagger';
import { DocumentType } from '@prisma/client';
import { StudentsService } from './students.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../core/guards/roles.guard';
import { Roles } from '../../core/decorators/roles.decorator';
import { CreateStudentSchema, UpdateStudentSchema } from '@school-erp/shared';

@ApiTags('Students')
@Controller('students')
@UseGuards(JwtAuthGuard, RolesGuard)
export class StudentsController {
  constructor(private readonly studentsService: StudentsService) {}

  @Post()
  @Roles('SUPER_ADMIN', 'SCHOOL_ADMIN', 'PRINCIPAL')
  async createStudent(@Request() req: any, @Body() body: any) {
    const parsedBody = CreateStudentSchema.parse(body);
    const schoolId = req.user.schoolId;
    return this.studentsService.createStudent(schoolId, parsedBody);
  }

  @Get()
  @Roles('SUPER_ADMIN', 'SCHOOL_ADMIN', 'PRINCIPAL', 'TEACHER')
  async getStudents(
    @Request() req: any,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('sectionId') sectionId?: string,
    @Query('classId') classId?: string,
  ) {
    const schoolId = req.user.schoolId;
    return this.studentsService.getStudents(
      schoolId,
      page ? parseInt(page) : 1,
      limit ? parseInt(limit) : 10,
      search,
      sectionId,
      classId,
    );
  }

  @Get(':id')
  @Roles('SUPER_ADMIN', 'SCHOOL_ADMIN', 'PRINCIPAL', 'TEACHER')
  async getStudentById(@Request() req: any, @Param('id') id: string) {
    const schoolId = req.user.schoolId;
    return this.studentsService.getStudentById(schoolId, id, req.user.role);
  }

  @Post('calculate-risk')
  @Roles('SUPER_ADMIN', 'SCHOOL_ADMIN', 'PRINCIPAL')
  async calculateRiskScores(@Request() req: any) {
    const schoolId = req.user.schoolId;
    return this.studentsService.calculateRiskScores(schoolId);
  }
  @Put(':id')
  @Roles('SUPER_ADMIN', 'SCHOOL_ADMIN', 'PRINCIPAL')
  async updateStudent(
    @Request() req: any,
    @Param('id') id: string,
    @Body() body: any,
  ) {
    const parsedBody = UpdateStudentSchema.parse(body);
    const schoolId = req.user.schoolId;
    return this.studentsService.updateStudent(schoolId, id, parsedBody);
  }

  @Post('batch-promote')
  @Roles('SUPER_ADMIN', 'SCHOOL_ADMIN', 'PRINCIPAL')
  async batchPromote(
    @Request() req: any,
    @Body()
    body: {
      fromSectionId: string;
      toSectionId?: string;
      studentIds: string[];
      academicYearId: string;
      remarks?: string;
      status?: 'PROMOTED' | 'GRADUATED';
    },
  ) {
    const schoolId = req.user.schoolId;
    const userId = req.user.id;
    return this.studentsService.promoteStudents(schoolId, userId, body);
  }

  @Patch(':id/status')
  @Roles('SUPER_ADMIN', 'SCHOOL_ADMIN', 'PRINCIPAL')
  async updateStudentStatus(
    @Request() req: any,
    @Param('id') id: string,
    @Body()
    body: {
      isActive: boolean;
      status?: 'ACTIVE' | 'TRANSFERRED' | 'DROPPED' | 'GRADUATED';
      reason?: string;
    },
  ) {
    const schoolId = req.user.schoolId;
    return this.studentsService.updateStudentStatus(schoolId, id, body);
  }

  @Get(':id/aadhaar')
  @Roles('SUPER_ADMIN', 'SCHOOL_ADMIN', 'PRINCIPAL')
  @ApiOperation({
    summary:
      'Audited retrieval of unmasked student and guardian Aadhaar numbers',
  })
  async getDecryptedAadhaar(@Request() req: any, @Param('id') id: string) {
    const schoolId = req.user.schoolId;
    return this.studentsService.getDecryptedAadhaar(schoolId, id);
  }

  @Post(':id/documents')
  @Roles(
    'SUPER_ADMIN',
    'SCHOOL_ADMIN',
    'PRINCIPAL',
    'TEACHER',
    'PARENT',
    'STUDENT',
  )
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Upload an official student document' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
        documentType: {
          type: 'string',
          enum: [
            'AADHAAR_CARD',
            'BIRTH_CERTIFICATE',
            'TRANSFER_CERTIFICATE',
            'MARK_SHEET',
            'MIGRATION_CERTIFICATE',
            'MEDICAL_CERTIFICATE',
            'PHOTO',
            'OTHER',
          ],
        },
      },
    },
  })
  async uploadDocument(
    @Request() req: any,
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
    @Body('documentType') documentType: DocumentType,
  ) {
    const schoolId = req.user.schoolId;
    const uploadedById = req.user.id;
    return this.studentsService.uploadStudentDocument(
      schoolId,
      id,
      file,
      documentType,
      uploadedById,
    );
  }

  @Get(':id/documents')
  @Roles(
    'SUPER_ADMIN',
    'SCHOOL_ADMIN',
    'PRINCIPAL',
    'TEACHER',
    'PARENT',
    'STUDENT',
  )
  @ApiOperation({ summary: 'List all documents for a student' })
  async getDocuments(@Request() req: any, @Param('id') id: string) {
    const schoolId = req.user.schoolId;
    return this.studentsService.getStudentDocuments(schoolId, id);
  }

  @Get(':id/documents/:docId/download')
  @Roles(
    'SUPER_ADMIN',
    'SCHOOL_ADMIN',
    'PRINCIPAL',
    'TEACHER',
    'PARENT',
    'STUDENT',
  )
  @ApiOperation({
    summary: 'Securely download an authenticated student document',
  })
  async downloadDocument(
    @Request() req: any,
    @Param('id') id: string,
    @Param('docId') docId: string,
    @Res() res: Response,
  ) {
    const schoolId = req.user.schoolId;
    const { doc, fileStreamResult } =
      await this.studentsService.getStudentDocumentStream(
        schoolId,
        id,
        docId,
        req.user,
      );

    res.setHeader(
      'Content-Type',
      doc.mimeType || fileStreamResult.mimeType || 'application/octet-stream',
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${encodeURIComponent(doc.fileName)}"`,
    );
    if (fileStreamResult.fileSize) {
      res.setHeader('Content-Length', fileStreamResult.fileSize.toString());
    }

    fileStreamResult.stream.pipe(res);
  }

  @Delete(':id/documents/:docId')
  @Roles('SUPER_ADMIN', 'SCHOOL_ADMIN', 'PRINCIPAL')
  @ApiOperation({ summary: 'Delete a student document' })
  async deleteDocument(
    @Request() req: any,
    @Param('id') id: string,
    @Param('docId') docId: string,
  ) {
    const schoolId = req.user.schoolId;
    return this.studentsService.deleteStudentDocument(schoolId, id, docId);
  }
}
