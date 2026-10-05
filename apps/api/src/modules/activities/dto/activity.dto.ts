import {
  IsString,
  IsNotEmpty,
  IsDateString,
  IsOptional,
  IsEnum,
  MaxLength,
  MinLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum ActivityCategory {
  ACADEMIC = 'ACADEMIC',
  SPORTS = 'SPORTS',
  CULTURAL = 'CULTURAL',
  ACHIEVEMENT = 'ACHIEVEMENT',
  DISCIPLINARY = 'DISCIPLINARY',
  OTHER = 'OTHER',
}

export class CreateActivityDto {
  @ApiProperty({ description: 'Student ID to log the activity for' })
  @IsString()
  @IsNotEmpty()
  studentId: string;

  @ApiProperty({ description: 'Title of the activity or achievement', maxLength: 255 })
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(255)
  title: string;

  @ApiProperty({ description: 'Event name or type (e.g. Science Olympiad, PTM)' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  event: string;

  @ApiProperty({ description: 'Date of the activity (ISO 8601 format)' })
  @IsDateString()
  date: string;

  @ApiPropertyOptional({ description: 'Optional description or notes' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @ApiPropertyOptional({
    description: 'Activity category/icon',
    enum: ActivityCategory,
    default: ActivityCategory.ACADEMIC,
  })
  @IsOptional()
  @IsEnum(ActivityCategory)
  category?: ActivityCategory;
}

export class UpdateActivityDto {
  @ApiPropertyOptional({ description: 'Updated title' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(255)
  title?: string;

  @ApiPropertyOptional({ description: 'Updated event name' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  event?: string;

  @ApiPropertyOptional({ description: 'Updated date (ISO 8601 format)' })
  @IsOptional()
  @IsDateString()
  date?: string;

  @ApiPropertyOptional({ description: 'Updated description' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @ApiPropertyOptional({ enum: ActivityCategory })
  @IsOptional()
  @IsEnum(ActivityCategory)
  category?: ActivityCategory;

  @ApiPropertyOptional({ description: 'Reassign to a different student' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  studentId?: string;
}

export class ActivityQueryDto {
  @ApiPropertyOptional({ description: 'Filter by student ID' })
  @IsOptional()
  @IsString()
  studentId?: string;
}
