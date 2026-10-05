import {
  IsNumber,
  IsPositive,
  IsOptional,
  IsBoolean,
  Min,
  Max,
  IsString,
  IsIn,
  IsObject,
} from 'class-validator';
import { Type } from 'class-transformer';

export class UpsertSalaryStructureDto {
  @IsNumber()
  @IsPositive()
  @Type(() => Number)
  basicSalary: number;

  @IsNumber()
  @IsOptional()
  @Min(0)
  @Type(() => Number)
  da?: number;

  @IsNumber()
  @IsOptional()
  @Min(0)
  @Type(() => Number)
  hra?: number;

  @IsNumber()
  @IsOptional()
  @Min(0)
  @Type(() => Number)
  conveyance?: number;

  @IsNumber()
  @IsOptional()
  @Min(0)
  @Type(() => Number)
  medicalAllowance?: number;

  @IsNumber()
  @IsOptional()
  @Min(0)
  @Type(() => Number)
  specialAllowance?: number;

  @IsBoolean()
  @IsOptional()
  epfApplicable?: boolean;

  @IsBoolean()
  @IsOptional()
  epfEnrolled?: boolean;

  @IsBoolean()
  @IsOptional()
  esiApplicable?: boolean;

  @IsBoolean()
  @IsOptional()
  esiEnrolled?: boolean;

  @IsNumber()
  @IsOptional()
  @Min(0)
  @Type(() => Number)
  professionalTax?: number;

  @IsNumber()
  @IsOptional()
  @Min(0)
  @Type(() => Number)
  profTax?: number;

  @IsNumber()
  @IsOptional()
  @Min(0)
  @Type(() => Number)
  tdsMonthly?: number;
}

export class CreatePayrollCycleDto {
  @IsNumber()
  @Min(1)
  @Max(12)
  @Type(() => Number)
  month: number;

  @IsNumber()
  @Min(2020)
  @Max(2100)
  @Type(() => Number)
  year: number;

  @IsNumber()
  @IsOptional()
  @Min(1)
  @Max(31)
  @Type(() => Number)
  workingDays?: number;
}

export class ProcessPayrollCycleDto {
  @IsNumber()
  @IsOptional()
  @Min(1)
  @Max(31)
  @Type(() => Number)
  workingDays?: number;

  @IsOptional()
  @IsObject()
  unpaidLeaveDaysByStaff?: Record<string, number>;
}

export class MarkPayslipPaidDto {
  @IsString()
  @IsIn(['NEFT', 'RTGS', 'CHEQUE', 'UPI', 'CASH', 'BANK_TRANSFER'])
  paymentMethod: string;

  @IsString()
  @IsOptional()
  paymentRef?: string;

  @IsString()
  @IsOptional()
  remarks?: string;
}
