import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEmail,
  Length,
  Matches,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateSchoolDto {
  @ApiProperty({
    description: 'Official Name of the School',
    example: 'Delhi Public School',
  })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({
    description: 'Unique School Code identifier (alphanumeric)',
    example: 'DPS-DEL-01',
  })
  @IsString()
  @IsNotEmpty()
  @Length(2, 30)
  @Matches(/^[A-Za-z0-9_-]+$/, {
    message:
      'School code must be alphanumeric with optional dashes or underscores',
  })
  code: string;

  @ApiPropertyOptional({
    description: 'Educational Board Type',
    example: 'CBSE',
  })
  @IsString()
  @IsOptional()
  boardType?: string;

  @ApiPropertyOptional({
    description: 'Board Affiliation Number',
    example: 'CBSE/AFF/2026/0991',
  })
  @IsString()
  @IsOptional()
  affiliationNo?: string;

  @ApiPropertyOptional({ description: 'UDISE+ Code', example: '28100100201' })
  @IsString()
  @IsOptional()
  udiseCode?: string;

  @ApiPropertyOptional({
    description: 'Name of the Head of School / Principal',
    example: 'Dr. Ramesh Sharma',
  })
  @IsString()
  @IsOptional()
  principalName?: string;

  @ApiPropertyOptional({
    description: 'Official Phone Number',
    example: '+91 9876543210',
  })
  @IsString()
  @IsOptional()
  phone?: string;

  @ApiPropertyOptional({
    description: 'Official Email Address',
    example: 'admin@dpscampus.edu',
  })
  @IsEmail()
  @IsOptional()
  email?: string;

  @ApiPropertyOptional({
    description: 'Official Website URL',
    example: 'https://dpscampus.edu',
  })
  @IsString()
  @IsOptional()
  website?: string;

  @ApiPropertyOptional({
    description: 'Campus Street Address',
    example: 'Plot 42, Knowledge Park',
  })
  @IsString()
  @IsOptional()
  address?: string;

  @ApiPropertyOptional({ description: 'City', example: 'New Delhi' })
  @IsString()
  @IsOptional()
  city?: string;

  @ApiPropertyOptional({ description: 'State / Province', example: 'Delhi' })
  @IsString()
  @IsOptional()
  state?: string;

  @ApiPropertyOptional({ description: 'Postal / PIN Code', example: '110001' })
  @IsString()
  @IsOptional()
  pinCode?: string;

  @ApiPropertyOptional({
    description: 'Name of initial active academic year',
    example: '2026-2027',
  })
  @IsString()
  @IsOptional()
  academicYearName?: string;

  // Optional initial school admin account setup
  @ApiPropertyOptional({
    description: 'First name for initial school administrator',
    example: 'Sunita',
  })
  @IsString()
  @IsOptional()
  adminFirstName?: string;

  @ApiPropertyOptional({
    description: 'Last name for initial school administrator',
    example: 'Mehra',
  })
  @IsString()
  @IsOptional()
  adminLastName?: string;

  @ApiPropertyOptional({
    description: 'Email for initial school administrator login',
    example: 'admin.dps@schoolerp.in',
  })
  @IsEmail()
  @IsOptional()
  adminEmail?: string;

  @ApiPropertyOptional({
    description: 'Password for initial school administrator login',
    example: 'Admin@12345',
  })
  @IsString()
  @IsOptional()
  @Length(6, 100)
  adminPassword?: string;
}

export class UpdateSchoolDto {
  @ApiPropertyOptional({ description: 'Official Name of the School' })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiPropertyOptional({ description: 'Educational Board Type' })
  @IsString()
  @IsOptional()
  boardType?: string;

  @ApiPropertyOptional({ description: 'Board Affiliation Number' })
  @IsString()
  @IsOptional()
  affiliationNo?: string;

  @ApiPropertyOptional({ description: 'UDISE+ Code' })
  @IsString()
  @IsOptional()
  udiseCode?: string;

  @ApiPropertyOptional({ description: 'Principal Name' })
  @IsString()
  @IsOptional()
  principalName?: string;

  @ApiPropertyOptional({ description: 'Phone Number' })
  @IsString()
  @IsOptional()
  phone?: string;

  @ApiPropertyOptional({ description: 'Email Address' })
  @IsEmail()
  @IsOptional()
  email?: string;

  @ApiPropertyOptional({ description: 'Website URL' })
  @IsString()
  @IsOptional()
  website?: string;

  @ApiPropertyOptional({ description: 'Address' })
  @IsString()
  @IsOptional()
  address?: string;

  @ApiPropertyOptional({ description: 'City' })
  @IsString()
  @IsOptional()
  city?: string;

  @ApiPropertyOptional({ description: 'State' })
  @IsString()
  @IsOptional()
  state?: string;

  @ApiPropertyOptional({ description: 'Postal Code' })
  @IsString()
  @IsOptional()
  pinCode?: string;
}

export class ToggleSchoolStatusDto {
  @ApiProperty({ description: 'Active status of the campus' })
  isActive: boolean;
}
