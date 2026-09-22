import { Module } from '@nestjs/common';
import { StudentsController } from './students.controller';
import { StudentsService } from './students.service';
import { StudentEnrollmentController } from './student-enrollment.controller';
import { StudentEnrollmentService } from './student-enrollment.service';

@Module({
  controllers: [StudentsController, StudentEnrollmentController],
  providers: [StudentsService, StudentEnrollmentService],
  exports: [StudentsService, StudentEnrollmentService],
})
export class StudentsModule {}
