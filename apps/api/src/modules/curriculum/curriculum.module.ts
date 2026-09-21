import { Module } from '@nestjs/common';
import { CurriculumController } from './curriculum.controller';
import { CurriculumService } from './curriculum.service';
import { CurriculumSeedService } from './curriculum-seed.service';
import { PrismaModule } from '../../core/database/prisma.module';

import { AcademicIntegrityService } from './academic-integrity.service';

@Module({
  imports: [PrismaModule],
  controllers: [CurriculumController],
  providers: [
    CurriculumService,
    CurriculumSeedService,
    AcademicIntegrityService,
  ],
  exports: [CurriculumService, CurriculumSeedService, AcademicIntegrityService],
})
export class CurriculumModule {}
