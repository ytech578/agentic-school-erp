import { Module } from '@nestjs/common';
import { CurriculumController } from './curriculum.controller';
import { CurriculumService } from './curriculum.service';
import { CurriculumSeedService } from './curriculum-seed.service';
import { PrismaModule } from '../../core/database/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [CurriculumController],
  providers: [CurriculumService, CurriculumSeedService],
  exports: [CurriculumService, CurriculumSeedService],
})
export class CurriculumModule {}
