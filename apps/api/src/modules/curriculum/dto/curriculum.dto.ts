import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsBoolean,
  IsInt,
  IsEnum,
  IsArray,
  Min,
  Max,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  SubjectClassification,
  SubjectSelectionType,
  OfferingSource,
} from '@prisma/client';

export class InitializeCurriculumDto {
  @ApiProperty({ description: 'ID of the Board (e.g. CBSE, CISCE, STATE_AP, STATE_TS)' })
  @IsString()
  @IsNotEmpty()
  boardId: string;

  @ApiProperty({ description: 'ID of the Curriculum Version (e.g. CBSE_2026, AP_SSC_2026)' })
  @IsString()
  @IsNotEmpty()
  curriculumId: string;

  @ApiPropertyOptional({ description: 'Academic Year ID to initialize offerings for' })
  @IsString()
  @IsOptional()
  academicYearId?: string;
}

export class CreateSchoolOfferingDto {
  @ApiPropertyOptional({ description: 'Curriculum Subject ID if sourcing from standard curriculum' })
  @IsString()
  @IsOptional()
  curriculumSubjectId?: string;

  @ApiPropertyOptional({ description: 'Global Subject ID' })
  @IsString()
  @IsOptional()
  globalSubjectId?: string;

  @ApiPropertyOptional({ description: 'Custom subject name for SCHOOL_CUSTOM subjects' })
  @IsString()
  @IsOptional()
  customName?: string;

  @ApiPropertyOptional({ description: 'Custom subject code' })
  @IsString()
  @IsOptional()
  customCode?: string;

  @ApiPropertyOptional({ enum: OfferingSource, default: OfferingSource.CURRICULUM })
  @IsEnum(OfferingSource)
  @IsOptional()
  source?: OfferingSource;

  @ApiProperty({ description: 'Starting class level (1-10)' })
  @IsInt()
  @Min(1)
  @Max(10)
  gradeFrom: number;

  @ApiProperty({ description: 'Ending class level (1-10)' })
  @IsInt()
  @Min(1)
  @Max(10)
  gradeTo: number;

  @ApiPropertyOptional({ description: 'Periods per week', default: 5 })
  @IsInt()
  @Min(1)
  @Max(20)
  @IsOptional()
  periodsPerWeek?: number;

  @ApiPropertyOptional({ enum: SubjectClassification, default: SubjectClassification.CORE })
  @IsEnum(SubjectClassification)
  @IsOptional()
  subjectType?: SubjectClassification;

  @ApiPropertyOptional({ enum: SubjectSelectionType, default: SubjectSelectionType.MANDATORY })
  @IsEnum(SubjectSelectionType)
  @IsOptional()
  selectionType?: SubjectSelectionType;

  @ApiPropertyOptional({ default: true })
  @IsBoolean()
  @IsOptional()
  theoryEnabled?: boolean;

  @ApiPropertyOptional({ default: false })
  @IsBoolean()
  @IsOptional()
  practicalEnabled?: boolean;

  @ApiPropertyOptional({ default: false })
  @IsBoolean()
  @IsOptional()
  internalAssessmentEnabled?: boolean;

  @ApiPropertyOptional({ default: true })
  @IsBoolean()
  @IsOptional()
  examEnabled?: boolean;

  @ApiPropertyOptional({ default: 100 })
  @IsInt()
  @IsOptional()
  maxMarks?: number;

  @ApiPropertyOptional({ default: 35 })
  @IsInt()
  @IsOptional()
  passMarks?: number;
}

export class UpdateSchoolOfferingDto {
  @ApiPropertyOptional()
  @IsInt()
  @Min(1)
  @Max(20)
  @IsOptional()
  periodsPerWeek?: number;

  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  isOffered?: boolean;

  @ApiPropertyOptional({ enum: SubjectClassification })
  @IsEnum(SubjectClassification)
  @IsOptional()
  subjectType?: SubjectClassification;

  @ApiPropertyOptional({ enum: SubjectSelectionType })
  @IsEnum(SubjectSelectionType)
  @IsOptional()
  selectionType?: SubjectSelectionType;

  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  theoryEnabled?: boolean;

  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  practicalEnabled?: boolean;

  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  internalAssessmentEnabled?: boolean;

  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  examEnabled?: boolean;

  @ApiPropertyOptional()
  @IsInt()
  @IsOptional()
  maxMarks?: number;

  @ApiPropertyOptional()
  @IsInt()
  @IsOptional()
  passMarks?: number;
}

export class EnrollStudentSubjectsDto {
  @ApiProperty({
    description: 'Array of SchoolSubjectOffering IDs to enroll student in',
    type: [String],
  })
  @IsArray()
  @IsString({ each: true })
  offeringIds: string[];
}
