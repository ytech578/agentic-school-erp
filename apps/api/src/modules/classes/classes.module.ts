import { Module } from '@nestjs/common';
import { ClassesController, SubjectsController } from './classes.controller';
import { ClassesService } from './classes.service';

@Module({
  controllers: [ClassesController, SubjectsController],
  providers: [ClassesService],
  exports: [ClassesService],
})
export class ClassesModule {}
