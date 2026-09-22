import { IsString, IsNotEmpty, IsOptional, IsBoolean } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateTeacherAssignmentDto {
  @ApiProperty({
    description: 'Faculty / Staff ID',
  })
  @IsString()
  @IsNotEmpty()
  staffId: string;

  @ApiProperty({
    description: 'Target Section ID',
  })
  @IsString()
  @IsNotEmpty()
  sectionId: string;

  @ApiPropertyOptional({
    description: 'Canonical School Subject Offering ID',
  })
  @IsString()
  @IsOptional()
  schoolSubjectOfferingId?: string;

  @ApiPropertyOptional({
    description: 'Legacy Subject ID (bridged automatically if omitted)',
  })
  @IsString()
  @IsOptional()
  subjectId?: string;

  @ApiPropertyOptional({
    description: 'Target Academic Year ID (defaults to active session)',
  })
  @IsString()
  @IsOptional()
  academicYearId?: string;

  @ApiPropertyOptional({
    description:
      'Designate this teacher as the primary Class Teacher for the section',
    default: false,
  })
  @IsBoolean()
  @IsOptional()
  isClassTeacher?: boolean;
}

export class UpdateTeacherAssignmentDto {
  @ApiPropertyOptional({
    description: 'Reassigned Faculty / Staff ID',
  })
  @IsString()
  @IsOptional()
  staffId?: string;

  @ApiPropertyOptional({
    description: 'Updated Canonical School Subject Offering ID',
  })
  @IsString()
  @IsOptional()
  schoolSubjectOfferingId?: string;

  @ApiPropertyOptional({
    description: 'Updated Legacy Subject ID',
  })
  @IsString()
  @IsOptional()
  subjectId?: string;

  @ApiPropertyOptional({
    description:
      'Designate this teacher as the primary Class Teacher for the section',
  })
  @IsBoolean()
  @IsOptional()
  isClassTeacher?: boolean;
}
