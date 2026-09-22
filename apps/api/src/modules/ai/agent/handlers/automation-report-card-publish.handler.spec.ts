import { AutomationReportCardPublishHandler } from './automation-report-card-publish.handler';
import { ExamsService } from '../../../exams/exams.service';
import {
  ToolHandlerKey,
  AgentToolExecutionContext,
  AGENT_ERRORS,
} from '../agent-types';

describe('AutomationReportCardPublishHandler', () => {
  let handler: AutomationReportCardPublishHandler;
  let examsService: jest.Mocked<Partial<ExamsService>>;

  const mockContext: AgentToolExecutionContext = {
    userId: 'user-admin',
    schoolId: 'school-1',
    role: 'SCHOOL_ADMIN',
    actionId: 'action-report-1',
  };

  beforeEach(() => {
    examsService = {
      publishAndNotifyExamResults: jest.fn().mockResolvedValue({
        examId: 'exam-1',
        examName: 'Midterm 2026',
        published: true,
        notifiedCount: 50,
      }),
      getExamPublishStatus: jest.fn().mockResolvedValue({
        id: 'exam-1',
        name: 'Midterm 2026',
        isPublished: true,
        publishedAt: new Date(),
        schoolId: 'school-1',
      }),
    };

    handler = new AutomationReportCardPublishHandler(
      examsService as unknown as ExamsService,
    );
  });

  it('declares correct key: automation_report_card_publish', () => {
    expect(handler.key).toBe(ToolHandlerKey.AUTOMATION_REPORT_CARD_PUBLISH);
  });

  it('delegates publishing and student notifications to ExamsService', async () => {
    const args = {
      items: [
        {
          id: 'exam-1',
          isComplete: true,
          examName: 'Midterm 2026',
          draftMessage: 'Midterm results are out!',
        },
      ],
    };

    const result = await handler.execute(mockContext, args);

    expect(examsService.publishAndNotifyExamResults).toHaveBeenCalledWith({
      schoolId: 'school-1',
      examId: 'exam-1',
      senderId: 'user-admin',
      customMessage: 'Midterm results are out!',
    });

    expect(result).toEqual({
      resourceId: 'exam-1',
      resourceType: 'ExamReport',
      status: 'PUBLISHED',
      affectedCount: 50,
      actionsCount: 50,
    });
  });

  it('verification succeeds when exam is confirmed published in database', async () => {
    const args = {
      items: [{ id: 'exam-1', isComplete: true }],
    };

    await expect(
      handler.verify(mockContext, args, {
        status: 'PUBLISHED',
        affectedCount: 50,
      }),
    ).resolves.toBeUndefined();

    expect(examsService.getExamPublishStatus).toHaveBeenCalledWith(
      'school-1',
      'exam-1',
    );
  });

  it('verification throws ACTION_VERIFICATION_FAILED when exam is not published', async () => {
    examsService.getExamPublishStatus!.mockResolvedValue({
      id: 'exam-1',
      name: 'Midterm 2026',
      isPublished: false,
      publishedAt: null,
      schoolId: 'school-1',
    });

    const args = {
      items: [{ id: 'exam-1', isComplete: true }],
    };

    await expect(
      handler.verify(mockContext, args, {
        status: 'PUBLISHED',
        affectedCount: 50,
      }),
    ).rejects.toThrow(AGENT_ERRORS.ACTION_VERIFICATION_FAILED);
  });

  it('reconciles as APPLIED when exam has isPublished=true in database', async () => {
    const args = {
      items: [{ id: 'exam-1', isComplete: true }],
    };

    const rec = await handler.reconcile(mockContext, args);

    expect(rec.status).toBe('APPLIED');
    expect(rec.result).toEqual({
      resourceType: 'ExamReport',
      status: 'PUBLISHED',
      affectedCount: 1,
      actionsCount: 1,
    });
  });

  it('reconciles as NOT_APPLIED when exam is not published in database', async () => {
    examsService.getExamPublishStatus!.mockResolvedValue({
      id: 'exam-1',
      name: 'Midterm 2026',
      isPublished: false,
      publishedAt: null,
      schoolId: 'school-1',
    });

    const args = {
      items: [{ id: 'exam-1', isComplete: true }],
    };

    const rec = await handler.reconcile(mockContext, args);

    expect(rec.status).toBe('NOT_APPLIED');
    expect(rec.reason).toBeDefined();
  });
});
