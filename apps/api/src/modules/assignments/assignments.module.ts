import { Module } from '@nestjs/common';
import { AssignmentsController } from './assignments.controller';
import { AssignmentsService } from './assignments.service';
import { PlagiarismService } from './plagiarism.service';

@Module({
  controllers: [AssignmentsController],
  providers: [AssignmentsService, PlagiarismService],
  exports: [AssignmentsService, PlagiarismService],
})
export class AssignmentsModule {}

