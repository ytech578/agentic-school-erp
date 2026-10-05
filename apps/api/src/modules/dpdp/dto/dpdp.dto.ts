import {
  IsString,
  IsNotEmpty,
  IsBoolean,
  IsOptional,
  IsIn,
} from 'class-validator';

export class GrantConsentDto {
  @IsString()
  @IsNotEmpty()
  studentId: string;

  @IsString()
  @IsIn([
    'ACADEMIC_RECORDS',
    'BIOMETRIC_ATTENDANCE',
    'HEALTH_DATA',
    'MEDIA_PHOTOS',
    'AI_PROFILING',
  ])
  consentType: string;

  @IsBoolean()
  isGranted: boolean;

  @IsString()
  @IsOptional()
  consentNoticeVersion?: string;
}

export class RecordParentalConsentDto extends GrantConsentDto {}

export class CreateDataPrivacyRequestDto {
  @IsString()
  @IsIn(['EXPORT_DATA', 'ERASURE', 'RECTIFICATION'])
  requestType: string;

  @IsString()
  @IsOptional()
  reason?: string;
}

export class ReviewPrivacyRequestDto {
  @IsString()
  @IsIn(['COMPLETED', 'REJECTED'])
  status: string;

  @IsString()
  @IsOptional()
  rejectionReason?: string;
}

export class UpdateDataPrivacyRequestStatusDto extends ReviewPrivacyRequestDto {
  @IsString()
  @IsOptional()
  exportDownloadUrl?: string;
}
