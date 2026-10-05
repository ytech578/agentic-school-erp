import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsNumber,
  IsBoolean,
  IsDateString,
  IsArray,
  ValidateNested,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateExamDto {
  @ApiProperty({
    description: 'Exam name',
    example: 'Mid-Term Examination 2026',
  })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ description: 'Exam type', example: 'MID_TERM' })
  @IsString()
  @IsNotEmpty()
  examType: string;

  @ApiProperty({
    description: 'Start date (ISO format)',
    example: '2026-10-01',
  })
  @IsDateString()
  @IsNotEmpty()
  startDate: string;

  @ApiProperty({ description: 'End date (ISO format)', example: '2026-10-10' })
  @IsDateString()
  @IsNotEmpty()
  endDate: string;

  @ApiPropertyOptional({
    description:
      'Target Academic Year ID (defaults to active session if omitted)',
  })
  @IsString()
  @IsOptional()
  academicYearId?: string;
}

export class UpdateExamDto {
  @ApiPropertyOptional({ description: 'Exam name' })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiPropertyOptional({ description: 'Exam type' })
  @IsString()
  @IsOptional()
  examType?: string;

  @ApiPropertyOptional({ description: 'Start date (ISO format)' })
  @IsDateString()
  @IsOptional()
  startDate?: string;

  @ApiPropertyOptional({ description: 'End date (ISO format)' })
  @IsDateString()
  @IsOptional()
  endDate?: string;
}

export class AddExamSubjectDto {
  @ApiProperty({ description: 'Target Class ID', example: 'class-123' })
  @IsString()
  @IsNotEmpty()
  classId: string;

  @ApiPropertyOptional({
    description:
      'Canonical School Subject Offering ID (preferred course reference)',
  })
  @IsString()
  @IsOptional()
  schoolSubjectOfferingId?: string;

  @ApiPropertyOptional({
    description:
      'Legacy Subject ID (compatibility bridge, auto-resolved if offering provided)',
  })
  @IsString()
  @IsOptional()
  subjectId?: string;

  @ApiProperty({ description: 'Maximum marks', example: 100 })
  @IsNumber()
  @Min(1)
  maxMarks: number;

  @ApiProperty({ description: 'Passing marks', example: 35 })
  @IsNumber()
  @Min(0)
  passMarks: number;

  @ApiPropertyOptional({ description: 'Exam date (ISO string)' })
  @IsDateString()
  @IsOptional()
  examDate?: string;

  @ApiPropertyOptional({
    description: 'Exam duration in minutes',
    example: 180,
  })
  @IsNumber()
  @Min(1)
  @IsOptional()
  duration?: number;
}

export class StudentMarkEntryDto {
  @ApiProperty({ description: 'Student ID', example: 'student-123' })
  @IsString()
  @IsNotEmpty()
  studentId: string;

  @ApiPropertyOptional({ description: 'Marks obtained', example: 85 })
  @IsNumber()
  @IsOptional()
  marksObtained?: number;

  @ApiPropertyOptional({
    description: 'Whether student was absent',
    default: false,
  })
  @IsBoolean()
  @IsOptional()
  isAbsent?: boolean;

  @ApiPropertyOptional({ description: 'Optional feedback / remarks' })
  @IsString()
  @IsOptional()
  remarks?: string;
}

export class EnterMarksDto {
  @ApiProperty({
    description: 'List of student marks',
    type: [StudentMarkEntryDto],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => StudentMarkEntryDto)
  marks: StudentMarkEntryDto[];
}
