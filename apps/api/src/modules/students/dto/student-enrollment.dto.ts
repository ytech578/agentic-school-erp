import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEnum,
  IsDateString,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { EnrollmentStatus } from '@prisma/client';

export class CreateStudentEnrollmentDto {
  @ApiProperty({
    description: 'Student ID',
  })
  @IsString()
  @IsNotEmpty()
  studentId: string;

  @ApiProperty({
    description: 'Target Section ID',
  })
  @IsString()
  @IsNotEmpty()
  sectionId: string;

  @ApiPropertyOptional({
    description: 'Target Academic Year ID (defaults to section class academic year)',
  })
  @IsString()
  @IsOptional()
  academicYearId?: string;

  @ApiPropertyOptional({
    description: 'Student Roll Number in this section',
    example: '10-A-01',
  })
  @IsString()
  @IsOptional()
  rollNumber?: string;
}

export class UpdateEnrollmentStatusDto {
  @ApiProperty({
    enum: EnrollmentStatus,
    description: 'Status of the student enrollment',
    example: EnrollmentStatus.ACTIVE,
  })
  @IsEnum(EnrollmentStatus)
  status: EnrollmentStatus;

  @ApiPropertyOptional({
    description: 'Student Roll Number in this section',
  })
  @IsString()
  @IsOptional()
  rollNumber?: string;

  @ApiPropertyOptional({
    description: 'Date student left the section (if status changed to TRANSFERRED, DROPPED, GRADUATED)',
  })
  @IsDateString()
  @IsOptional()
  leftAt?: string;
}
