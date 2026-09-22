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
  @ApiProperty({
    description: 'ID of the Board (e.g. CBSE, CISCE, STATE_AP, STATE_TS)',
  })
  @IsString()
  @IsNotEmpty()
  boardId: string;

  @ApiProperty({
    description: 'ID of the Curriculum Version (e.g. CBSE_2026, AP_SSC_2026)',
  })
  @IsString()
  @IsNotEmpty()
  curriculumId: string;

  @ApiPropertyOptional({
    description: 'Academic Year ID to initialize offerings for',
  })
  @IsString()
  @IsOptional()
  academicYearId?: string;
}

export class CreateSchoolOfferingDto {
  @ApiPropertyOptional({
    description: 'Curriculum Subject ID if sourcing from standard curriculum',
  })
  @IsString()
  @IsOptional()
  curriculumSubjectId?: string;

  @ApiPropertyOptional({ description: 'Global Subject ID' })
  @IsString()
  @IsOptional()
  globalSubjectId?: string;

  @ApiPropertyOptional({
    description: 'Custom subject name for SCHOOL_CUSTOM subjects',
  })
  @IsString()
  @IsOptional()
  customName?: string;

  @ApiPropertyOptional({ description: 'Custom subject code' })
  @IsString()
  @IsOptional()
  customCode?: string;

  @ApiPropertyOptional({
    enum: OfferingSource,
    default: OfferingSource.CURRICULUM,
  })
  @IsEnum(OfferingSource)
  @IsOptional()
  source?: OfferingSource;

  @ApiProperty({ description: 'Starting class level (1-12)' })
  @IsInt()
  @Min(1)
  @Max(12)
  gradeFrom: number;

  @ApiProperty({ description: 'Ending class level (1-12)' })
  @IsInt()
  @Min(1)
  @Max(12)
  gradeTo: number;

  @ApiPropertyOptional({ description: 'Periods per week', default: 5 })
  @IsInt()
  @Min(1)
  @Max(20)
  @IsOptional()
  periodsPerWeek?: number;

  @ApiPropertyOptional({
    enum: SubjectClassification,
    default: SubjectClassification.CORE,
  })
  @IsEnum(SubjectClassification)
  @IsOptional()
  subjectType?: SubjectClassification;

  @ApiPropertyOptional({
    enum: SubjectSelectionType,
    default: SubjectSelectionType.MANDATORY,
  })
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

export class UpdateOfferingStatusDto {
  @ApiProperty({ description: 'Offering active status', example: true })
  @IsBoolean()
  isOffered: boolean;
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

export class CreateBoardDto {
  @ApiProperty({ description: 'Official Name of Education Board (e.g. CBSE)' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ description: 'Unique Board Code (e.g. CBSE, CISCE)' })
  @IsString()
  @IsNotEmpty()
  code: string;

  @ApiPropertyOptional({ enum: ['CBSE', 'CISCE', 'STATE'], default: 'CBSE' })
  @IsOptional()
  category?: 'CBSE' | 'CISCE' | 'STATE';

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  description?: string;
}

export class UpdateBoardDto {
  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  name?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  code?: string;

  @ApiPropertyOptional({ enum: ['CBSE', 'CISCE', 'STATE'] })
  @IsOptional()
  category?: 'CBSE' | 'CISCE' | 'STATE';

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

export class CreateCurriculumDto {
  @ApiProperty({ description: 'Parent Board ID' })
  @IsString()
  @IsNotEmpty()
  boardId: string;

  @ApiProperty({ description: 'Curriculum Name' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ description: 'Unique Curriculum Code' })
  @IsString()
  @IsNotEmpty()
  code: string;

  @ApiProperty({ description: 'Version / Year descriptor (e.g. 2026-27)' })
  @IsString()
  @IsNotEmpty()
  version: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  description?: string;
}

export class UpdateCurriculumDto {
  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  name?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  version?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

export class CreateSubjectGroupDto {
  @ApiProperty({
    description: 'Subject Group Name (e.g. Compulsory Languages)',
  })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ description: 'Subject Group Code (e.g. GRP_LANG)' })
  @IsString()
  @IsNotEmpty()
  code: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({ default: 0 })
  @IsInt()
  @Min(0)
  @IsOptional()
  minSelection?: number;

  @ApiPropertyOptional()
  @IsInt()
  @Min(0)
  @IsOptional()
  maxSelection?: number;

  @ApiPropertyOptional()
  @IsInt()
  @Min(0)
  @IsOptional()
  minSubjects?: number;

  @ApiPropertyOptional()
  @IsInt()
  @Min(0)
  @IsOptional()
  maxSubjects?: number;

  @ApiPropertyOptional({ default: true })
  @IsBoolean()
  @IsOptional()
  isRequired?: boolean;

  @ApiPropertyOptional({ default: 0 })
  @IsInt()
  @IsOptional()
  sortOrder?: number;
}

export class UpdateSubjectGroupDto {
  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  name?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional()
  @IsInt()
  @Min(0)
  @IsOptional()
  minSelection?: number;

  @ApiPropertyOptional()
  @IsInt()
  @Min(0)
  @IsOptional()
  maxSelection?: number;

  @ApiPropertyOptional()
  @IsInt()
  @Min(0)
  @IsOptional()
  minSubjects?: number;

  @ApiPropertyOptional()
  @IsInt()
  @Min(0)
  @IsOptional()
  maxSubjects?: number;

  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  isRequired?: boolean;

  @ApiPropertyOptional()
  @IsInt()
  @IsOptional()
  sortOrder?: number;
}
