import { Module } from '@nestjs/common';
import {
  ClassesController,
  SectionsController,
  TeacherAssignmentsController,
  SubjectsController,
} from './classes.controller';
import { ClassesService } from './classes.service';

@Module({
  controllers: [
    ClassesController,
    SectionsController,
    TeacherAssignmentsController,
    SubjectsController,
  ],
  providers: [ClassesService],
  exports: [ClassesService],
})
export class ClassesModule {}
