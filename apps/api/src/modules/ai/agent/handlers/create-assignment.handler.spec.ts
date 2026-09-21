import { CreateAssignmentAgentHandler } from './create-assignment.handler';
import { AssignmentsService } from '../../../assignments/assignments.service';
import { PrismaService } from '../../../../core/database/prisma.service';
import {
  ToolHandlerKey,
  AgentToolExecutionContext,
  AGENT_ERRORS,
} from '../agent-types';

describe('CreateAssignmentAgentHandler', () => {
  let handler: CreateAssignmentAgentHandler;
  let assignmentsService: jest.Mocked<Partial<AssignmentsService>>;
  let prisma: any;

  const mockContext: AgentToolExecutionContext = {
    userId: 'user-teacher',
    schoolId: 'school-1',
    role: 'TEACHER',
    actionId: 'action-2',
  };

  beforeEach(() => {
    assignmentsService = {
      createAssignment: jest.fn().mockResolvedValue({
        id: 'assignment-1',
        title: 'Algebra homework',
      }),
    };

    prisma = {
      staff: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'staff-1',
          userId: 'user-teacher',
          schoolId: 'school-1',
        }),
      },
      assignment: {
        findUnique: jest.fn(),
      },
    };

    handler = new CreateAssignmentAgentHandler(
      assignmentsService as unknown as AssignmentsService,
      prisma as unknown as PrismaService,
    );
  });

  it('declares correct key: create_assignment', () => {
    expect(handler.key).toBe(ToolHandlerKey.CREATE_ASSIGNMENT);
  });

  it('resolves staff profile and calls AssignmentsService.createAssignment', async () => {
    const args = {
      classId: 'class-1',
      subjectId: 'subject-1',
      topic: 'Algebra homework',
      description: 'Practice problems 1-10',
      dueDate: '2026-10-01',
      totalMarks: 50,
    };

    const result = await handler.execute(mockContext, args);

    expect(prisma.staff.findFirst).toHaveBeenCalledWith({
      where: {
        userId: 'user-teacher',
        schoolId: 'school-1',
        isActive: true,
      },
    });

    expect(assignmentsService.createAssignment).toHaveBeenCalledWith(
      'school-1',
      expect.objectContaining({
        classId: 'class-1',
        subjectId: 'subject-1',
        title: 'Algebra homework',
        description: 'Practice problems 1-10',
        maxMarks: 50,
        staffId: 'staff-1',
      }),
      'staff-1',
    );

    expect(result).toEqual({
      resourceId: 'assignment-1',
      resourceType: 'Assignment',
      status: 'CREATED',
      assignmentId: 'assignment-1',
      classId: 'class-1',
      subjectId: 'subject-1',
    });
  });

  it('throws error when teacher staff profile does not exist in school', async () => {
    prisma.staff.findFirst.mockResolvedValue(null);

    await expect(
      handler.execute(mockContext, {
        classId: 'c1',
        subjectId: 's1',
        topic: 'Math',
      }),
    ).rejects.toThrow('Teacher staff profile not found in this school');

    expect(assignmentsService.createAssignment).not.toHaveBeenCalled();
  });

  it('verification succeeds when assignment exists with matching attributes', async () => {
    prisma.assignment.findUnique.mockResolvedValue({
      id: 'assignment-1',
      schoolId: 'school-1',
      classId: 'class-1',
      subjectId: 'subject-1',
    });

    await expect(
      handler.verify(
        mockContext,
        { classId: 'class-1', subjectId: 'subject-1', topic: 'Math' },
        { assignmentId: 'assignment-1', status: 'CREATED' },
      ),
    ).resolves.toBeUndefined();
  });

  it('verification throws ACTION_VERIFICATION_FAILED when assignment not found', async () => {
    prisma.assignment.findUnique.mockResolvedValue(null);

    await expect(
      handler.verify(
        mockContext,
        { classId: 'class-1', subjectId: 'subject-1', topic: 'Math' },
        { assignmentId: 'assignment-1', status: 'CREATED' },
      ),
    ).rejects.toThrow(AGENT_ERRORS.ACTION_VERIFICATION_FAILED);
  });

  it('verification throws ACTION_VERIFICATION_FAILED on class or subject mismatch', async () => {
    prisma.assignment.findUnique.mockResolvedValue({
      id: 'assignment-1',
      schoolId: 'school-1',
      classId: 'class-WRONG',
      subjectId: 'subject-1',
    });

    await expect(
      handler.verify(
        mockContext,
        { classId: 'class-1', subjectId: 'subject-1', topic: 'Math' },
        { assignmentId: 'assignment-1', status: 'CREATED' },
      ),
    ).rejects.toThrow(AGENT_ERRORS.ACTION_VERIFICATION_FAILED);
  });
});
