import {
  IsString,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsEmail,
  IsIn,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export class UpsertAlumniProfileDto {
  @IsString()
  @IsNotEmpty()
  studentId: string;

  @IsNumber()
  @Min(1950)
  @Type(() => Number)
  graduationYear: number;

  @IsString()
  @IsOptional()
  currentStatus?: string; // EMPLOYED, HIGHER_STUDIES, ENTREPRENEUR, OTHER

  @IsString()
  @IsOptional()
  higherEducationInst?: string;

  @IsString()
  @IsOptional()
  degree?: string;

  @IsString()
  @IsOptional()
  company?: string;

  @IsString()
  @IsOptional()
  designation?: string;

  @IsString()
  @IsOptional()
  linkedInUrl?: string;

  @IsString()
  @IsOptional()
  phone?: string;

  @IsEmail()
  @IsOptional()
  email?: string;

  @IsString()
  @IsOptional()
  city?: string;

  @IsString()
  @IsOptional()
  country?: string;
}

export class CreateTranscriptRequestDto {
  @IsString()
  @IsNotEmpty()
  studentId: string;

  @IsString()
  @IsNotEmpty()
  purpose: string; // e.g. "Higher Studies", "Foreign University Admission", "Employment"

  @IsString()
  @IsIn(['DIGITAL', 'POSTAL'])
  @IsOptional()
  deliveryMode?: string;
}

export class UpdateTranscriptRequestStatusDto {
  @IsString()
  @IsIn(['PROCESSING', 'DISPATCHED', 'COMPLETED', 'REJECTED'])
  status: string;

  @IsString()
  @IsOptional()
  documentUrl?: string;

  @IsString()
  @IsOptional()
  trackingNumber?: string;

  @IsString()
  @IsOptional()
  remarks?: string;
}

export class AlumniSelfRegisterDto {
  @IsString()
  @IsNotEmpty()
  admissionNumber: string;

  @IsNumber()
  @Min(1950)
  @Type(() => Number)
  graduationYear: number;

  @IsString()
  @IsOptional()
  currentStatus?: string;

  @IsString()
  @IsOptional()
  higherEducationInst?: string;

  @IsString()
  @IsOptional()
  degree?: string;

  @IsString()
  @IsOptional()
  company?: string;

  @IsString()
  @IsOptional()
  designation?: string;

  @IsString()
  @IsOptional()
  linkedInUrl?: string;

  @IsString()
  @IsOptional()
  phone?: string;

  @IsEmail()
  @IsOptional()
  email?: string;

  @IsString()
  @IsOptional()
  city?: string;

  @IsString()
  @IsOptional()
  country?: string;
}
