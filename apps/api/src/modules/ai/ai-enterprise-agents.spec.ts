import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { BadRequestException } from '@nestjs/common';
import { AIService } from './ai.service';
import { PrismaService } from '../../core/database/prisma.service';
import { AgentControlPlaneService } from './agent/agent-control-plane.service';

describe('AIService Enterprise Agents (Question Paper, MTSS Retention, Helpdesk, Remedial Tutor)', () => {
  let service: AIService;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      school: {
        findUnique: jest.fn().mockResolvedValue({ id: 'school-1', name: 'Delhi Public Academy', code: 'DPA' }),
        findFirst: jest.fn().mockResolvedValue({ id: 'school-1', name: 'Delhi Public Academy' }),
      },
      student: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
      },
      academicYear: {
        findFirst: jest.fn().mockResolvedValue({ id: 'ay-2026', name: '2026-2027', isCurrent: true }),
      },
      admissionEnquiry: {
        create: jest.fn().mockResolvedValue({ id: 'enq-101', status: 'NEW' }),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AIService,
        { provide: PrismaService, useValue: prisma },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockImplementation((key: string, defaultValue?: any) => defaultValue || ''),
          },
        },
        { 
          provide: AgentControlPlaneService, 
          useValue: { proposeAction: jest.fn(), confirmAndExecute: jest.fn() } 
        },
      ],
    }).compile();

    service = module.get<AIService>(AIService);
  });

  describe('Agent 1: AI Question Paper & Blueprint Generator', () => {
    it('should reject Grade 11 and Grade 12 requests with BadRequestException', async () => {
      await expect(
        service.generateQuestionPaper('school-1', {
          grade: 'Class 11',
          subject: 'Physics',
        }),
      ).rejects.toThrow(BadRequestException);

      await expect(
        service.generateQuestionPaper('school-1', {
          grade: 'Grade 12th',
          subject: 'Chemistry',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should generate a full question paper with Bloom tags and marking scheme for Class 10 Math', async () => {
      const paper = await service.generateQuestionPaper('school-1', {
        grade: 'Class 10',
        subject: 'Mathematics',
        totalMarks: 80,
        difficulty: 'BALANCED',
        includeAnswerKey: true,
      });

      expect(paper).toBeDefined();
      expect(paper).toContain('DELHI PUBLIC ACADEMY');
      expect(paper).toContain('SECTION A: Objective & Multiple Choice Questions');
      expect(paper).toContain('SECTION B: Short Answer Questions');
      expect(paper).toContain('SECTION C: Short Answer Questions');
      expect(paper).toContain('SECTION D: Long Answer Questions');
      expect(paper).toContain('SECTION E: Case-Study / Competency-Based Assessment');
      expect(paper).toContain('STEP-BY-STEP MARKING SCHEME & ANSWER KEY');
      expect(paper).toContain('[Remembering]');
      expect(paper).toContain('[Applying]');
    });
  });

  describe('Agent 2: Predictive Student Early-Warning & Retention Sentinel (MTSS)', () => {
    it('should aggregate attendance, academic marks, fee, and assignment factors to flag high-risk students', async () => {
      prisma.student.findMany.mockResolvedValue([
        {
          id: 'student-risk-1',
          admissionNumber: 'ADM-1001',
          user: { firstName: 'Rohan', lastName: 'Verma', email: 'rohan@example.com' },
          enrollments: [{ section: { class: { name: 'Class 9' }, name: 'A' } }],
          attendance: [
            { status: 'ABSENT' },
            { status: 'ABSENT' },
            { status: 'PRESENT' },
            { status: 'ABSENT' },
          ], // 25% attendance -> < 75% (+35 pts)
          marks: [
            { marksObtained: 28, isAbsent: false, examSubject: { maxMarks: 100, subject: { name: 'Math' } } },
            { marksObtained: 32, isAbsent: false, examSubject: { maxMarks: 100, subject: { name: 'Science' } } },
          ], // avg 30% -> < 40% (+35 pts)
          feePayments: [{ totalAmount: 12000, paymentStatus: 'PENDING' }], // +15 pts
          assignmentSubmissions: [{ id: 'sub-1' }, { id: 'sub-2' }], // 2 pending -> +15 pts
        },
        {
          id: 'student-good-2',
          admissionNumber: 'ADM-1002',
          user: { firstName: 'Priya', lastName: 'Nair', email: 'priya@example.com' },
          enrollments: [{ section: { class: { name: 'Class 10' }, name: 'B' } }],
          attendance: [{ status: 'PRESENT' }, { status: 'PRESENT' }, { status: 'PRESENT' }],
          marks: [
            { marksObtained: 85, isAbsent: false, examSubject: { maxMarks: 100, subject: { name: 'Math' } } },
          ],
          feePayments: [],
          assignmentSubmissions: [],
        },
      ]);

      const res = await service.getEarlyWarningRiskStudents('school-1');

      expect(res.summary.totalAssessed).toBe(2);
      expect(res.summary.criticalCount).toBeGreaterThanOrEqual(1);

      const highRiskStudent = res.students.find((s) => s.id === 'student-risk-1');
      expect(highRiskStudent).toBeDefined();
      expect(highRiskStudent?.riskLevel).toBe('CRITICAL');
      expect(highRiskStudent?.riskScore).toBe(100);
      expect(highRiskStudent?.primaryDrivers.length).toBeGreaterThan(0);
    });

    it('should generate an individualized MTSS Intervention Plan for a student', async () => {
      prisma.student.findFirst.mockResolvedValue({
        id: 'student-1',
        admissionNumber: 'ADM-0042',
        user: { firstName: 'Aarav', lastName: 'Gupta', email: 'aarav@example.com' },
        enrollments: [{ section: { class: { name: 'Class 8' }, name: 'B' } }],
        attendance: [{ status: 'ABSENT' }],
        marks: [{ marksObtained: 35, isAbsent: false, examSubject: { maxMarks: 100, subject: { name: 'Math' } } }],
      });

      const res = await service.generateStudentInterventionPlan('school-1', 'student-1');

      expect(res.studentName).toBe('Aarav Gupta');
      expect(res.plan).toContain('Multi-Tiered System of Supports (MTSS) Intervention Plan');
      expect(res.plan).toContain('Tier 1: Universal Classroom Adaptations');
      expect(res.plan).toContain('Tier 2: Targeted Remedial & Small-Group Support');
      expect(res.plan).toContain('Tier 3: Intensive Pastoral & Family Alignment');
      expect(res.plan).toContain('30-Day Milestone Checkpoints');
    });
  });

  describe('Agent 3: 24/7 Multilingual Admissions & Tour Concierge', () => {
    it('should answer in Hindi when Hindi is requested', async () => {
      const res = await service.chatHelpdesk('school-1', {
        message: 'नर्सरी में एडमिशन की उम्र क्या है?',
        language: 'Hindi',
      });

      expect(res.reply).toContain('Nursery');
      expect(res.language).toBe('hindi');
    });

    it('should automatically capture leads when phone number is provided in English', async () => {
      const res = await service.chatHelpdesk('school-1', {
        message: 'I want to schedule a campus tour for Class 6. My name is Rajesh Kumar, phone: 9876543210',
        language: 'English',
      });

      expect(res.leadCaptured).toBe(true);
      expect(prisma.admissionEnquiry.create).toHaveBeenCalled();
      expect(res.reply).toContain('successfully registered');
    });
  });

  describe('Agent 4: Adaptive Student Remedial & Revision Tutor', () => {
    it('should compute subject mastery and identify learning gaps', async () => {
      prisma.student.findFirst.mockResolvedValue({
        id: 'student-1',
        user: { firstName: 'Kavya', lastName: 'Reddy' },
        enrollments: [{ section: { class: { name: 'Class 9' } } }],
        marks: [
          { marksObtained: 42, isAbsent: false, examSubject: { maxMarks: 100, subject: { name: 'Mathematics' } } },
          { marksObtained: 88, isAbsent: false, examSubject: { maxMarks: 100, subject: { name: 'English' } } },
        ],
      });

      const res = await service.getStudentRemedialPlan('school-1', 'user-1');

      expect(res.studentName).toBe('Kavya Reddy');
      expect(res.class).toBe('Class 9');
      expect(res.learningGaps.length).toBeGreaterThan(0);
      expect(res.remedialSchedule.length).toBeGreaterThan(0);
    });

    it('should generate targeted adaptive diagnostic questions for a topic', async () => {
      const res = await service.generateAdaptivePractice('school-1', 'user-1', 'Mathematics', 'Quadratic Equations');

      expect(res.subject).toBe('Mathematics');
      expect(res.topic).toBe('Quadratic Equations');
      expect(res.questions.length).toBeGreaterThanOrEqual(3);
      expect(res.questions[0].hint).toBeDefined();
      expect(res.questions[0].explanation).toBeDefined();
      expect(res.questions[0].conceptRecap).toBeDefined();
    });
  });
});
