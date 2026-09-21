import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsInt,
  Min,
  Max,
  IsArray,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateClassDto {
  @ApiProperty({
    description: 'Name of the class (e.g. Class 10, Grade 5)',
    example: 'Class 10',
  })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiPropertyOptional({
    description: 'Numeric grade level (1-12)',
    example: 10,
  })
  @IsInt()
  @Min(1)
  @Max(12)
  @IsOptional()
  numericLevel?: number;

  @ApiPropertyOptional({
    description: 'Target Academic Year ID (defaults to school active session)',
  })
  @IsString()
  @IsOptional()
  academicYearId?: string;

  @ApiPropertyOptional({
    description: 'Initial sections to create with this class',
    example: ['A', 'B'],
  })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  sections?: string[];
}

export class UpdateClassDto {
  @ApiPropertyOptional({
    description: 'Name of the class',
    example: 'Class 10',
  })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiPropertyOptional({
    description: 'Numeric grade level (1-12)',
    example: 10,
  })
  @IsInt()
  @Min(1)
  @Max(12)
  @IsOptional()
  numericLevel?: number;
}

export class CreateSectionDto {
  @ApiProperty({
    description: 'Section identifier name (e.g. A, B, Ruby, Rose)',
    example: 'A',
  })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiPropertyOptional({
    description: 'Maximum student capacity',
    default: 40,
    example: 40,
  })
  @IsInt()
  @Min(1)
  @Max(200)
  @IsOptional()
  capacity?: number;

  @ApiPropertyOptional({
    description: 'Classroom / Room Number',
    example: 'Room-101',
  })
  @IsString()
  @IsOptional()
  roomNumber?: string;
}

export class UpdateSectionDto {
  @ApiPropertyOptional({
    description: 'Section identifier name',
    example: 'A',
  })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiPropertyOptional({
    description: 'Maximum student capacity',
    example: 45,
  })
  @IsInt()
  @Min(1)
  @Max(200)
  @IsOptional()
  capacity?: number;

  @ApiPropertyOptional({
    description: 'Classroom / Room Number',
    example: 'Room-102',
  })
  @IsString()
  @IsOptional()
  roomNumber?: string;
}
