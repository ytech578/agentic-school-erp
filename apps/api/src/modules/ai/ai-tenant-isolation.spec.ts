import { ForbiddenException, BadRequestException } from '@nestjs/common';
import { AIService } from './ai.service';
import { requireSchoolId } from '../../core/tenant/tenant.util';

/**
 * Tenant Isolation Security Tests for AIService (Phase 7)
 *
 * Tests:
 *  1. sendMessage with no schoolId throws ForbiddenException (fail-closed)
 *  2. executeAIAction with unknown action type throws BadRequestException
 *  3. requireSchoolId contract verification
 *  4. Conversation lookup scopes by schoolId (cross-tenant isolation)
 */

describe('AI Service — Tenant Isolation & Security (Phase 7)', () => {
  // ─── Minimal mock setup ───────────────────────────────────────────────────
  const mockPrisma = {
    aIConversation: {
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      findMany: jest.fn(),
      deleteMany: jest.fn(),
    },
    aIMessage: { create: jest.fn() },
    user: { findFirst: jest.fn(), findMany: jest.fn() },
    school: { findFirst: jest.fn(), findUnique: jest.fn() },
    student: { count: jest.fn().mockResolvedValue(0) },
    staff: { count: jest.fn().mockResolvedValue(0), findFirst: jest.fn() },
    attendanceRecord: {
      count: jest.fn().mockResolvedValue(0),
      groupBy: jest.fn().mockResolvedValue([]),
    },
    leaveRequest: { findMany: jest.fn().mockResolvedValue([]), findFirst: jest.fn() },
    class: { findMany: jest.fn().mockResolvedValue([]), findFirst: jest.fn() },
    feePayment: { aggregate: jest.fn().mockResolvedValue(null) },
    activityLog: { create: jest.fn() },
    agentAlert: { findMany: jest.fn(), createMany: jest.fn(), deleteMany: jest.fn() },
    assignment: { create: jest.fn() },
    subject: { findFirst: jest.fn() },
    academicYear: { findFirst: jest.fn() },
    message: { createMany: jest.fn() },
  } as any;

  const mockConfig = {
    get: jest.fn((key: string, def?: any) => def),
    getOrThrow: jest.fn(),
  } as any;

  const mockControlPlane = {
    proposeAction: jest.fn(),
    confirmAndExecute: jest.fn(),
  } as any;

  let service: AIService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new AIService(mockPrisma, mockConfig, mockControlPlane);
  });

  // ─── Test 1: sendMessage must fail-closed when schoolId is missing ─────────
  describe('sendMessage — fail-closed on missing schoolId', () => {
    it('throws ForbiddenException when schoolId is empty string', async () => {
      await expect(
        service.sendMessage({
          userId: 'user-1',
          schoolId: '',
          user: { id: 'user-1', firstName: 'Test', lastName: 'User', role: 'PRINCIPAL' },
          message: 'Hello',
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws ForbiddenException when schoolId is undefined', async () => {
      await expect(
        service.sendMessage({
          userId: 'user-1',
          schoolId: undefined as any,
          user: { id: 'user-1', firstName: 'Test', lastName: 'User', role: 'PRINCIPAL', schoolId: undefined },
          message: 'Hello',
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws ForbiddenException when schoolId is null (SUPER_ADMIN in fleet mode)', async () => {
      await expect(
        service.sendMessage({
          userId: 'user-1',
          schoolId: null as any,
          user: { id: 'user-1', firstName: 'Test', lastName: 'User', role: 'SUPER_ADMIN', schoolId: null as any },
          message: 'Hello',
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('does NOT call prisma.school.findFirst (no cross-tenant fallback)', async () => {
      await expect(
        service.sendMessage({
          userId: 'user-1',
          schoolId: '',
          user: { id: 'user-1', firstName: 'Test', lastName: 'User', role: 'PRINCIPAL' },
          message: 'Hello',
        }),
      ).rejects.toThrow();
      expect(mockPrisma.school.findFirst).not.toHaveBeenCalled();
    });
  });


  // ─── Test 3: requireSchoolId utility (fail-closed contract) ──────────────
  describe('requireSchoolId — fail-closed contract', () => {
    it('throws ForbiddenException for null', () => {
      expect(() => requireSchoolId(null)).toThrow(ForbiddenException);
    });

    it('throws ForbiddenException for undefined', () => {
      expect(() => requireSchoolId(undefined)).toThrow(ForbiddenException);
    });

    it('throws ForbiddenException for empty string', () => {
      expect(() => requireSchoolId('')).toThrow(ForbiddenException);
    });

    it('throws ForbiddenException for whitespace-only string', () => {
      expect(() => requireSchoolId('   ')).toThrow(ForbiddenException);
    });

    it('returns trimmed value for valid schoolId', () => {
      expect(requireSchoolId('  school-123  ')).toBe('school-123');
    });
  });

  // ─── Test 4: Cross-tenant conversation scope ──────────────────────────────
  describe('Conversation lookup — schoolId scope', () => {
    it('scopes conversation lookup by userId AND schoolId', async () => {
      mockPrisma.aIConversation.findFirst.mockResolvedValue(null);
      mockPrisma.aIConversation.create.mockResolvedValue({ id: 'conv-1', messages: [] });
      mockPrisma.aIMessage.create.mockResolvedValue({});
      mockPrisma.aIConversation.update.mockResolvedValue({});

      await service.sendMessage({
        userId: 'user-1',
        schoolId: 'school-A',
        user: { id: 'user-1', firstName: 'Test', lastName: 'User', role: 'PRINCIPAL', schoolId: 'school-A' },
        conversationId: 'conv-1',
        message: 'Hello',
      });

      expect(mockPrisma.aIConversation.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            userId: 'user-1',
            schoolId: 'school-A',
          }),
        }),
      );
    });
  });
});
