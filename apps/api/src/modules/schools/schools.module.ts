import { Module } from '@nestjs/common';
import { SchoolsController } from './schools.controller';
import { SchoolsService } from './schools.service';
import { AcademicYearsController } from './academic-years.controller';
import { AcademicYearsService } from './academic-years.service';

@Module({
  controllers: [SchoolsController, AcademicYearsController],
  providers: [SchoolsService, AcademicYearsService],
  exports: [SchoolsService, AcademicYearsService],
})
export class SchoolsModule {}
