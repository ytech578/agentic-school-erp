import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  Res,
} from '@nestjs/common';
import { PayrollService } from './payroll.service';
import {
  UpsertSalaryStructureDto,
  CreatePayrollCycleDto,
  ProcessPayrollCycleDto,
  MarkPayslipPaidDto,
} from './dto/payroll.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../core/guards/roles.guard';
import { Roles } from '../../core/decorators/roles.decorator';
import { ApiBearerAuth, ApiTags, ApiOperation } from '@nestjs/swagger';

@ApiTags('Payroll')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('payroll')
export class PayrollController {
  constructor(private readonly payrollService: PayrollService) {}

  // ─── SALARY STRUCTURES ────────────────────────────────────────────────────

  @Post('salary-structures/:staffId')
  @Roles('SUPER_ADMIN', 'SCHOOL_ADMIN', 'PRINCIPAL')
  @ApiOperation({ summary: 'Configure or update staff salary structure' })
  upsertSalaryStructure(
    @Request() req: any,
    @Param('staffId') staffId: string,
    @Body() dto: UpsertSalaryStructureDto,
  ) {
    return this.payrollService.upsertSalaryStructure(
      req.user.schoolId,
      staffId,
      dto,
    );
  }

  @Get('salary-structures/:staffId')
  @Roles('SUPER_ADMIN', 'SCHOOL_ADMIN', 'PRINCIPAL')
  @ApiOperation({ summary: 'Get staff salary structure' })
  getSalaryStructure(@Request() req: any, @Param('staffId') staffId: string) {
    return this.payrollService.getSalaryStructure(req.user.schoolId, staffId);
  }

  @Get('salary-structures')
  @Roles('SUPER_ADMIN', 'SCHOOL_ADMIN', 'PRINCIPAL')
  @ApiOperation({ summary: 'List all salary structures in this school' })
  listSalaryStructures(@Request() req: any) {
    return this.payrollService.listSalaryStructures(req.user.schoolId);
  }

  // ─── PAYROLL CYCLES ───────────────────────────────────────────────────────

  @Post('cycles')
  @Roles('SUPER_ADMIN', 'SCHOOL_ADMIN', 'PRINCIPAL')
  @ApiOperation({ summary: 'Create a new monthly payroll cycle' })
  createPayrollCycle(@Request() req: any, @Body() dto: CreatePayrollCycleDto) {
    return this.payrollService.createPayrollCycle(req.user.schoolId, dto);
  }

  @Get('cycles')
  @Roles('SUPER_ADMIN', 'SCHOOL_ADMIN', 'PRINCIPAL')
  @ApiOperation({ summary: 'List payroll cycles' })
  listPayrollCycles(@Request() req: any) {
    return this.payrollService.listPayrollCycles(req.user.schoolId);
  }

  @Get('cycles/:id')
  @Roles('SUPER_ADMIN', 'SCHOOL_ADMIN', 'PRINCIPAL')
  @ApiOperation({ summary: 'Get payroll cycle with generated payslips' })
  getPayrollCycle(@Request() req: any, @Param('id') id: string) {
    return this.payrollService.getPayrollCycle(req.user.schoolId, id);
  }

  @Post('cycles/:id/process')
  @Roles('SUPER_ADMIN', 'SCHOOL_ADMIN', 'PRINCIPAL')
  @ApiOperation({
    summary: 'Process monthly payroll cycle and generate payslips',
  })
  processPayrollCycle(
    @Request() req: any,
    @Param('id') id: string,
    @Body() dto: ProcessPayrollCycleDto,
  ) {
    return this.payrollService.processPayrollCycle(
      req.user.schoolId,
      id,
      req.user.id,
      dto,
    );
  }

  // ─── PAYSLIPS ─────────────────────────────────────────────────────────────

  @Get('payslips')
  @Roles('SUPER_ADMIN', 'SCHOOL_ADMIN', 'PRINCIPAL')
  @ApiOperation({
    summary: 'List all payslips across the school with filtering',
  })
  listAllPayslips(
    @Request() req: any,
    @Query('month') month?: string,
    @Query('year') year?: string,
    @Query('cycleId') cycleId?: string,
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.payrollService.listAllPayslips(req.user.schoolId, {
      month: month ? parseInt(month, 10) : undefined,
      year: year ? parseInt(year, 10) : undefined,
      cycleId,
      search,
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }

  @Get('payslips/:id')
  @ApiOperation({ summary: 'Get payslip (Staff self or Admin)' })
  getPayslip(@Request() req: any, @Param('id') id: string) {
    return this.payrollService.getPayslip(
      req.user.schoolId,
      id,
      req.user.id,
      req.user.role,
    );
  }

  @Get('staff/:staffId/payslips')
  @ApiOperation({ summary: 'Get all payslips for a staff member' })
  getStaffPayslips(@Request() req: any, @Param('staffId') staffId: string) {
    return this.payrollService.getStaffPayslips(
      req.user.schoolId,
      staffId,
      req.user.id,
      req.user.role,
    );
  }

  @Get('payslips/:id/download')
  @ApiOperation({ summary: 'Download official payslip PDF document' })
  async downloadPayslip(
    @Request() req: any,
    @Param('id') id: string,
    @Res() res: any,
  ) {
    const { buffer, fileName } = await this.payrollService.generatePayslipPdf(
      req.user.schoolId,
      id,
      req.user.id,
      req.user.role,
    );

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.setHeader('Content-Length', buffer.length);
    return res.end(buffer);
  }

  @Put('payslips/:id/pay')
  @Roles('SUPER_ADMIN', 'SCHOOL_ADMIN', 'PRINCIPAL')
  @ApiOperation({ summary: 'Mark payslip as disbursed/paid' })
  markPayslipPaid(
    @Request() req: any,
    @Param('id') id: string,
    @Body() dto: MarkPayslipPaidDto,
  ) {
    return this.payrollService.markPayslipPaid(req.user.schoolId, id, dto);
  }

  @Get('cycles/:id/export-neft')
  @Roles('SUPER_ADMIN', 'SCHOOL_ADMIN', 'PRINCIPAL')
  @ApiOperation({ summary: 'Export bulk NEFT bank disbursement CSV' })
  async exportNeft(
    @Request() req: any,
    @Param('id') id: string,
    @Res() res: any,
  ) {
    const { csv, fileName } = await this.payrollService.exportNeftCsv(
      req.user.schoolId,
      id,
    );

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    return res.end(csv);
  }

  @Get('staff/:staffId/form16')
  @ApiOperation({ summary: 'Generate Form 16 annual TDS summary' })
  getForm16(
    @Request() req: any,
    @Param('staffId') staffId: string,
    @Query('financialYear') financialYear: string,
  ) {
    return this.payrollService.generateForm16Summary(
      req.user.schoolId,
      staffId,
      financialYear ||
        `${new Date().getFullYear() - 1}-${new Date().getFullYear()}`,
    );
  }
}
