import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsBoolean,
  IsDateString,
  Length,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateAcademicYearDto {
  @ApiProperty({
    description: 'Name of the academic session (e.g. 2026-2027)',
    example: '2026-2027',
  })
  @IsString()
  @IsNotEmpty()
  @Length(4, 50)
  name: string;

  @ApiProperty({
    description: 'Session start date (ISO string)',
    example: '2026-04-01T00:00:00.000Z',
  })
  @IsDateString()
  @IsNotEmpty()
  startDate: string;

  @ApiProperty({
    description: 'Session end date (ISO string)',
    example: '2027-03-31T23:59:59.999Z',
  })
  @IsDateString()
  @IsNotEmpty()
  endDate: string;
}

export class UpdateAcademicYearDto {
  @ApiPropertyOptional({
    description: 'Name of the academic session',
    example: '2026-2027',
  })
  @IsString()
  @IsOptional()
  @Length(4, 50)
  name?: string;

  @ApiPropertyOptional({
    description: 'Session start date (ISO string)',
    example: '2026-04-01T00:00:00.000Z',
  })
  @IsDateString()
  @IsOptional()
  startDate?: string;

  @ApiPropertyOptional({
    description: 'Session end date (ISO string)',
    example: '2027-03-31T23:59:59.999Z',
  })
  @IsDateString()
  @IsOptional()
  endDate?: string;
}

export class LockAcademicYearDto {
  @ApiProperty({
    description:
      'Whether the academic session is locked against structural changes',
    example: true,
  })
  @IsBoolean()
  isLocked: boolean;
}
