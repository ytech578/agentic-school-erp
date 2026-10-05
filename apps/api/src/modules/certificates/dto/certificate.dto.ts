import {
  IsString,
  IsEnum,
  IsOptional,
  IsBoolean,
  IsNotEmpty,
} from 'class-validator';

export enum CertificateTypeEnum {
  TRANSFER_CERTIFICATE = 'TRANSFER_CERTIFICATE',
  BONAFIDE = 'BONAFIDE',
  CHARACTER = 'CHARACTER',
  STUDY_CONDUCT = 'STUDY_CONDUCT',
  MERIT = 'MERIT',
  SPORTS = 'SPORTS',
}

export class CreateCertificateTemplateDto {
  @IsEnum(CertificateTypeEnum)
  type: CertificateTypeEnum;

  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsOptional()
  headerText?: string;

  @IsString()
  @IsNotEmpty()
  bodyTemplate: string;

  @IsString()
  @IsOptional()
  footerText?: string;

  @IsString()
  @IsOptional()
  signatoryTitle?: string;

  @IsBoolean()
  @IsOptional()
  includeQrCode?: boolean;
}

export class IssueCertificateDto {
  @IsString()
  @IsNotEmpty()
  studentId: string;

  @IsEnum(CertificateTypeEnum)
  @IsOptional()
  type?: CertificateTypeEnum;

  @IsString()
  @IsOptional()
  templateId?: string;

  @IsString()
  @IsOptional()
  reason?: string;

  @IsString()
  @IsOptional()
  leavingReason?: string;

  @IsString()
  @IsOptional()
  conductRemark?: string;

  @IsString()
  @IsOptional()
  remarks?: string;
}

export class RevokeCertificateDto {
  @IsString()
  @IsNotEmpty()
  reason: string;
}

export class UpdateCertificateTemplateDto {
  @IsEnum(CertificateTypeEnum)
  @IsOptional()
  type?: CertificateTypeEnum;

  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  headerText?: string;

  @IsString()
  @IsOptional()
  bodyTemplate?: string;

  @IsString()
  @IsOptional()
  footerText?: string;

  @IsString()
  @IsOptional()
  signatoryTitle?: string;

  @IsBoolean()
  @IsOptional()
  includeQrCode?: boolean;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

export class BulkIssueCertificateDto {
  @IsString({ each: true })
  studentIds: string[];

  @IsEnum(CertificateTypeEnum)
  @IsOptional()
  type?: CertificateTypeEnum;

  @IsString()
  @IsOptional()
  templateId?: string;

  @IsString()
  @IsOptional()
  reason?: string;

  @IsString()
  @IsOptional()
  conductRemark?: string;

  @IsString()
  @IsOptional()
  remarks?: string;
}
