import { IsEnum, IsNumber, IsOptional, Min } from 'class-validator';
import { Type } from 'class-transformer';

export enum SubscriptionPlanEnum {
  FREE_PILOT = 'FREE_PILOT',
  STARTER = 'STARTER',
  GROWTH = 'GROWTH',
  ENTERPRISE = 'ENTERPRISE',
}

export enum SubscriptionStatusEnum {
  ACTIVE = 'ACTIVE',
  TRIALING = 'TRIALING',
  PAST_DUE = 'PAST_DUE',
  CANCELLED = 'CANCELLED',
}

export class UpdateSubscriptionDto {
  @IsEnum(SubscriptionPlanEnum)
  plan: SubscriptionPlanEnum;

  @IsEnum(SubscriptionStatusEnum)
  @IsOptional()
  status?: SubscriptionStatusEnum;

  @IsNumber()
  @IsOptional()
  @Min(1)
  @Type(() => Number)
  maxStudents?: number;

  @IsNumber()
  @IsOptional()
  @Min(1)
  @Type(() => Number)
  maxStaff?: number;

  @IsNumber()
  @IsOptional()
  @Min(1)
  @Type(() => Number)
  maxStorageGb?: number;

  @IsNumber()
  @IsOptional()
  @Min(1000)
  @Type(() => Number)
  maxAiTokensMonthly?: number;
}
