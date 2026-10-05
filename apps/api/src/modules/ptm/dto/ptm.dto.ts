import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEnum,
  IsArray,
  IsNumber,
  Min,
  Max,
  Matches,
} from 'class-validator';
import { Type } from 'class-transformer';

export enum PtmModeEnum {
  IN_PERSON = 'IN_PERSON',
  VIRTUAL = 'VIRTUAL',
}

export class CreatePtmSessionDto {
  @IsString()
  @IsNotEmpty()
  title: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsNotEmpty()
  date: string; // YYYY-MM-DD

  @IsString()
  @Matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, {
    message: 'startTime must be in HH:mm format',
  })
  startTime: string;

  @IsString()
  @Matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, {
    message: 'endTime must be in HH:mm format',
  })
  endTime: string;

  @IsNumber()
  @IsOptional()
  @Min(5)
  @Max(60)
  @Type(() => Number)
  slotDuration?: number;

  @IsEnum(PtmModeEnum)
  @IsOptional()
  mode?: PtmModeEnum;

  @IsString()
  @IsOptional()
  meetingLink?: string;

  @IsString()
  @IsOptional()
  location?: string;

  @IsString()
  @IsOptional()
  classId?: string;

  @IsArray()
  @IsString({ each: true })
  teacherIds: string[];
}

export class BookPtmSlotDto {
  @IsString()
  @IsNotEmpty()
  studentId: string;

  @IsString()
  @IsOptional()
  parentNotes?: string;
}

export class CompletePtmSlotDto {
  @IsString()
  @IsNotEmpty()
  teacherNotes: string;

  @IsString()
  @IsOptional()
  actionItems?: string;
}
