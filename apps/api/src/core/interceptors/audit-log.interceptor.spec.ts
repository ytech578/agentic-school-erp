import { ExecutionContext, CallHandler } from '@nestjs/common';
import { of } from 'rxjs';
import { AuditLogInterceptor } from './audit-log.interceptor';
import { AuditAction } from '@prisma/client';

import { AuditService } from '../audit/audit.service';

describe('AuditLogInterceptor (E-001)', () => {
  let interceptor: AuditLogInterceptor;
  let mockAudit: { recordMutation: jest.Mock };

  beforeEach(() => {
    mockAudit = {
      recordMutation: jest.fn().mockResolvedValue({ id: 'log-123' }),
    };
    interceptor = new AuditLogInterceptor(mockAudit as unknown as AuditService);
  });

  const createMockContext = (
    method: string,
    url: string,
    user: unknown = null,
    params: Record<string, unknown> = {},
    body: Record<string, unknown> = {},
  ) => {
    const request = {
      method,
      url,
      originalUrl: url,
      user,
      params,
      body,
      ip: '127.0.0.1',
      headers: { 'user-agent': 'Jest-Test-Runner' },
    };

    return {
      switchToHttp: () => ({
        getRequest: () => request,
        getResponse: () => ({ statusCode: 200 }),
      }),
      getClass: () => ({ name: 'StudentsController' }),
      getHandler: () => ({ name: 'deleteStudent' }),
    } as unknown as ExecutionContext;
  };

  const createMockCallHandler = (
    responseData: unknown = { success: true },
  ): CallHandler => ({
    handle: () => of(responseData),
  });

  it('skips logging for GET requests', (done) => {
    const context = createMockContext('GET', '/api/students', {
      id: 'user-1',
      role: 'ADMIN',
    });
    const handler = createMockCallHandler();

    interceptor.intercept(context, handler).subscribe({
      next: () => {
        expect(mockAudit.recordMutation).not.toHaveBeenCalled();
        done();
      },
    });
  });

  it('skips logging for unauthenticated mutation requests', (done) => {
    const context = createMockContext('POST', '/api/public/enquiry', null);
    const handler = createMockCallHandler();

    interceptor.intercept(context, handler).subscribe({
      next: () => {
        expect(mockAudit.recordMutation).not.toHaveBeenCalled();
        done();
      },
    });
  });

  it('audits authenticated DELETE mutations with AuditAction.DELETE', (done) => {
    const user = {
      id: 'user-admin',
      role: 'SCHOOL_ADMIN',
      schoolId: 'school-1',
    };
    const context = createMockContext(
      'DELETE',
      '/api/students/stud-123',
      user,
      { id: 'stud-123' },
    );
    const handler = createMockCallHandler({ success: true });

    interceptor.intercept(context, handler).subscribe({
      next: () => {
        expect(mockAudit.recordMutation).toHaveBeenCalledWith(
          expect.objectContaining({
            schoolId: 'school-1',
            userId: 'user-admin',
            action: AuditAction.DELETE,
            module: 'STUDENTS',
            resourceId: 'stud-123',
            resourceType: 'Students',
          }),
        );
        done();
      },
    });
  });

  it('audits authenticated POST mutations with AuditAction.CREATE', (done) => {
    const user = { id: 'user-teacher', role: 'TEACHER', schoolId: 'school-1' };
    const context = createMockContext(
      'POST',
      '/api/assignments',
      user,
      {},
      { id: 'asgn-456' },
    );
    const handler = createMockCallHandler({
      data: { id: 'asgn-456', title: 'Math Homework' },
    });

    interceptor.intercept(context, handler).subscribe({
      next: () => {
        expect(mockAudit.recordMutation).toHaveBeenCalledWith(
          expect.objectContaining({
            schoolId: 'school-1',
            userId: 'user-teacher',
            action: AuditAction.CREATE,
            module: 'STUDENTS',
          }),
        );
        done();
      },
    });
  });
});
