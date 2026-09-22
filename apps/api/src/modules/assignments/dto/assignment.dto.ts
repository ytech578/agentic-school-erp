import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsNumber,
  IsBoolean,
  IsDateString,
  Min,
} from 'class-validator';

export class CreateAssignmentDto {
  @ApiProperty({ description: 'Assignment title', example: 'Quadratic Equations Homework' })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiPropertyOptional({ description: 'Assignment description or instructions' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({ description: 'Target Class ID', example: 'class-123' })
  @IsString()
  @IsNotEmpty()
  classId: string;

  @ApiPropertyOptional({
    description: 'Target Academic Year ID (defaults to active academic session if not provided)',
  })
  @IsString()
  @IsOptional()
  academicYearId?: string;

  @ApiPropertyOptional({ description: 'Target Section ID (optional, class-wide if omitted)' })
  @IsString()
  @IsOptional()
  sectionId?: string;

  @ApiPropertyOptional({
    description: 'Canonical School Subject Offering ID (preferred course reference)',
  })
  @IsString()
  @IsOptional()
  schoolSubjectOfferingId?: string;

  @ApiPropertyOptional({
    description: 'Legacy Subject ID (compatibility bridge, auto-resolved if offering provided)',
  })
  @IsString()
  @IsOptional()
  subjectId?: string;

  @ApiPropertyOptional({
    description: 'Staff ID creating the assignment (resolves to authenticated user staff if omitted)',
  })
  @IsString()
  @IsOptional()
  staffId?: string;

  @ApiProperty({ description: 'Due date (ISO string)', example: '2026-10-15T23:59:59.000Z' })
  @IsDateString()
  @IsNotEmpty()
  dueDate: string;

  @ApiPropertyOptional({ description: 'Maximum marks', example: 100, default: 10 })
  @IsNumber()
  @Min(1)
  @IsOptional()
  maxMarks?: number;
}

export class UpdateAssignmentDto {
  @ApiPropertyOptional({ description: 'Assignment title' })
  @IsString()
  @IsOptional()
  title?: string;

  @ApiPropertyOptional({ description: 'Assignment description or instructions' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({ description: 'Target Class ID' })
  @IsString()
  @IsOptional()
  classId?: string;

  @ApiPropertyOptional({ description: 'Target Academic Year ID' })
  @IsString()
  @IsOptional()
  academicYearId?: string;

  @ApiPropertyOptional({ description: 'Target Section ID' })
  @IsString()
  @IsOptional()
  sectionId?: string;

  @ApiPropertyOptional({ description: 'Canonical School Subject Offering ID' })
  @IsString()
  @IsOptional()
  schoolSubjectOfferingId?: string;

  @ApiPropertyOptional({ description: 'Legacy Subject ID' })
  @IsString()
  @IsOptional()
  subjectId?: string;

  @ApiPropertyOptional({ description: 'Staff ID' })
  @IsString()
  @IsOptional()
  staffId?: string;

  @ApiPropertyOptional({ description: 'Due date (ISO string)' })
  @IsDateString()
  @IsOptional()
  dueDate?: string;

  @ApiPropertyOptional({ description: 'Maximum marks' })
  @IsNumber()
  @Min(1)
  @IsOptional()
  maxMarks?: number;

  @ApiPropertyOptional({ description: 'Whether assignment is active' })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

export class SubmitAssignmentDto {
  @ApiPropertyOptional({ description: 'Submission status', example: 'SUBMITTED' })
  @IsString()
  @IsOptional()
  status?: string;

  @ApiPropertyOptional({ description: 'Marks obtained', example: 85 })
  @IsNumber()
  @Min(0)
  @IsOptional()
  marksObtained?: number;

  @ApiPropertyOptional({ description: 'Teacher feedback' })
  @IsString()
  @IsOptional()
  feedback?: string;
}
