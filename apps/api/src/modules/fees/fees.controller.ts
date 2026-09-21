import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Query,
  Param,
  UseGuards,
  Request,
} from '@nestjs/common';
import { FeesService } from './fees.service';
import { CreateFeeStructureInput, CollectFeeInput } from '@school-erp/shared';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../core/guards/roles.guard';
import { Roles } from '../../core/decorators/roles.decorator';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

@ApiTags('Fees')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('fees')
export class FeesController {
  constructor(private readonly feesService: FeesService) {}

  @Get('heads')
  @Roles('SUPER_ADMIN', 'SCHOOL_ADMIN', 'PRINCIPAL')
  getFeeHeads(@Request() req: any) {
    return this.feesService.getFeeHeads(req.user.schoolId);
  }

  @Post('heads')
  @Roles('SUPER_ADMIN', 'SCHOOL_ADMIN', 'PRINCIPAL')
  createFeeHead(
    @Request() req: any,
    @Body() data: { name: string; description?: string },
  ) {
    return this.feesService.createFeeHead(req.user.schoolId, data);
  }

  @Get('structures')
  @Roles('SUPER_ADMIN', 'SCHOOL_ADMIN', 'PRINCIPAL')
  getStructuresByClass(
    @Request() req: any,
    @Query('academicYearId') academicYearId: string,
    @Query('classId') classId: string,
  ) {
    return this.feesService.getStructuresByClass(
      req.user.schoolId,
      academicYearId,
      classId,
    );
  }

  @Post('structures')
  @Roles('SUPER_ADMIN', 'SCHOOL_ADMIN', 'PRINCIPAL')
  createOrUpdateStructure(
    @Request() req: any,
    @Body() data: CreateFeeStructureInput,
  ) {
    return this.feesService.createOrUpdateStructure(req.user.schoolId, data);
  }

  @Get('students')
  @Roles('SUPER_ADMIN', 'SCHOOL_ADMIN', 'PRINCIPAL')
  getStudentFeeSummary(
    @Request() req: any,
    @Query('academicYearId') academicYearId: string,
  ) {
    return this.feesService.getStudentFeeSummary(
      req.user.schoolId,
      academicYearId,
    );
  }

  @Post('collect')
  @Roles('SUPER_ADMIN', 'SCHOOL_ADMIN', 'PRINCIPAL')
  collectFee(@Request() req: any, @Body() data: CollectFeeInput) {
    return this.feesService.collectFee(req.user.schoolId, req.user.id, data);
  }

  @Get('analytics')
  @Roles('SUPER_ADMIN', 'SCHOOL_ADMIN', 'PRINCIPAL')
  getCashFlowAnalytics(
    @Request() req: any,
    @Query('academicYearId') academicYearId: string,
  ) {
    return this.feesService.getCashFlowAnalytics(
      req.user.schoolId,
      academicYearId,
    );
  }

  @Get('defaulters')
  @Roles('SUPER_ADMIN', 'SCHOOL_ADMIN', 'PRINCIPAL')
  getDefaulters(
    @Request() req: any,
    @Query('academicYearId') academicYearId: string,
  ) {
    return this.feesService.predictDefaulters(
      req.user.schoolId,
      academicYearId,
    );
  }

  @Get('parent/dues')
  @Roles('PARENT')
  getParentDues(@Request() req: any) {
    return this.feesService.getParentDues(req.user.schoolId, req.user.id);
  }

  @Post('parent/pay')
  @Roles('PARENT')
  processParentPayment(
    @Request() req: any,
    @Body()
    data: {
      studentId: string;
      amount: number;
      paymentMode: string;
      transactionRef?: string;
    },
  ) {
    return this.feesService.processParentPayment(
      req.user.schoolId,
      req.user.id,
      data,
    );
  }

  @Post('orders/create')
  @Roles('SUPER_ADMIN', 'SCHOOL_ADMIN', 'PRINCIPAL', 'PARENT', 'STUDENT')
  createOrder(
    @Request() req: any,
    @Body()
    data: { studentId: string; amount: number; academicYearId?: string },
  ) {
    return this.feesService.createRazorpayOrder(
      req.user.schoolId,
      data.studentId,
      data.amount,
      data.academicYearId,
    );
  }

  @Post('orders/verify')
  @Roles('SUPER_ADMIN', 'SCHOOL_ADMIN', 'PRINCIPAL', 'PARENT', 'STUDENT')
  verifyPayment(
    @Request() req: any,
    @Body()
    data: {
      orderId: string;
      paymentId: string;
      signature: string;
      studentId: string;
      amount: number;
      academicYearId?: string;
      remarks?: string;
    },
  ) {
    return this.feesService.verifyRazorpayPayment(
      req.user.schoolId,
      req.user.id,
      data,
    );
  }

  @Get('settings/payment')
  @Roles(
    'SUPER_ADMIN',
    'SCHOOL_ADMIN',
    'PRINCIPAL',
    'TEACHER',
    'PARENT',
    'STUDENT',
  )
  getPaymentSettings(@Request() req: any) {
    return this.feesService.getPaymentSettings(
      req.user.schoolId,
      req.user.role,
    );
  }

  @Put('settings/payment')
  @Roles('SUPER_ADMIN', 'SCHOOL_ADMIN', 'PRINCIPAL')
  updatePaymentSettings(
    @Request() req: any,
    @Body()
    data: {
      upiVpa: string;
      payeeName: string;
      qrCodeImageUrl?: string;
      accountNumber?: string;
      ifscCode?: string;
      bankName?: string;
      branch?: string;
      razorpayEnabled?: boolean;
      razorpayKeyId?: string;
      razorpayKeySecret?: string;
      preferredMode?: string;
      customInstructions?: string;
    },
  ) {
    return this.feesService.updatePaymentSettings(
      req.user.schoolId,
      req.user.id,
      data,
    );
  }

  @Get('receipts/:id')
  @Roles(
    'SUPER_ADMIN',
    'SCHOOL_ADMIN',
    'PRINCIPAL',
    'TEACHER',
    'PARENT',
    'STUDENT',
  )
  getReceiptDetails(@Request() req: any, @Param('id') id: string) {
    return this.feesService.getReceiptDetails(req.user.schoolId, id);
  }
}
