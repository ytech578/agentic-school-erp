import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEnum,
  IsBoolean,
  IsDateString,
} from 'class-validator';

export enum IncidentSeverityEnum {
  MINOR = 'MINOR',
  MODERATE = 'MODERATE',
  MAJOR = 'MAJOR',
  CRITICAL = 'CRITICAL',
}

export enum IncidentStatusEnum {
  REPORTED = 'REPORTED',
  INVESTIGATING = 'INVESTIGATING',
  IN_PROGRESS = 'IN_PROGRESS',
  RESOLVED = 'RESOLVED',
  APPEALED = 'APPEALED',
  CLOSED = 'CLOSED',
  ESCALATED = 'ESCALATED',
}

export class CreateIncidentDto {
  @IsString()
  @IsNotEmpty()
  studentId: string;

  @IsString()
  @IsOptional()
  title?: string;

  @IsString()
  @IsNotEmpty()
  description: string;

  @IsString()
  @IsNotEmpty()
  category: string;

  @IsEnum(IncidentSeverityEnum)
  @IsOptional()
  severity?: IncidentSeverityEnum;

  @IsDateString()
  @IsOptional()
  incidentDate?: string;

  @IsString()
  @IsOptional()
  location?: string;

  @IsString()
  @IsOptional()
  actionTaken?: string;

  @IsDateString()
  @IsOptional()
  actionExpiryDate?: string;

  @IsBoolean()
  @IsOptional()
  notifyParent?: boolean;

  @IsBoolean()
  @IsOptional()
  isConfidential?: boolean;
}

export class UpdateIncidentStatusDto {
  @IsEnum(IncidentStatusEnum)
  status: IncidentStatusEnum;

  @IsString()
  @IsOptional()
  actionTaken?: string;

  @IsString()
  @IsOptional()
  resolutionNotes?: string;

  @IsString()
  @IsOptional()
  resolution?: string;
}

export class NotifyParentDto {
  @IsString()
  @IsOptional()
  customMessage?: string;

  @IsString()
  @IsOptional()
  message?: string;
}

export class UpdateDisciplineIncidentDto {
  @IsString()
  @IsOptional()
  title?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsOptional()
  category?: string;

  @IsEnum(IncidentSeverityEnum)
  @IsOptional()
  severity?: IncidentSeverityEnum;

  @IsDateString()
  @IsOptional()
  incidentDate?: string;

  @IsString()
  @IsOptional()
  location?: string;

  @IsString()
  @IsOptional()
  actionTaken?: string;

  @IsDateString()
  @IsOptional()
  actionExpiryDate?: string;

  @IsBoolean()
  @IsOptional()
  isConfidential?: boolean;
}

