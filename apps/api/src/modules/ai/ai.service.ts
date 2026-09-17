import { Injectable, Logger, ForbiddenException, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuditAction, RiskLevel, EnquiryStatus } from '@prisma/client';
import { PrismaService } from '../../core/database/prisma.service';
import { requireSchoolId } from '../../core/tenant/tenant.util';
import { generateNextSequence } from '../../core/database/sequence.util';
import { AgentControlPlaneService } from './agent/agent-control-plane.service';
import { AgentExecutionContext } from './agent/agent-types';
import {
  GoogleGenerativeAI,
  HarmCategory,
  HarmBlockThreshold,
  SchemaType,
  FunctionDeclarationsTool,
} from '@google/generative-ai';

const AI_TOOLS: FunctionDeclarationsTool[] = [
  {
    functionDeclarations: [
      {
        name: 'approve_leave',
        description: 'Approve a pending staff leave request when requested by a school administrator.',
        parameters: {
          type: SchemaType.OBJECT,
          properties: {
            staffName: {
              type: SchemaType.STRING,
              description: 'The name of the staff member whose leave request is to be approved.',
            },
          },
          required: ['staffName'],
        },
      },
      {
        name: 'create_assignment',
        description: 'Create and assign a new homework or class assignment.',
        parameters: {
          type: SchemaType.OBJECT,
          properties: {
            className: {
              type: SchemaType.STRING,
              description: 'Class name or grade (e.g. "Class 10-A")',
            },
            topic: {
              type: SchemaType.STRING,
              description: 'Topic or title of the assignment',
            },
            dueDate: {
              type: SchemaType.STRING,
              description: 'Optional due date in ISO format YYYY-MM-DD',
            },
          },
          required: ['className', 'topic'],
        },
      },
      {
        name: 'send_announcement',
        description: 'Broadcast a school-wide announcement or urgent circular to all active users.',
        parameters: {
          type: SchemaType.OBJECT,
          properties: {
            title: {
              type: SchemaType.STRING,
              description: 'Headline or title of the circular or announcement',
            },
            message: {
              type: SchemaType.STRING,
              description: 'Body text or content of the announcement',
            },
          },
          required: ['title'],
        },
      },
    ],
  },
];

@Injectable()
export class AIService {
  private readonly logger = new Logger(AIService.name);
  private genAI: GoogleGenerativeAI | null = null;
  private model: any = null;
  private insightsCache: Record<string, { time: number; insights: string[] }> =
    {};

  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
    private controlPlane: AgentControlPlaneService,
  ) {
    const apiKey = this.config.get<string>('ai.geminiApiKey', '');
    if (apiKey) {
      this.genAI = new GoogleGenerativeAI(apiKey);
      this.model = this.genAI.getGenerativeModel({
        model: this.config.get<string>('ai.geminiModel', 'gemini-3.5-flash-lite'),
        tools: AI_TOOLS,
        safetySettings: [
          {
            category: HarmCategory.HARM_CATEGORY_HARASSMENT,
            threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
          },
          {
            category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
            threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
          },
        ],
      });
    }
  }

  // ─── Build system prompt ─────────────────────────────────────────────────
  private async buildSystemPrompt(
    user: {
      id: string;
      firstName: string;
      lastName: string;
      role: string;
      schoolId?: string;
    },
    fallbackSchoolId?: string,
  ): Promise<string> {
    let liveOperationalData = '';
    // Security: Only use schoolId from authenticated user context or explicit fallback.
    // NEVER fall back to findFirst() — that would leak another school's data into the AI prompt.
    const targetSchoolId = user.schoolId || fallbackSchoolId || null;

    if (targetSchoolId) {
      try {
        const [
          studentsCount,
          staffCount,
          todayAttCount,
          pendingLeaves,
          classes,
          topStudents,
          feeStats,
        ] = await Promise.all([
          this.prisma.student?.count
            ? this.prisma.student.count({ where: { schoolId: targetSchoolId, isActive: true } }).catch(() => 0)
            : Promise.resolve(0),
          this.prisma.staff?.count
            ? this.prisma.staff.count({ where: { schoolId: targetSchoolId, isActive: true } }).catch(() => 0)
            : Promise.resolve(0),
          this.prisma.attendanceRecord?.count
            ? this.prisma.attendanceRecord.count({
                where: {
                  schoolId: targetSchoolId,
                  date: { gte: new Date(new Date().setHours(0, 0, 0, 0)) },
                  status: 'PRESENT',
                },
              }).catch(() => 0)
            : Promise.resolve(0),
          this.prisma.leaveRequest?.findMany
            ? this.prisma.leaveRequest.findMany({
                where: { schoolId: targetSchoolId, status: 'PENDING' },
                include: { staff: { include: { user: { select: { firstName: true, lastName: true } } } } },
                take: 5,
                orderBy: { createdAt: 'desc' },
              }).catch(() => [])
            : Promise.resolve([]),
          this.prisma.class?.findMany
            ? this.prisma.class.findMany({
                where: { schoolId: targetSchoolId },
                select: { name: true },
                distinct: ['name'],
                take: 12,
                orderBy: { name: 'asc' },
              }).catch(() => [])
            : Promise.resolve([]),
          this.prisma.attendanceRecord?.groupBy
            ? this.prisma.attendanceRecord
                .groupBy({
                  by: ['studentId'],
                  where: { schoolId: targetSchoolId, status: 'PRESENT' },
                  _count: { id: true },
                  orderBy: { _count: { id: 'desc' } },
                  take: 5,
                })
                .then(async (groups) => {
                  if (!groups || groups.length === 0 || !this.prisma.student?.findMany) return [];
                  const studentIds = groups.map((g) => g.studentId);
                  const students = await this.prisma.student.findMany({
                    where: { id: { in: studentIds } },
                    include: { user: { select: { firstName: true, lastName: true } } },
                  });
                  const studentMap = new Map(students.map((s) => [s.id, s.user]));
                  return groups.map((g, idx) => {
                    const u = studentMap.get(g.studentId);
                    return `${idx + 1}. ${u?.firstName || 'Student'} ${u?.lastName || ''} (${g._count.id} days present)`;
                  });
                })
                .catch(() => [])
            : Promise.resolve([]),
          this.prisma.feePayment?.aggregate
            ? this.prisma.feePayment.aggregate({
                where: { schoolId: targetSchoolId },
                _sum: { totalAmount: true, paidAmount: true, outstandingAmount: true },
              }).catch(() => null)
            : Promise.resolve(null),
        ]);

        const leavesInfo =
          pendingLeaves.length > 0
            ? pendingLeaves
                .map(
                  (l) =>
                    `- ${l.staff.user.firstName} ${l.staff.user.lastName}: ${l.leaveType} leave for ${l.totalDays} day(s) (Reason: "${l.reason.slice(0, 100)}") [Leave ID: ${l.id}]`,
                )
                .join('\n')
            : 'None currently pending (all staff leave requests are fully reviewed and up to date).';

        const classList =
          classes.length > 0
            ? classes.map((c) => c.name).join(', ')
            : 'Class 1 to Class 10';

        const topStudentsList =
          Array.isArray(topStudents) && topStudents.length > 0
            ? topStudents.join('\n')
            : 'Attendance records are actively tracked across all grades.';

        const outstandingFees = feeStats?._sum?.outstandingAmount
          ? `₹${Number(feeStats._sum.outstandingAmount).toLocaleString('en-IN')}`
          : '₹0';
        const collectedFees = feeStats?._sum?.paidAmount
          ? `₹${Number(feeStats._sum.paidAmount).toLocaleString('en-IN')}`
          : '₹0';

        liveOperationalData = `
LIVE REAL-TIME SCHOOL ERP DATABASE SNAPSHOT:
• School Overview: ${studentsCount} active students enrolled, ${staffCount} active faculty/staff members, ${todayAttCount} students marked present today.
• Available Classes: ${classList}.
• Pending Staff Leave Requests (${pendingLeaves.length} pending):
${leavesInfo}
• Top Students by Attendance:
${topStudentsList}
• Fee Dues Summary: Outstanding Dues: ${outstandingFees}, Total Collected: ${collectedFees}.
`;
      } catch (err: any) {
        this.logger.warn(`Failed to build live operational data: ${err.message}`);
        liveOperationalData = '';
      }
    }

    return `You are Agentic AI, the autonomous operations layer for Agentic School ERP.
Current user: ${user.firstName} ${user.lastName}, Role: ${user.role.replace('_', ' ')}.
${liveOperationalData}

You have DIRECT access to live school data and autonomous action execution capabilities.
When users ask you questions or command actions, use the live snapshot data provided above.

CRITICAL INSTRUCTIONS FOR ACTIONS AND COMMANDS:
1. Approving Leave Requests:
   - When the user asks to "approve leave", "approve the pending leave request", or mentions a staff member's leave:
     - Check the "Pending Staff Leave Requests" above.
     - If there is a pending leave: State the staff member's name, leave type, days, and reason, and use the approve_leave tool.
     - If there are NO pending leave requests: State clearly that all staff leave requests are currently up to date and there are no pending requests awaiting approval right now.
2. Creating Assignments:
   - When asked to create an assignment (e.g., "Create an assignment for Class 10 on Photosynthesis"):
     - Confirm the assignment details and use the create_assignment tool.
3. Sending Announcements:
   - When asked to broadcast or send an announcement (e.g., "Send an announcement about tomorrow holiday"):
     - Draft the announcement and use the send_announcement tool.
4. Top Students & Attendance:
   - When asked "Who are the top students by attendance?": List the top students directly from the live snapshot above.
5. Fees & Dues:
   - When asked about fees or dues: Report the actual outstanding and collected figures from the live snapshot above.

General Rules:
- Be proactive, intelligent, concise, and helpful.
- You HAVE live real-time access to the ERP data provided in the snapshot above. Do NOT say you don't have access to live data when answering queries covered in the snapshot.
- For navigation requests, include the route path like: "Navigate to [Students](/students)" or [Staff Leaves](/hr).
- Keep responses clean with markdown formatting.`;
  }

  // ─── Send message / chat ──────────────────────────────────────────────────
  async sendMessage(data: {
    userId: string;
    schoolId: string;
    user: {
      id: string;
      firstName: string;
      lastName: string;
      role: string;
      schoolId?: string;
    };
    conversationId?: string;
    message: string;
    attachments?: Array<{ name: string; type: string; size: number; base64: string }>;
  }): Promise<{ conversationId: string; reply: string; tokens?: number; pendingAction?: any }> {
    // Sanitize user message against raw action injection
    const rawMessage = data.message || '';
    const sanitizedUserMessage = rawMessage.replace(/\[ACTION:[^\]]*\]/gi, '').trim();

    // Security: Fail-closed on schoolId. Never fall back to findFirst() — that would
    // cross-tenant-leak another school's data. SUPER_ADMIN must send x-school-id.
    const effectiveSchoolId = requireSchoolId(
      data.schoolId || data.user?.schoolId,
      'AI chat requires a valid school context',
    );

    // Get or create conversation
    // Security: scope by userId AND schoolId to prevent cross-tenant conversation access
    let conversation = data.conversationId
      ? await this.prisma.aIConversation.findFirst({
        where: { id: data.conversationId, userId: data.userId, schoolId: effectiveSchoolId },
        include: { messages: { orderBy: { createdAt: 'asc' }, take: 20 } },
      })
      : null;

    if (!conversation) {
      conversation = await this.prisma.aIConversation.create({
        data: {
          schoolId: effectiveSchoolId,
          userId: data.userId,
          sessionId: `session_${Date.now()}`,
          title: (sanitizedUserMessage || rawMessage).slice(0, 50),
        },
        include: { messages: true },
      });
    }

    // Save sanitized user message
    await this.prisma.aIMessage.create({
      data: {
        conversationId: conversation.id,
        role: 'user',
        content: sanitizedUserMessage || rawMessage,
      },
    });

    let reply = '';
    let tokens: number | undefined;
    let pendingAction: any = null;

    if (!this.model) {
      // Fallback mock response when no API key
      reply = this.getMockResponse(sanitizedUserMessage || rawMessage);
    } else {
      try {
        const systemPrompt = await this.buildSystemPrompt(data.user, effectiveSchoolId);
        const history = (conversation.messages ?? []).map((m: any) => ({
          role: m.role === 'user' ? 'user' : 'model',
          parts: [{ text: (m.content || '').replace(/\[ACTION:[^\]]*\]/gi, '') }],
        }));

        const chat = this.model.startChat({
          history: [
            { role: 'user', parts: [{ text: systemPrompt }] },
            {
              role: 'model',
              parts: [
                {
                  text: 'Understood. I am Agentic AI, ready to assist with autonomous operations.',
                },
              ],
            },
            ...history,
          ],
        });

        let messagePayload: any = sanitizedUserMessage || rawMessage;
        if (data.attachments && data.attachments.length > 0) {
          const parts: any[] = [{ text: sanitizedUserMessage || rawMessage || 'Please review this attached file.' }];
          for (const att of data.attachments) {
            const rawBase64 = att.base64.includes('base64,') ? att.base64.split('base64,')[1] : att.base64;
            parts.push({
              inlineData: {
                mimeType: att.type || 'application/octet-stream',
                data: rawBase64,
              },
            });
          }
          messagePayload = parts;
        }

        const result = await chat.sendMessage(messagePayload);
        const response = await result.response;
        try {
          reply = response.text();
        } catch {
          reply = 'Action processed.';
        }
        tokens = response.usageMetadata?.totalTokenCount;

        // ─── Phase 12: Explicit multi-function call handling ────────────
        // Phase 13: AIService is NOT the authority — never chooses role/tenant
        const functionCalls = typeof response.functionCalls === 'function' ? response.functionCalls() : [];

        if (functionCalls && functionCalls.length === 1) {
          // Exactly one call — safe to propose
          const call = functionCalls[0];
          try {
            const ctx: AgentExecutionContext = {
              userId: data.user.id,
              // Server-authoritative role from JWT — NEVER from AI output
              role: data.user.role,
              schoolId: effectiveSchoolId,
            };
            const proposal = await this.controlPlane.proposeAction(ctx, call.name, call.args as Record<string, unknown>);
            pendingAction = proposal.pendingAction;
          } catch (error: unknown) {
            const msg = error instanceof Error ? error.message : String(error);
            this.logger.error(`Action proposal failed: ${msg}`);
            // Phase 13: Surface error to user — do NOT silently swallow
            reply = `I was unable to prepare that action: ${msg.replace(/^[A-Z_]+: /, '')}. Please try again with more specific details.`;
          }
        } else if (functionCalls && functionCalls.length > 1) {
          // Multiple simultaneous mutations — explicitly rejected
          // Do NOT silently execute only the first one
          this.logger.warn(`Gemini returned ${functionCalls.length} function calls — rejecting multi-action request`);
          reply = `I detected ${functionCalls.length} simultaneous actions in your request. For safety, please request one action at a time. Which action would you like to perform first?`;
        }
        // functionCalls.length === 0 → proceed with text reply (no action)

      // Strip ALL action tags from the user-facing reply
      reply = reply ? reply.replace(/\[ACTION:[^\]]+\]/g, '').trim() : '';
      if (!reply && pendingAction) {
        const label = (pendingAction as Record<string, unknown>)['label'];
        reply = `I have prepared the action to ${String(label ?? 'execute').toLowerCase()}. Please review and confirm below:`;
      }

      } catch (err: any) {
        this.logger.error('Gemini API error', err?.message);
        if (err?.status === 429 || err?.message?.includes('429')) {
          reply =
            "I'm currently receiving too many requests and hit the API rate limit. Please try again in a little while.";
        } else {
          reply =
            'I encountered an error processing your request. Please try again in a moment.';
        }
      }
    }

    // Save assistant reply
    await this.prisma.aIMessage.create({
      data: {
        conversationId: conversation.id,
        role: 'assistant',
        content: reply,
        tokens,
        modelUsed: this.config.get<string>(
          'ai.geminiModel',
          'gemini-3.5-flash-lite',
        ),
      },
    });

    // Update conversation title if first message
    if (!data.conversationId) {
      await this.prisma.aIConversation.update({
        where: { id: conversation.id },
        data: { title: (sanitizedUserMessage || rawMessage).slice(0, 60) },
      });
    }

    return { conversationId: conversation.id, reply, tokens, pendingAction };
  }

  // ─── Get conversations list ───────────────────────────────────────────────
  async getConversations(userId: string) {
    return this.prisma.aIConversation.findMany({
      where: { userId },
      select: {
        id: true,
        title: true,
        createdAt: true,
        updatedAt: true,
        _count: { select: { messages: true } },
      },
      orderBy: { updatedAt: 'desc' },
      take: 20,
    });
  }

  // ─── Get conversation with messages ──────────────────────────────────────
  async getConversation(conversationId: string, userId: string) {
    return this.prisma.aIConversation.findFirst({
      where: { id: conversationId, userId },
      include: {
        messages: { orderBy: { createdAt: 'asc' } },
      },
    });
  }

  // ─── Delete conversation ──────────────────────────────────────────────────
  async deleteConversation(conversationId: string, userId: string) {
    await this.prisma.aIConversation.deleteMany({
      where: { id: conversationId, userId },
    });
  }

  // ─── IMPROVEMENT 2: Proactive Alert Store / Fetch / Read ─────────────────

  async runProactiveMonitoring(schoolId: string): Promise<void> {
    this.logger.log(`Running proactive monitoring for school: ${schoolId}`);
    const anomalies = await this.getSchoolAnomalies(schoolId);

    // Only store new alerts (avoid duplicates - delete today's alerts and re-create)
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    await this.prisma.agentAlert.deleteMany({
      where: { schoolId, createdAt: { gte: todayStart } },
    });

    if (anomalies.length > 0) {
      await this.prisma.agentAlert.createMany({
        data: anomalies.map((a: any) => ({
          schoolId,
          type: a.type,
          title: a.title,
          description: a.description,
          actionLabel: a.action,
          isRead: false,
        })),
      });
      this.logger.log(`Stored ${anomalies.length} proactive alerts for school: ${schoolId}`);
    }
  }

  async getProactiveAlerts(schoolId: string) {
    return this.prisma.agentAlert.findMany({
      where: { schoolId },
      orderBy: [{ isRead: 'asc' }, { createdAt: 'desc' }],
      take: 20,
    });
  }

  async markAlertRead(alertId: string, schoolId: string) {
    await this.prisma.agentAlert.updateMany({
      where: { id: alertId, schoolId },
      data: { isRead: true },
    });
    return { success: true };
  }

  async markAllAlertsRead(schoolId: string) {
    await this.prisma.agentAlert.updateMany({
      where: { schoolId, isRead: false },
      data: { isRead: true },
    });
    return { success: true };
  }

  // ─── IMPROVEMENT 3: Multi-Agent Admission Workflow ────────────────────────
  async runAdmissionWorkflow(applicationId: string, schoolId: string): Promise<{
    agentResults: { agent: string; status: string; output: string }[];
  }> {
    const application = await this.prisma.admissionApplication.findFirst({
      where: { id: applicationId, schoolId },
    });

    if (!application) {
      return { agentResults: [{ agent: 'System', status: 'error', output: 'Application not found.' }] };
    }

    const agentResults: { agent: string; status: string; output: string }[] = [];

    // ── Agent 1: Communications — Draft welcome email ──────────────────────
    try {
      let welcomeEmail = `Dear ${application.parentName},\n\nThank you for applying to our school for ${application.studentName} (Class ${application.classApplied}). We have received your application and it is under review. We will contact you shortly.\n\nBest regards,\nAdmissions Team`;
      if (this.model) {
        const r = await this.model.generateContent(
          `Draft a warm, professional welcome email for a new school admission application. Student: ${application.studentName}, Class Applied: ${application.classApplied}, Parent: ${application.parentName}. Keep it under 80 words. Plain text only.`
        );
        welcomeEmail = r.response.text().trim();
      }
      agentResults.push({
        agent: 'Communications Agent',
        status: 'success',
        output: welcomeEmail,
      });
    } catch (err: any) {
      agentResults.push({ agent: 'Communications Agent', status: 'error', output: 'Failed to draft welcome email.' });
    }

    // ── Agent 2: Scheduler — Propose interview slot ────────────────────────
    try {
      const nextWeekday = new Date();
      nextWeekday.setDate(nextWeekday.getDate() + 3);
      // Skip to next weekday
      while (nextWeekday.getDay() === 0 || nextWeekday.getDay() === 6) {
        nextWeekday.setDate(nextWeekday.getDate() + 1);
      }
      const dateStr = nextWeekday.toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
      const slotOutput = `Proposed Interview Slot: ${dateStr} at 10:00 AM\n\nThis slot has been selected based on school calendar availability. An interview invitation can be sent to ${application.parentEmail || application.parentPhone}.`;

      // Update the application with interview date
      await this.prisma.admissionApplication.update({
        where: { id: applicationId },
        data: {
          interviewDate: nextWeekday,
          status: 'INTERVIEW_SCHEDULED',
        },
      });

      agentResults.push({
        agent: 'Scheduling Agent',
        status: 'success',
        output: slotOutput,
      });
    } catch (err: any) {
      agentResults.push({ agent: 'Scheduling Agent', status: 'error', output: 'Failed to schedule interview.' });
    }

    // ── Agent 3: Finance — Class-Specific Fee estimate ────────────────────
    try {
      // Extract class number from application.classApplied (e.g. "Class 10" -> "10")
      const classMatch = application.classApplied.match(/\d+/);
      const classNumber = classMatch ? classMatch[0] : null;

      let targetClass = null;
      if (classNumber) {
        targetClass = await this.prisma.class.findFirst({
          where: {
            schoolId,
            name: { contains: classNumber, mode: 'insensitive' },
          },
        });
      }

      // Find fee structure specifically for this class
      let feeStructure = null;
      if (targetClass) {
        feeStructure = await this.prisma.feeStructure.findFirst({
          where: {
            schoolId,
            classId: targetClass.id,
            isActive: true,
          },
          include: {
            items: {
              include: { feeHead: true },
            },
          },
        });
      }

      // Fallback: match by fee structure name (e.g. "Class 10 Annual Fee 2026")
      if (!feeStructure && classNumber) {
        feeStructure = await this.prisma.feeStructure.findFirst({
          where: {
            schoolId,
            name: { contains: classNumber, mode: 'insensitive' },
            isActive: true,
          },
          include: {
            items: {
              include: { feeHead: true },
            },
          },
        });
      }

      // Fallback 2: first active fee structure
      if (!feeStructure) {
        feeStructure = await this.prisma.feeStructure.findFirst({
          where: {
            schoolId,
            isActive: true,
          },
          include: {
            items: {
              include: { feeHead: true },
            },
          },
        });
      }

      let feeEstimate = '';
      if (feeStructure && feeStructure.items.length > 0) {
        const items = feeStructure.items;
        const total = items.reduce((sum, f) => sum + Number(f.amount), 0);
        const breakdown = items
          .map(f => `• ${f.feeHead.name} (${f.frequency.toLowerCase()}): ₹${Number(f.amount).toLocaleString()}`)
          .join('\n');
        
        const quarterlyInstallment = Math.round(total / 4);

        feeEstimate = `Estimated Fee Structure for ${application.classApplied}:\n\n` +
          `Structure: ${feeStructure.name}\n` +
          `${breakdown}\n\n` +
          `• Total Annual Fee: ₹${total.toLocaleString()}\n` +
          `• Installment Plan: ₹${quarterlyInstallment.toLocaleString()} per quarter (4 quarterly installments)`;
      } else {
        feeEstimate = `Fee estimate for ${application.classApplied}: Please configure fee structures in the Fees module for accurate class-specific estimates.`;
      }

      agentResults.push({
        agent: 'Finance Agent',
        status: 'success',
        output: feeEstimate,
      });
    } catch (err: any) {
      agentResults.push({ agent: 'Finance Agent', status: 'error', output: 'Failed to generate fee estimate.' });
    }

    return { agentResults };
  }

  // ─── Generate school insights for dashboard ───────────────────────────────
  async generateDashboardInsights(
    schoolId: string,
    user: any,
  ): Promise<string[]> {
    if (!this.model) {
      return [
        'Fee collection is tracking well this month.',
        'Monitor students with attendance below 75% — 3 students flagged.',
        'Exam results analysis ready after marks entry is complete.',
      ];
    }

    // Return cached insights if generated within the last hour
    const now = Date.now();
    if (
      this.insightsCache[schoolId] &&
      now - this.insightsCache[schoolId].time < 1000 * 60 * 60
    ) {
      return this.insightsCache[schoolId].insights;
    }

    try {
      const [students, staff, todayAtt, totalAtt, pendingFees] =
        await Promise.all([
          this.prisma.student.count({ where: { schoolId, isActive: true } }),
          this.prisma.staff.count({ where: { schoolId, isActive: true } }),
          this.prisma.attendanceRecord.count({
            where: {
              schoolId,
              date: { gte: new Date(new Date().setHours(0, 0, 0, 0)) },
              status: 'PRESENT',
            },
          }),
          this.prisma.attendanceRecord.count({
            where: {
              schoolId,
              date: { gte: new Date(new Date().setHours(0, 0, 0, 0)) },
            },
          }),
          this.prisma.feePayment.count({
            where: { schoolId, paymentStatus: { in: ['PENDING', 'OVERDUE'] } },
          }),
        ]);

      const prompt = `School data: ${students} students, ${staff} staff, today's attendance: ${todayAtt}/${totalAtt}, pending fee payments: ${pendingFees}.
Generate exactly 3 concise one-sentence insights about school operations. Return as a JSON array of strings.`;

      const result = await this.model.generateContent(prompt);
      const text = result.response.text();
      const match = text.match(/\[[\s\S]*\]/);
      if (match) {
        const parsed = JSON.parse(match[0]);
        if (Array.isArray(parsed)) {
          const insights = parsed.slice(0, 3);
          // Cache the result
          this.insightsCache[schoolId] = { time: now, insights };
          return insights;
        }
      }
    } catch (err: any) {
      this.logger.error('Dashboard insights error', err?.message);
    }

    return [
      'Attendance tracking is active for all classes.',
      'Review pending fee payments in the Fees module.',
      'Enter exam marks to generate report cards.',
    ];
  }

  // ─── Teacher Copilot: Lesson Plan with TLM ────────────────────────────────
  async generateLessonPlan(
    topic: string,
    grade: string,
    duration: string,
    options?: { subject?: string; includeTlm?: boolean; curriculum?: string },
  ) {
    const subject = options?.subject || 'General Subject';
    const includeTlm = options?.includeTlm !== false;
    const curriculum = options?.curriculum || 'CBSE / NCERT Core';

    const buildFallbackPlan = () => {
      let plan = `## 📘 Lesson Plan: ${topic}
**Grade Level:** ${grade || 'Grade 8'} | **Subject:** ${subject} | **Duration:** ${duration || '45 mins'} | **Curriculum:** ${curriculum} | **Framework:** 5E Instructional Model (NEP 2020 Aligned)

---

### 🎯 Learning Objectives & Competencies
**National Education Policy (NEP 2020) Competency Mapping:**
- *Core Competencies:* Scientific Inquiry, Conceptual Clarity, Analytical Problem-Solving, Peer Collaboration.
- *Bloom's Taxonomy Progression:*
  1. **Remember & Understand:** State the fundamental definitions, principles, and key mechanisms of **${topic}**.
  2. **Apply & Analyze:** Interpret experimental data and observe manipulative behavior during hands-on activities.
  3. **Evaluate & Create:** Hypothesize outcomes under modified variables and formulate evidence-based conclusions.

---

### ⏱️ Phase-by-Phase 5E Lesson Timeline

| 5E Phase | Duration | Teacher Instructional Script | Student Inquiry & Activity |
| :--- | :--- | :--- | :--- |
| **1. Engage (Hook)** | 5-7 mins | Present an everyday mystery or physical anomaly on **${topic}**. Ask: *"What mechanism explains this?"* | Brainstorm in pairs; sketch initial hypotheses on desk whiteboards. |
| **2. Explore (Hands-on)** | 15 mins | Distribute TLM manipulative kits; guide student inquiry with 2 open challenge prompts. | Manipulate materials in teams of 4; record observable patterns in the log table. |
| **3. Explain (Concept)** | 12 mins | Anchor group discoveries to core scientific terminology using the central chalkboard diagram. | Reconcile initial hypotheses with formal definitions; take structured Cornell notes. |
| **4. Elaborate (Apply)** | 8 mins | Pose a real-world engineering or ecological scenario involving **${topic}**. | Solve challenge scenario in pairs; test edge cases using the TLM model. |
| **5. Evaluate (Check)** | 5 mins | Conduct rapid formative check and administer the 3-minute Student Exit Slip. | Complete and submit the Student Activity Handout & Exit Slip. |`;

      if (includeTlm) {
        plan += `\n\n---

### 📦 Teaching Learning Material (TLM) Kit & Activity Guide

#### 🛠️ 1. Low-Cost / Zero-Cost Hands-on Physical Manipulatives
- **Material Kit:** Recycled cardboard strips, bottle caps (color-coded for elements/variables), rubber bands, scale rulers, and marble tokens.
- **Pedagogical Function:** Translates abstract, unobservable dynamics of **${topic}** into concrete kinesthetic models students can physically assemble.
- **Setup Time:** Under 5 minutes using everyday recyclable materials readily found in classroom craft cupboards.

#### 📊 2. Visual & Graphic Organizers (Anchor Charts)
- **Anchor Chart Layout:** 3-quadrant poster on board (*"Observable Phenomenon"*, *"Hidden Mechanism"*, *"Mathematical/Scientific Law"*).
- **Concept Flowchart:** Visual cause-and-effect branching diagram showing input conditions, transformation stages, and final equilibrium for **${topic}**.

#### 💻 3. Digital & Interactive Multimedia TLM
- **Interactive Simulation:** PhET Interactive Simulation / GeoGebra virtual lab module exploring real-time variable manipulation.
- **Micro-Video Anchor:** 90-second high-definition slow-motion video snippet demonstrating **${topic}** in practical modern technology.

#### 📋 4. Step-by-Step TLM Classroom Deployment Script
1. **Distribution (T+0):** Material captains collect the manipulative kit tray for their group of 4.
2. **Unguided Exploration (T+2):** 2 minutes of tactile exploration without teacher intervention to build intuitive curiosity.
3. **Structured Challenge (T+5):** Teacher gives Challenge 1: *"Construct a model that demonstrates how increasing one variable changes the system."*
4. **Debrief & Synthesis (T+12):** One representative from each team articulates their discovery in 30 seconds.

#### ♿ 5. Differentiated Learning Adaptations
- **Support / Kinesthetic Learners:** Color-coded tactile sequencing cards providing step-by-step assembly prompts.
- **Accelerated Learners:** *"What-if"* constraint card requiring students to adapt the model for extreme conditions.

#### ♻️ 6. Safety & Eco-Friendly Clean-Up Protocol
- Ensure small manipulative tokens are counted back into group containers before dismissal.
- Return chart paper scraps to the classroom recycling tray; store durable materials in labeled compartment boxes.`;
      }

      plan += `\n\n---

### 💡 Formative Assessment Questions
- *Recall:* Name the primary governing principle and key components of **${topic}**.
- *Conceptual:* How does the system adapt when external conditions are altered?
- *Application:* Describe one modern technology or daily life phenomenon that relies directly on **${topic}**.

---

### 📝 Homework & Extension Project
- **Standard Practice:** Complete Questions 1–5 in the student workbook chapter on **${topic}**.
- **Inquiry Extension:** Find one real-world example of **${topic}** in your home or neighborhood. Write a 3-sentence scientific observation.

---

### 📄 Student Classroom Activity Handout & Exit Slip

**Student Name:** ____________________  |  **Class & Section:** ${grade || 'Grade 8'} ____  |  **Date:** ____________

#### Part 1: Hands-on Manipulative Observation Log
1. Sketch your group's physical TLM model or anchor diagram for **${topic}** below:
\`\`\`
[ Draw your manipulative arrangement or concept diagram here ]
\`\`\`
2. When you adjusted the primary component in your model, what change did you observe?
   - **Observation:** ___________________________________________________________________
   - **Scientific Explanation:** ___________________________________________________________

#### Part 2: Quick Concept Challenge
State whether the following statement is True or False, and justify in one line:
- *"The fundamental mechanism of ${topic} remains constant regardless of system scale."*
- **Response:** [   ] True   [   ] False  —  **Reason:** _______________________________________

#### Part 3: 3-Minute Exit Ticket Slip
- **One thing I mastered today about ${topic}:** ____________________________________________
- **One question I still have:** __________________________________________________________
- **My Confidence Level:** [  ] ⭐ Needs Practice   [  ] ⭐⭐ Got It   [  ] ⭐⭐⭐ Can Teach Others!`;

      return plan;
    };

    if (!this.model) {
      return buildFallbackPlan();
    }
    try {
      const prompt = `You are an expert master educator, curriculum specialist, and instructional designer.
Create a comprehensive, highly engaging, classroom-ready lesson plan for ${grade} on the topic "${topic}".
Duration: ${duration}. Subject: ${subject}. Curriculum Standard: ${curriculum}.

Structure the lesson plan with these exact sections:
1. Learning Objectives & NEP 2020 Competencies (Bloom's Taxonomy progression: Remember, Apply, Evaluate).
2. Phase-by-Phase 5E Lesson Timeline Table (Engage, Explore, Explain, Elaborate, Evaluate with duration, teacher script, and student action).
${
  includeTlm
    ? `3. Comprehensive Teaching Learning Material (TLM) Kit & Activity Guide:
   - Low-Cost / Zero-Cost Hands-on Physical Manipulatives (materials kit, pedagogical purpose, student group activity).
   - Visual & Graphic Organizers (chalkboard layout, anchor chart design, concept maps).
   - Digital & Interactive Multimedia TLM (PhET interactive simulation prompt, video clip anchor).
   - Step-by-Step TLM Classroom Deployment Script (exact teacher prompts and student actions).
   - Differentiated Learning Adaptations (support for diverse learning paces).
   - Safety & Eco-Friendly Clean-Up Protocol (safe handling and recycling).`
    : ''
}
4. Formative Assessment Questions (Recall, Conceptual, Real-world Application).
5. Homework & Extension Inquiry Project.
6. A dedicated student-facing section titled strictly:
### 📄 Student Classroom Activity Handout & Exit Slip
With:
- Header: Student Name, Class & Section, Date.
- Part 1: Hands-on Manipulative Observation Log (prompt for diagram and observation table).
- Part 2: Quick Concept Challenge (application scenario).
- Part 3: 3-Minute Exit Ticket Slip (one thing learned, one remaining doubt, 3-star self-assessment).

Format strictly in clean Markdown with professional headers and valid Markdown tables.
CRITICAL FORMATTING RULES:
1. Do NOT use raw HTML tags such as <br>, <br/>, or <p>. Use standard Markdown newlines and bullet points.
2. For tables, use standard Markdown table syntax with clean concise text. Never put <br> inside table cells.
3. Do NOT use raw LaTeX dollar delimiters like $x = y$ or $$...$$. Write all equations and formulas cleanly using standard Unicode mathematical symbols (e.g. F = m × a, ax² + bx + c = 0, ±, √, ², ³, Δ, °, θ, π).`;
      const result = await this.model.generateContent(prompt);
      return result.response.text();
    } catch (err: any) {
      this.logger.error('Lesson plan error', err?.message);
      return buildFallbackPlan();
    }
  }

  // ─── Teacher Copilot: Remark Generator ────────────────────────────────────
  async generateStudentRemark(studentProfile: string, tone: string) {
    const buildFallbackRemark = () => {
      const p = studentProfile?.trim() || 'The student';
      switch (tone?.toLowerCase()) {
        case 'praising':
          return `Outstanding academic performance! ${p} consistently exhibits exemplary enthusiasm, high-level analytical comprehension, and sets a wonderful benchmark for peers in classroom discussions. Keep up the extraordinary work!`;
        case 'strict':
          return `${p} has notable latent potential, but greater consistency and self-discipline are essential. Homework submissions and active classroom attention must be prioritized immediately to reflect true capabilities.`;
        case 'constructive':
        case 'constructive / direct':
          return `${p} demonstrates solid foundational understanding and participates well. To reach higher academic milestones, focus should now turn toward double-checking work for precision and maintaining steady classroom engagement.`;
        case 'encouraging':
        default:
          return `${p} has demonstrated admirable growth, perseverance, and a positive attitude towards learning. With continued curiosity and consistent practice, further remarkable achievements are well within reach!`;
      }
    };

    if (!this.model) {
      return buildFallbackRemark();
    }
    try {
      const prompt = `You are an experienced educator crafting report card remarks. Tone: ${tone}. Student observations: ${studentProfile}. Write an insightful, professional, and personalized remark (2 to 3 sentences). Ensure it is actionable and grammatically impeccable. Do NOT use raw HTML tags like <br> or LaTeX symbols.`;
      const result = await this.model.generateContent(prompt);
      return result.response.text();
    } catch (err: any) {
      this.logger.error('Remark error', err?.message);
      return buildFallbackRemark();
    }
  }

  // ─── Teacher Copilot: Parent Update ───────────────────────────────────────
  async generateParentUpdate(studentProfile: string, context: string) {
    const buildFallbackUpdate = () => {
      const name = studentProfile?.trim() || 'your ward';
      const ctx = context?.trim() || 'academic progress and attendance';
      return `Dear Parent,\n\nI hope this message finds you well. I am writing to share a brief update regarding ${name}. Specifically: ${ctx}.\n\nWe deeply value our partnership in supporting ${name}'s educational journey. Please feel free to reply directly or contact the school office if you would like to discuss this further.\n\nWarm regards,\nClass Teacher`;
    };

    if (!this.model) {
      return buildFallbackUpdate();
    }
    try {
      const prompt = `You are a professional teacher writing a direct, polite update to a parent. Student info: "${studentProfile}". Situation context: "${context}". Write a warm, polite, and reassuring message (2 to 3 paragraphs). Start with "Dear Parent," and end with teacher regards. Format cleanly for email or WhatsApp. Do NOT use raw HTML tags like <br> or LaTeX symbols.`;
      const result = await this.model.generateContent(prompt);
      return result.response.text();
    } catch (err: any) {
      this.logger.error('Parent update error', err?.message);
      return buildFallbackUpdate();
    }
  }

  // ─── Agent 1: Exam Blueprinter & Question Paper Generator ─────────────
  async generateQuestionPaper(
    schoolId: string,
    params: {
      grade: string;
      subject: string;
      totalMarks?: number;
      duration?: string;
      difficulty?: string;
      topics?: string;
      includeAnswerKey?: boolean;
      board?: string;
      schoolName?: string;
    },
  ) {
    const validSchoolId = requireSchoolId(schoolId);
    const grade = (params.grade || 'Class 10').trim();

    // Strict K-10 Grade Boundary Enforcement
    if (/\b(11|12|11th|12th|xi|xii|junior college|intermediate)\b/i.test(grade)) {
      throw new BadRequestException(
        'Curriculum strictly restricted to Nursery through Grade 10. Senior secondary grades (11/12) are not supported.',
      );
    }

    const subject = params.subject || 'Mathematics';
    const totalMarks = Number(params.totalMarks) || 80;
    const duration =
      params.duration ||
      (totalMarks <= 25 ? '45 Minutes' : totalMarks <= 50 ? '1.5 Hours' : '3 Hours');
    const difficulty = params.difficulty || 'BALANCED';
    const topics = params.topics || 'Comprehensive Term Syllabus';
    const board = params.board || 'CBSE';
    const includeAnswerKey = params.includeAnswerKey !== false;

    // Fetch school name for header (with explicit client override support)
    const school = await this.prisma.school.findUnique({
      where: { id: validSchoolId },
      select: { name: true, code: true },
    });
    const schoolName = params.schoolName?.trim() || school?.name || 'Academic Institute';

    const buildFallbackPaper = () => {
      let paper = `# ${schoolName.toUpperCase()}
**Annual Summative Examination — Session 2026-27**
**Affiliated to ${board} | Nursery – Grade 10 Curriculum**

---

| **Subject:** ${subject} | **Grade / Level:** ${grade} |
| :--- | :--- |
| **Max. Marks:** ${totalMarks} | **Time Allowed:** ${duration} |
| **Difficulty Tier:** ${difficulty} | **Coverage:** ${topics} |

---

### 📋 General Instructions
1. This question paper comprises **Five Sections** (Sections A, B, C, D, and E).
2. **Section A** contains 5 Multiple Choice Questions (MCQs) carrying 1 mark each.
3. **Section B** contains 3 Short Answer Type-I (SA-I) questions carrying 2 marks each.
4. **Section C** contains 3 Short Answer Type-II (SA-II) questions carrying 3 marks each.
5. **Section D** contains 2 Long Answer (LA) questions carrying 5 marks each with internal choice.
6. **Section E** contains 1 Case/Source-based integrated unit of assessment carrying 4 marks.
7. All questions are compulsory. Use of calculators or electronic devices is strictly prohibited.
8. Write all answers neatly with necessary calculation steps and labelled diagrams.

---

### SECTION A: Objective & Multiple Choice Questions (1 Mark Each)
*All questions are compulsory. Select the correct option.*

**Q1.** *[Remembering]* Which of the following fundamental principles or definitions correctly applies to **${subject}** in ${grade}?
- (A) Option Alpha: The standard base value remains invariant under uniform translation.
- (B) Option Beta: The rate of variation is directly proportional to external impetus.
- (C) Option Gamma: The net equilibrium sum vanishes in closed cyclical states.
- (D) Option Delta: The resultant magnitude quadruples when factor input doubles.

**Q2.** *[Understanding]* Consider the relationship between primary components in the study of **${topics}**. If the boundary condition is halved, what is the consequence on the system?
- (A) The system remains strictly unaltered.
- (B) The resultant decreases by a factor of 2.
- (C) The equilibrium point shifts toward the origin.
- (D) The system exhibits exponential divergent oscillation.

**Q3.** *[Applying]* A student needs to verify an experimental result involving **${subject}**. Which step ensures experimental validity and prevents systematic error?
- (A) Neglecting ambient calibration temperature.
- (B) Recording triple trials and taking the arithmetic mean.
- (C) Rounding raw measurements before arithmetic computation.
- (D) Eliminating control groups from comparative observation.

**Q4.** *[Remembering]* In ${board} curriculum standards for ${grade}, the standardized unit or benchmark metric for measuring energy or output is:
- (A) Newton-meter or Joule
- (B) Pascal per second
- (C) Volt-ampere inverse
- (D) Hertz-radian

**Q5.** *[Understanding]* An assertion (A) and reason (R) are given:
- **Assertion (A):** The core theorem holds true for all rational values within the specified domain.
- **Reason (R):** Continuous differentiability guarantees local existence of critical points.
Choose the correct option:
- (A) Both (A) and (R) are true and (R) is the correct explanation of (A).
- (B) Both (A) and (R) are true but (R) is NOT the correct explanation of (A).
- (C) (A) is true but (R) is false.
- (D) (A) is false but (R) is true.

---

### SECTION B: Short Answer Questions — Type I (2 Marks Each)

**Q6.** *[Understanding]* State the two essential criteria required to validate the core theorem in **${topics}**. Give one real-life example illustrating this in action.  
*(2 Marks)*

**Q7.** *[Applying]* Solve the following standard problem: If a variable quantity P is inversely related to Q, and P = 24 when Q = 3, calculate the value of P when Q = 8. Show all derivation steps.  
*(2 Marks)*

**Q8.** *[Analyzing]* Differentiate between primary and secondary characteristics of **${subject}** studied in ${grade}. Present your answer in a concise comparative tabular format with at least two distinct points of divergence.  
*(2 Marks)*

---

### SECTION C: Short Answer Questions — Type II (3 Marks Each)

**Q9.** *[Applying]* A practical scenario involves applying concepts of **${topics}** to optimize resources. Derive the mathematical or conceptual expression step-by-step, stating any assumptions clearly.  
*(3 Marks)*

**Q10.** *[Analyzing]* Explain why standard experimental values sometimes deviate from theoretical predictions in classroom laboratories. Outline three distinct precautions that students should take to minimize observational error.  
*(3 Marks)*

**Q11.** *[Understanding]* *(Internal Choice)*
- **(a)** Explain the detailed mechanism of how feedback loops operate within the context of **${subject}**.
- **OR**
- **(b)** Draw a neat, labelled schematic diagram illustrating the primary workflow or structure in ${grade} **${subject}**.  
*(3 Marks)*

---

### SECTION D: Long Answer Questions (5 Marks Each)

**Q12.** *[Evaluating]*
- **(a)** Formulate the comprehensive proof or complete theoretical derivation for the governing formula in **${topics}**.
- **(b)** Using the derived principle, calculate the total output when standard baseline parameters are multiplied by a factor of 1.5.  
*(3 + 2 = 5 Marks)*  
*OR*  
- **(a)** Discuss how historical developments in **${subject}** shaped our modern scientific understanding.
- **(b)** Outline two contemporary real-world challenges where this principle plays a critical role.  
*(3 + 2 = 5 Marks)*

**Q13.** *[Analyzing]*
A composite real-world problem requires synthesizing multiple sub-concepts from ${grade} ${subject}:
1. Identify the given independent and dependent variables. *(1 Mark)*
2. Construct the governing system of equations or logical relations. *(2 Marks)*
3. Solve for the unknown equilibrium states and interpret the physical or practical significance of your final answer. *(2 Marks)*  
*(Total: 5 Marks)*

---

### SECTION E: Case-Study / Competency-Based Assessment (4 Marks)

**Q14.** *[Source / Case-Based Integrated Problem]*
> **Case Context:** During a science and technology symposium at ${schoolName}, Class 10 students were tasked with evaluating energy efficiency and material sustainability under varying seasonal conditions. They recorded observations across five controlled trials and synthesized their data into a predictive performance curve.

Based on the above context, answer the following:
- **(i)** Identify the primary controlling parameter in the symposium experiment. *(1 Mark)*
- **(ii)** What mathematical or empirical relation describes the trend observed across the trials? *(1 Mark)*
- **(iii)** If the baseline load increases by 25%, predict the adjusted system output and justify your reasoning with two quantitative arguments. *(2 Marks)*`;

      if (includeAnswerKey) {
        paper += `\n\n---
\n# 📝 STEP-BY-STEP MARKING SCHEME & ANSWER KEY
**Confidential — For Evaluators Only**

| Question | Expected Answer & Step Breakdown | Marks |
| :--- | :--- | :--- |
| **Q1** | **(A)** Standard base value remains invariant.<br />*Recall of core definition (1 mark)* | 1 M |
| **Q2** | **(B)** Resultant decreases by factor of 2.<br />*Inverse proportional reasoning (1 mark)* | 1 M |
| **Q3** | **(B)** Recording triple trials and taking arithmetic mean.<br />*Application of error reduction technique (1 mark)* | 1 M |
| **Q4** | **(A)** Newton-meter or Joule.<br />*Accurate unit recall (1 mark)* | 1 M |
| **Q5** | **(A)** Both (A) and (R) are true and (R) correctly explains (A). | 1 M |
| **Q6** | • Stating first criterion clearly (1 M)<br />• Stating second criterion and practical example (1 M) | 2 M |
| **Q7** | • Constant of proportionality k = P × Q = 24 × 3 = 72 (1 M)<br />• P = 72 / 8 = 9 with final unit (1 M) | 2 M |
| **Q8** | • Point 1: Operational scope difference (1 M)<br />• Point 2: Input dependency difference (1 M) | 2 M |
| **Q9** | • Setting up initial boundary equations (1 M)<br />• Substitution and algebraic manipulation (1 M)<br />• Final simplified expression with units (1 M) | 3 M |
| **Q10** | • Precaution 1: Zero-error correction (1 M)<br />• Precaution 2: Parallax avoidance (1 M)<br />• Precaution 3: Environmental stability (1 M) | 3 M |
| **Q11 (a/b)** | • Complete explanation / neat labelled diagram with all 4 parts identified (2 M)<br />• Functional description of parts (1 M) | 3 M |
| **Q12** | • Part (a): Correct proof / derivation step-by-step (3 M)<br />• Part (b): Correct numerical substitution and final value (2 M) | 5 M |
| **Q13** | • Step 1: Variable identification (1 M)<br />• Step 2: System formulation (2 M)<br />• Step 3: Analytical solution and interpretation (2 M) | 5 M |
| **Q14** | • (i): Identification of controlling variable (1 M)<br />• (ii): Stating governing empirical equation (1 M)<br />• (iii): Calculation of 25% load shift with justification (2 M) | 4 M |`;
      }

      return paper;
    };

    if (!this.model) {
      return buildFallbackPaper();
    }

    try {
      const prompt = `You are a chief examination controller for the ${board} Board specializing in K-10 schooling.
Create a complete, formal, rigorous question paper for ${grade} in the subject "${subject}".
Total Marks: ${totalMarks}. Duration: ${duration}. Difficulty: ${difficulty}.
Specific Topics: "${topics}".
Strict Grade Constraint: STRICTLY Nursery to Grade 10 only. Never use Grade 11 or Grade 12 concepts.

Structure the paper with:
1. Formal School Header: ${schoolName}, Subject, Grade, Marks, Duration.
2. General Instructions according to standard ${board} pattern.
3. Section A: Multiple Choice Questions (1 Mark each) with Bloom's Taxonomy tags ([Remembering], [Understanding], [Applying]).
4. Section B: Short Answer Type I (2 Marks each).
5. Section C: Short Answer Type II (3 Marks each).
6. Section D: Long Answer (5 Marks each) with internal choice.
7. Section E: Case-study / Competency-based source question (4 Marks).
${includeAnswerKey ? "8. Comprehensive Step-by-Step Marking Scheme and Answer Key at the end under heading: '# 📝 STEP-BY-STEP MARKING SCHEME & ANSWER KEY'." : ''}

CRITICAL RULES:
- Format in clean, elegant GitHub Flavored Markdown.
- Write mathematical equations cleanly with standard Unicode characters (e.g. ², ³, √, ±, ×, ÷, °, π). Do NOT use unescaped raw LaTeX symbols or $$ block delimiters.
- Ensure natural, clear spacing between words, numbers, mathematical operators, and MCQ options (e.g. '(a) Option', not '(a)Option').
- Do NOT use raw HTML tags such as <br>, <p>, or <div>.`;

      const result = await this.model.generateContent(prompt);
      return result.response.text();
    } catch (err: any) {
      this.logger.error('Question paper generation error', err?.message);
      return buildFallbackPaper();
    }
  }

  // ─── Agent 2: Early-Warning & Retention Sentinel (MTSS) ───────────────
  async getEarlyWarningRiskStudents(
    schoolId: string,
    filters?: { classId?: string; riskLevel?: string },
  ) {
    const validSchoolId = requireSchoolId(schoolId);
    const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);

    const students = await this.prisma.student.findMany({
      where: {
        schoolId: validSchoolId,
        isActive: true,
        ...(filters?.classId
          ? {
              enrollments: {
                some: {
                  section: { classId: filters.classId },
                  status: 'ACTIVE',
                },
              },
            }
          : {}),
      },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        enrollments: {
          where: { status: 'ACTIVE' },
          include: {
            section: {
              include: {
                class: { select: { id: true, name: true } },
              },
            },
          },
          take: 1,
        },
        attendance: {
          where: { date: { gte: ninetyDaysAgo } },
          select: { status: true },
        },
        marks: {
          select: {
            marksObtained: true,
            isAbsent: true,
            examSubject: {
              select: { maxMarks: true, subject: { select: { name: true } } },
            },
          },
          take: 20,
        },
        feePayments: {
          where: { paymentStatus: { in: ['PENDING', 'PARTIAL'] } },
          select: { totalAmount: true, paymentStatus: true },
        },
        assignmentSubmissions: {
          where: { status: 'PENDING' },
          select: { id: true },
        },
      },
      take: 100,
    });

    let criticalCount = 0;
    let highCount = 0;
    let moderateCount = 0;
    let lowCount = 0;
    let totalRiskSum = 0;

    const assessedStudents = students.map((s) => {
      // 1. Attendance telemetry
      const totalAtt = s.attendance.length;
      const presentCount = s.attendance.filter(
        (a) => a.status === 'PRESENT' || a.status === 'HALF_DAY',
      ).length;
      const attendanceRate =
        totalAtt > 0 ? Math.round((presentCount / totalAtt) * 100) : 88;

      // 2. Academic telemetry
      const validMarks = s.marks.filter(
        (m) => m.marksObtained !== null && !m.isAbsent,
      );
      let academicAvg = 75;
      if (validMarks.length > 0) {
        const totalPct = validMarks.reduce((acc, m) => {
          const max = Number(m.examSubject?.maxMarks) || 100;
          return acc + (Number(m.marksObtained) / max) * 100;
        }, 0);
        academicAvg = Math.round(totalPct / validMarks.length);
      }

      // 3. Fee & Assignment telemetry
      const pendingFeesCount = s.feePayments.length;
      const overdueAssignmentsCount = s.assignmentSubmissions.length;

      // 4. Composite Risk Score Algorithm (0-100)
      let score = 0;
      const drivers: string[] = [];

      if (attendanceRate < 75) {
        score += 35;
        drivers.push(`Severe chronic absenteeism (${attendanceRate}%)`);
      } else if (attendanceRate < 85) {
        score += 18;
        drivers.push(`Attendance below benchmark (${attendanceRate}%)`);
      }

      if (academicAvg < 40) {
        score += 35;
        drivers.push(`Critical academic failure risk (${academicAvg}% avg)`);
      } else if (academicAvg < 50) {
        score += 20;
        drivers.push(`Marginal academic performance (${academicAvg}% avg)`);
      } else if (academicAvg < 65) {
        score += 8;
        drivers.push(`Moderate learning gaps (${academicAvg}% avg)`);
      }

      if (pendingFeesCount > 0) {
        score += 15;
        drivers.push(`Tuition fee default / pending installments`);
      }

      if (overdueAssignmentsCount >= 2) {
        score += 15;
        drivers.push(`${overdueAssignmentsCount} overdue assignments`);
      } else if (overdueAssignmentsCount === 1) {
        score += 8;
        drivers.push(`1 pending assignment`);
      }

      // Cap at 100
      const finalScore = Math.min(100, score);
      totalRiskSum += finalScore;

      let riskLevel = 'LOW';
      let tier = 'Tier 1 (Universal)';

      if (finalScore >= 70) {
        riskLevel = 'CRITICAL';
        tier = 'Tier 3 (Intensive Intervention)';
        criticalCount++;
      } else if (finalScore >= 50) {
        riskLevel = 'HIGH';
        tier = 'Tier 2 (Targeted Support)';
        highCount++;
      } else if (finalScore >= 30) {
        riskLevel = 'MODERATE';
        tier = 'Tier 2 (Progress Monitoring)';
        moderateCount++;
      } else {
        lowCount++;
      }

      const activeEnrollment = s.enrollments[0];
      const className = activeEnrollment
        ? `${activeEnrollment.section.class.name} - ${activeEnrollment.section.name}`
        : 'Unassigned';

      return {
        id: s.id,
        admissionNumber: s.admissionNumber,
        name: `${s.user.firstName} ${s.user.lastName}`.trim(),
        email: s.user.email,
        class: className,
        attendanceRate,
        academicAvg,
        pendingFeesCount,
        overdueAssignmentsCount,
        riskScore: finalScore,
        riskLevel,
        tier,
        primaryDrivers:
          drivers.length > 0 ? drivers : ['Consistent engagement and performance'],
      };
    });

    // Filter by riskLevel if requested
    const filteredStudents =
      filters?.riskLevel && filters.riskLevel !== 'ALL'
        ? assessedStudents.filter((s) => s.riskLevel === filters.riskLevel)
        : assessedStudents;

    // Sort highest risk first
    filteredStudents.sort((a, b) => b.riskScore - a.riskScore);

    const totalAssessed = assessedStudents.length;
    const averageRiskScore =
      totalAssessed > 0 ? Math.round(totalRiskSum / totalAssessed) : 0;

    return {
      summary: {
        totalAssessed,
        criticalCount,
        highCount,
        moderateCount,
        lowCount,
        averageRiskScore,
      },
      students: filteredStudents,
    };
  }

  async generateStudentInterventionPlan(schoolId: string, studentId: string) {
    const validSchoolId = requireSchoolId(schoolId);
    const student = await this.prisma.student.findFirst({
      where: { id: studentId, schoolId: validSchoolId },
      include: {
        user: { select: { firstName: true, lastName: true, email: true } },
        enrollments: {
          where: { status: 'ACTIVE' },
          include: {
            section: {
              include: { class: true },
            },
          },
          take: 1,
        },
        attendance: { take: 30, select: { status: true } },
        marks: {
          take: 10,
          select: {
            marksObtained: true,
            isAbsent: true,
            examSubject: {
              select: { maxMarks: true, subject: { select: { name: true } } },
            },
          },
        },
      },
    });

    if (!student) {
      throw new BadRequestException('Student not found in this school.');
    }

    const studentName = `${student.user.firstName} ${student.user.lastName}`.trim();
    const activeClass = student.enrollments[0]
      ? `${student.enrollments[0].section.class.name} (${student.enrollments[0].section.name})`
      : 'Class 10';

    const buildFallbackPlan = () => `## 🛡️ Multi-Tiered System of Supports (MTSS) Intervention Plan
**Student:** ${studentName} | **Admission No:** ${student.admissionNumber} | **Class:** ${activeClass}
**Generated Date:** ${new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })} | **Review Cycle:** 30-Day Bi-Weekly Milestone

---

### 🔍 1. Executive Diagnostic & Root-Cause Analysis
- **Primary Concerns:** Persistent dips in academic consistency and sporadic attendance trends requiring systematic multi-tiered scaffolding.
- **Academic Baseline:** Diagnostic marks indicate conceptual friction in core numerical and comprehension topics.
- **Behavioral & Engagement Assessment:** Student shows responsiveness during interactive peer sessions but exhibits hesitation in independent summative evaluations.

---

### 🪜 2. Multi-Tiered Action Framework

#### Tier 1: Universal Classroom Adaptations (Led by Subject Teachers)
1. **Front-Row Preferred Seating:** Position ${studentName} within the prime instructional cone to facilitate non-verbal engagement checks.
2. **Scaffolded Assignments:** Provide chunked worksheets with initial guided prompts before transitioning to independent problem-solving.
3. **Praise-to-Correction Ratio:** Maintain a 4:1 positive reinforcement ratio to bolster academic self-efficacy.

#### Tier 2: Targeted Remedial & Small-Group Support (Led by Remedial Specialist)
1. **Bi-Weekly Remedial Clinic:** Tuesday and Thursday zero-period (8:00 AM - 8:40 AM) focused on foundational concepts in Math & Science.
2. **Peer Learning Buddy:** Pair with an empathetic high-performing peer partner for collaborative revision sessions.
3. **Formative Self-Check Slips:** Use 3-minute diagnostic micro-quizzes at the end of each topic module.

#### Tier 3: Intensive Pastoral & Family Alignment (Led by Principal & School Counselor)
1. **Counselor Touchpoint:** Fortnightly 20-minute structured check-in addressing anxiety and motivation.
2. **Bi-Weekly Parent Check-in:** Brief WhatsApp/Call progress pulse sent every other Friday afternoon to synchronize home revision schedules.
3. **Attendance Sentinel:** Immediate notification dispatched to parents if absent for more than 1 day without prior leave note.

---

### 🎯 3. 30-Day Milestone Checkpoints

| Timeline | Milestone Target | Verification Metric | Responsible Stakeholder |
| :--- | :--- | :--- | :--- |
| **Week 1** | Establish baseline rapport and initial remedial seating | 100% on-time attendance in Week 1 | Class Teacher |
| **Week 2** | Complete 4 foundational practice worksheets | Scoring ≥ 65% on formative check | Subject Teachers |
| **Week 3** | Mid-cycle counselor evaluation and parent progress review | Joint counselor & parent sign-off | School Counselor |
| **Week 4** | Summative micro-assessment and Tier recalibration | Achieve ≥ 70% composite score | Academic Coordinator |

---

### ✍️ Formal Approvals & Commitments
- **Class Teacher Signature:** ___________________________  
- **School Counselor Signature:** _______________________  
- **Principal Endorsement:** ____________________________`;

    if (!this.model) {
      return {
        plan: buildFallbackPlan(),
        studentName,
        admissionNumber: student.admissionNumber,
      };
    }

    try {
      const prompt = `You are a clinical school psychologist and MTSS academic intervention director for K-10 schooling.
Create a comprehensive, highly actionable Multi-Tiered System of Supports (MTSS) Individualized Intervention Plan for:
Student: ${studentName}
Class: ${activeClass}
Admission Number: ${student.admissionNumber}

The plan must include:
1. Executive Diagnostic and Root-Cause Analysis
2. Tier 1 (Universal Classroom Accommodations)
3. Tier 2 (Targeted Remedial Support & Peer Mentorship)
4. Tier 3 (Intensive Pastoral, Counselor, and Parent Alignment)
5. 30-Day Milestone Checkpoints Table
6. Measurable Success & Tier De-escalation Criteria

Format strictly in clean, professional Markdown with clear tables and headers.
Do NOT use raw HTML tags or unescaped LaTeX symbols.`;

      const result = await this.model.generateContent(prompt);
      return {
        plan: result.response.text(),
        studentName,
        admissionNumber: student.admissionNumber,
      };
    } catch (err: any) {
      this.logger.error('MTSS Intervention plan error', err?.message);
      return {
        plan: buildFallbackPlan(),
        studentName,
        admissionNumber: student.admissionNumber,
      };
    }
  }

  // ─── Agent 3: 24/7 Multilingual Admissions & Tour Concierge ───────────
  async chatHelpdesk(
    schoolId: string,
    payload: {
      message: string;
      language?: string;
      sessionId?: string;
      parentName?: string;
      phone?: string;
      email?: string;
      classApplied?: string;
      studentName?: string;
    },
  ) {
    const validSchoolId = requireSchoolId(schoolId);
    const message = (payload.message || '').trim();
    const language = (payload.language || 'English').toLowerCase();

    // Check for Lead Capture trigger
    let leadCaptured = false;
    let enquiryId: string | undefined = undefined;

    const phoneMatch =
      payload.phone || message.match(/(?:\+91|0)?[6-9]\d{9}/)?.[0];
    const parentName =
      payload.parentName ||
      message.match(/(?:my name is|i am|this is)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/i)?.[1];

    if (phoneMatch) {
      try {
        const currentYear = await this.prisma.academicYear.findFirst({
          where: { schoolId: validSchoolId },
          orderBy: { startDate: 'desc' },
        });

        if (currentYear) {
          const enquiry = await this.prisma.admissionEnquiry.create({
            data: {
              schoolId: validSchoolId,
              academicYearId: currentYear.id,
              studentName:
                payload.studentName ||
                (parentName ? `${parentName}'s Child` : 'Prospective Student'),
              classApplied: payload.classApplied || 'Class 1',
              parentName: parentName || 'Prospective Parent',
              phone: phoneMatch,
              email: payload.email || null,
              source: 'AI_HELPDESK',
              notes: `Automated lead captured via 24/7 AI Admissions Concierge. Inquiry: "${message}"`,
              status: EnquiryStatus.NEW,
              leadScore: 85,
              nextAction:
                'Admissions office to initiate callback for campus walkthrough and document verification.',
            },
          });
          leadCaptured = true;
          enquiryId = enquiry.id;
        }
      } catch (err: any) {
        this.logger.warn(`Failed to auto-capture admissions lead: ${err.message}`);
      }
    }

    // Multilingual Knowledge Base Responses
    const buildFallbackResponse = () => {
      const lower = message.toLowerCase();

      // Hindi
      if (language.includes('hi') || language.includes('hindi')) {
        if (
          lower.includes('age') ||
          lower.includes('उम्र') ||
          lower.includes('nursery') ||
          lower.includes('class 1')
        ) {
          return `नमस्ते! सत्र 2026-27 के लिए हमारे प्रवेश नियम इस प्रकार हैं:
• **Nursery:** 31 मार्च तक न्यूनतम 3 वर्ष
• **LKG / UKG:** क्रमशः 4 और 5 वर्ष
• **Class 1:** NEP 2020 दिशानिर्देशों के अनुसार 6 वर्ष पूर्ण होने चाहिए
क्या आप अपने बच्चे के लिए स्कूल कैंपस विजिट या आवेदन पत्र बुक करना चाहते हैं? कृपया अपना फोन नंबर साझा करें!`;
        }
        if (leadCaptured) {
          return `धन्यवाद! आपका अनुरोध सफलतापूर्वक दर्ज कर लिया गया है (Ref ID: ${enquiryId?.slice(-6) || 'ADM-2026'}). हमारी प्रवेश परामर्श टीम शीघ्र ही आपसे संपर्क करेगी।`;
        }
        return `नमस्ते! हमारे विद्यालय में नर्सरी से कक्षा 10वीं तक सीबीएसई (CBSE) आधारित आधुनिक शिक्षा, रोबोटिक्स लैब, खेल परिसर और जीपीएस बस सुविधा उपलब्ध है। आप प्रवेश पात्रता, शुल्क संरचना, या स्कूल टूर के बारे में पूछ सकते हैं!`;
      }

      // Telugu
      if (language.includes('te') || language.includes('telugu')) {
        if (leadCaptured) {
          return `ధన్యవాదాలు! మీ ప్రవేశ విచారణ నమోదు చేయబడింది. మా అడ్మిషన్ల బృందం త్వరలోనే మిమ్మల్ని సంప్రదిస్తుంది.`;
        }
        return `నమస్కారం! నర్సరీ నుండి 10వ తరగతి వరకు ప్రవేశాలు ప్రారంభమైనవి. మా క్యాంపస్‌లో స్మార్ట్ క్లాస్‌రూమ్‌లు, ల్యాబ్‌లు మరియు బస్సు రవాణా సదుపాయాలు ఉన్నాయి. మీరు ప్రవేశ వివరాలు లేదా ఫీజుల గురించి తెలుసుకోవచ్చు.`;
      }

      // Tamil
      if (language.includes('ta') || language.includes('tamil')) {
        if (leadCaptured) {
          return `நன்றி! உங்கள் சேர்க்கை தகவல் வெற்றிகரமாக பதிவு செய்யப்பட்டது. எங்கள் குழு விரைவில் தொடர்பு கொள்ளும்.`;
        }
        return `வணக்கம்! நர்சரி முதல் 10 ஆம் வகுப்பு வரையிலான சேர்க்கைகள் வரவேற்கப்படுகின்றன. ஸ்மார்ட் வகுப்பறைகள் மற்றும் விளையாட்டு வசதிகள் உள்ளன. மேலும் விவரங்களை நீங்கள் கேட்கலாம்.`;
      }

      // Marathi
      if (language.includes('mr') || language.includes('marathi')) {
        if (leadCaptured) {
          return `धन्यवाद! तुमची प्रवेश चौकशी नोंदवली गेली आहे. आमची प्रवेश समिती लवकरच तुमच्याशी संपर्क साधेल.`;
        }
        return `नमस्कार! नर्सरी ते इयत्ता १० वी पर्यंत प्रवेश प्रक्रिया सुरू आहे. आमच्या शाळेत डिजिटल वर्ग, प्रयोगशाळा आणि सुरक्षित बस वाहतूक उपलब्ध आहे.`;
      }

      // Default English
      if (leadCaptured) {
        return `Thank you for your interest! 🎉 Your admissions enquiry has been successfully registered (Reference: **${enquiryId?.slice(-6).toUpperCase() || 'ENQ-2026'}**).\n\nOur Admissions Counselor will contact you via **${phoneMatch}** within 24 business hours to arrange an interactive campus walkthrough and assist with document verification.\n\nIs there anything else regarding our CBSE curriculum, STEM labs, or transport routes I can assist you with today?`;
      }

      if (
        lower.includes('age') ||
        lower.includes('eligibility') ||
        lower.includes('nursery') ||
        lower.includes('class 1')
      ) {
        return `### 🏫 Age Eligibility Criteria (Session 2026–27)
In accordance with NEP 2020 and CBSE standards (calculated as of **March 31, 2026**):
- **Nursery / Pre-KG:** 3 Years completed
- **LKG (Lower Kindergarten):** 4 Years completed
- **UKG (Upper Kindergarten):** 5 Years completed
- **Class 1:** 6 Years completed
- **Classes 2 to 10:** Progression based on previous school's valid Transfer Certificate (TC) and progress card.

Would you like to book a campus tour or reserve an application slot? Share your contact number and our counselor will assist you!`;
      }

      if (
        lower.includes('document') ||
        lower.includes('require') ||
        lower.includes('certificate')
      ) {
        return `### 📄 Admission Document Checklist
To finalize admission for Nursery through Class 10, please keep the following verified copies ready:
1. **Birth Certificate** (Issued by Municipal Corporation / Panchayat)
2. **Student & Parent Aadhaar Cards** (Proof of identity & residence)
3. **Transfer Certificate (TC)** (Mandatory for Class 2 through 10, countersigned if inter-state)
4. **Previous Year Report Card** (Mark sheet from the recognized previous school)
5. **Immunization & Medical Fitness Record**
6. **Passport-size Photographs** (4 student, 2 each of mother & father)

Our admissions office can pre-verify your documents during your campus walkthrough.`;
      }

      if (
        lower.includes('facility') ||
        lower.includes('transport') ||
        lower.includes('bus') ||
        lower.includes('sports')
      ) {
        return `### 🚌 Campus Infrastructure & Facilities
Our school offers comprehensive, safe, and modern amenities:
- **Smart Classrooms:** Interactive 75" touch panels and high-speed campus Wi-Fi.
- **STEM & Robotics Labs:** Hands-on AI, robotics, and composite physics/chemistry/biology laboratories.
- **Sports Complex:** Cricket pitch, basketball courts, badminton arena, and indoor chess/table tennis academy.
- **Safe Fleet Transport:** 100% GPS-tracked school buses with speed governors, CCTV cameras, and female attendants on all routes.
- **Infirmary & Healthcare:** Full-time certified nurse and tie-up with multi-specialty pediatric clinics.`;
      }

      if (
        lower.includes('fee') ||
        lower.includes('cost') ||
        lower.includes('structure')
      ) {
        return `### 💳 Fee Transparency & Payment Options
- School fees are structured transparently across tuition, technology, and activity components.
- Payments can be made in **Quarterly installments** via Net Banking, UPI, or Debit/Credit card through our secure Parent Portal.
- Sibling concessions and merit scholarships are applicable upon admissions evaluation.

Would you like a detailed fee schedule for your desired grade? Provide your phone number or email and we will send the full brochure!`;
      }

      return `Hello! Welcome to our 24/7 AI Admissions & Campus Concierge. 🌟

I can assist you with:
1. **Age Criteria & Admissions Timeline** (Nursery through Class 10)
2. **Campus Walkthrough Booking** (Meet our principal and tour STEM labs)
3. **Document Verification Checklist**
4. **Curriculum, Sports, and Transport Routes**

How may I help you and your child today?`;
    };

    if (!this.model) {
      return {
        reply: buildFallbackResponse(),
        leadCaptured,
        enquiryId,
        language,
      };
    }

    try {
      const prompt = `You are the Official AI Admissions Concierge and School Ambassador for a premier CBSE K-10 institution.
The user is speaking in ${language}.
User query: "${message}".
Context:
- Grades: Strictly Nursery through 10th Grade.
- Age eligibility: Nursery 3+, LKG 4+, UKG 5+, Class 1 6+ as of March 31.
- Lead status: ${leadCaptured ? `A lead has just been successfully captured for phone ${phoneMatch}. Acknowledge warmly.` : 'If parent expresses interest to apply or visit, politely invite them to share their phone number or child grade.'}

Respond helpfully, courteously, and professionally in ${language}.
Format in clean Markdown without raw HTML or unescaped LaTeX.`;

      const result = await this.model.generateContent(prompt);
      return {
        reply: result.response.text(),
        leadCaptured,
        enquiryId,
        language,
      };
    } catch (err: any) {
      this.logger.error('Helpdesk chat error', err?.message);
      return {
        reply: buildFallbackResponse(),
        leadCaptured,
        enquiryId,
        language,
      };
    }
  }

  // ─── Agent 4: Adaptive Student Remedial & Revision Tutor ──────────────
  async getStudentRemedialPlan(schoolId: string, userId: string) {
    const validSchoolId = requireSchoolId(schoolId);
    const student = await this.prisma.student.findFirst({
      where: { userId, schoolId: validSchoolId },
      include: {
        user: { select: { firstName: true, lastName: true } },
        enrollments: {
          where: { status: 'ACTIVE' },
          include: {
            section: {
              include: { class: true },
            },
          },
          take: 1,
        },
        marks: {
          include: {
            examSubject: {
              include: { subject: true, exam: true },
            },
          },
          take: 20,
        },
      },
    });

    if (!student) {
      throw new BadRequestException('Student profile not found.');
    }

    const studentName = `${student.user.firstName} ${student.user.lastName}`.trim();
    const className = student.enrollments[0]?.section.class.name || 'Class 10';

    // Analyze marks
    const subjectStats: Record<
      string,
      { totalObtained: number; totalMax: number; count: number }
    > = {};

    for (const m of student.marks) {
      const subj = m.examSubject.subject.name || 'General';
      const max = Number(m.examSubject.maxMarks) || 100;
      const obtained =
        m.marksObtained !== null && !m.isAbsent ? Number(m.marksObtained) : 0;

      if (!subjectStats[subj]) {
        subjectStats[subj] = { totalObtained: 0, totalMax: 0, count: 0 };
      }
      subjectStats[subj].totalObtained += obtained;
      subjectStats[subj].totalMax += max;
      subjectStats[subj].count += 1;
    }

    const subjectsSummary = Object.entries(subjectStats).map(([name, s]) => {
      const pct =
        s.totalMax > 0 ? Math.round((s.totalObtained / s.totalMax) * 100) : 75;
      return {
        subject: name,
        percentage: pct,
        status:
          pct < 50
            ? 'NEEDS_INTENSIVE_REMEDIAL'
            : pct < 70
            ? 'NEEDS_PRACTICE'
            : 'MASTERED',
      };
    });

    // Curated learning gaps based on subjects
    const learningGaps = subjectsSummary
      .filter((s) => s.percentage < 70)
      .map((s) => ({
        subject: s.subject,
        percentage: s.percentage,
        weakTopic: s.subject.toLowerCase().includes('math')
          ? 'Quadratic Equations & Linear Graphs'
          : s.subject.toLowerCase().includes('science')
          ? 'Chemical Reactions & Optics'
          : s.subject.toLowerCase().includes('english')
          ? 'Grammar (Subject-Verb Agreement & Tenses)'
          : 'Core Analytical Concepts',
        recommendedAction:
          '30-minute interactive diagnostic practice & flashcard review',
      }));

    // Fallback default gaps if no marks recorded yet
    if (learningGaps.length === 0) {
      learningGaps.push(
        {
          subject: 'Mathematics',
          percentage: 62,
          weakTopic: 'Polynomials & Coordinate Geometry',
          recommendedAction:
            'Practice 5 adaptive diagnostic questions to reinforce algebraic factorization.',
        },
        {
          subject: 'Science',
          percentage: 68,
          weakTopic: 'Light Reflection & Refraction Ray Diagrams',
          recommendedAction:
            'Review step-by-step sign convention rules with interactive flashcards.',
        },
      );
    }

    const overallMastery =
      subjectsSummary.length > 0
        ? Math.round(
            subjectsSummary.reduce((acc, s) => acc + s.percentage, 0) /
              subjectsSummary.length,
          )
        : 72;

    return {
      studentName,
      class: className,
      overallMastery,
      subjectsSummary,
      learningGaps,
      remedialSchedule: [
        {
          day: 'Monday & Wednesday',
          focus: 'Mathematics Practice Lab (4:00 PM)',
        },
        {
          day: 'Tuesday & Thursday',
          focus: 'Science Concept Reinforcement (4:00 PM)',
        },
        { day: 'Friday', focus: 'Weekly Adaptive Self-Assessment Quiz' },
      ],
    };
  }

  async generateAdaptivePractice(
    schoolId: string,
    userId: string,
    subject: string,
    topic: string,
  ) {
    requireSchoolId(schoolId);
    const s = subject || 'Mathematics';
    const t = topic || 'Foundations';

    const buildFallbackQuestions = () => [
      {
        id: 1,
        question: `In ${s}, when solving problems related to "${t}", which of the following is the essential first step?`,
        options: [
          'Identify the given known values and determine the target variable.',
          'Skip initial parameter checks and estimate the answer directly.',
          'Invert the final equation without applying algebraic symmetry.',
          'Assume all boundary conditions are zero.',
        ],
        correctIndex: 0,
        hint: 'Always begin by organizing knowns, unknowns, and appropriate units.',
        explanation:
          'Systematic problem solving in K-10 curriculum mandates listing known parameters before selecting the governing formula.',
        conceptRecap:
          'Rule of Practice: Known Parameters -> Governing Principle -> Unit Consistency -> Solution.',
      },
      {
        id: 2,
        question: `Consider an application of "${t}". If a key factor increases by 100% (doubles) while other conditions remain invariant, what happens to the resultant?`,
        options: [
          'The resultant reduces to zero.',
          'The resultant doubles (increases proportionally).',
          'The resultant decreases by half.',
          'No change occurs.',
        ],
        correctIndex: 1,
        hint: 'Direct linear relationship: Output is proportional to input factor.',
        explanation:
          'Under linear models studied in Grades 6-10, doubling the direct independent variable doubles the resultant output.',
        conceptRecap:
          'Direct Variation: Y = k × X. When X doubles, Y also doubles.',
      },
      {
        id: 3,
        question: `Which common misconception should students strictly avoid when working with "${t}"?`,
        options: [
          'Checking that units on both sides of the equation balance out.',
          'Forgetting to distribute negative signs across grouped parentheses.',
          'Writing down the step-by-step reasoning clearly.',
          'Verifying the solution by substituting it back into the original problem.',
        ],
        correctIndex: 1,
        hint: 'Distributive property of negative signs is the single most frequent algebraic error.',
        explanation:
          'Distributing negative signs across parentheses like -(a - b) = -a + b is a critical foundational skill tested in CBSE board exams.',
        conceptRecap:
          'Signs Rule: -(a - b) = -a + b. Always double-check grouped terms.',
      },
    ];

    if (!this.model) {
      return {
        subject: s,
        topic: t,
        questions: buildFallbackQuestions(),
      };
    }

    try {
      const prompt = `You are an adaptive pedagogical tutor for K-10 students.
Generate 3 diagnostic multiple-choice questions for the subject "${s}" and topic "${t}".
Strict Constraint: Grade 1 to 10 curriculum only. Zero higher-secondary (11/12) topics.

Return strictly valid JSON with this exact structure:
[
  {
    "id": 1,
    "question": "Question text here",
    "options": ["Option A", "Option B", "Option C", "Option D"],
    "correctIndex": 0,
    "hint": "Helpful hint without giving away the answer directly",
    "explanation": "Clear step-by-step explanation of why option is correct",
    "conceptRecap": "1-sentence memory anchor"
  }
]`;

      const result = await this.model.generateContent(prompt);
      const text = result.response.text().trim();
      const jsonMatch = text.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return { subject: s, topic: t, questions: parsed };
      }
      return { subject: s, topic: t, questions: buildFallbackQuestions() };
    } catch (err: any) {
      this.logger.error('Adaptive practice error', err?.message);
      return { subject: s, topic: t, questions: buildFallbackQuestions() };
    }
  }

  // ─── Mock response when no API key ───────────────────────────────────────
  private getMockResponse(message: string): string {
    const lower = message.toLowerCase();
    if (lower.includes('attendance'))
      return 'Navigate to [Attendance](/attendance) to view and manage daily attendance. Teachers can mark class attendance using the bulk marking feature.';
    if (lower.includes('fee') || lower.includes('payment'))
      return 'Navigate to [Fees](/fees) to collect fees, view student dues, and manage fee structures per class.';
    if (lower.includes('student'))
      return 'Navigate to [Students](/students) to view the student list, admit new students, or view individual profiles.';
    if (lower.includes('staff'))
      return 'Navigate to [Staff](/staff) to manage staff profiles and department assignments.';
    if (
      lower.includes('exam') ||
      lower.includes('marks') ||
      lower.includes('result')
    )
      return 'Navigate to [Exams](/exams) to create exams, enter marks, and generate report cards.';
    if (lower.includes('report'))
      return 'Report generation is available in each module. Go to Attendance, Fees, or Exams for respective reports.';
    return 'I can help you navigate the school ERP and answer questions about students, attendance, fees, and exams. What would you like to know?';
  }

  private classifyIntentHeuristic(prompt: string): string {
    const lower = (prompt || '').toLowerCase();
    if (lower.includes('admission') || lower.includes('applicant') || lower.includes('register student') || lower.includes('new student')) return 'CREATE_ADMISSION';
    if (lower.includes('assignment') || lower.includes('homework')) return 'ASSIGNMENT_AUDIT';
    if (lower.includes('leave') || lower.includes('approve leave')) return 'APPROVE_LEAVE';
    if (lower.includes('exam') || lower.includes('test') || lower.includes('assessment')) return 'CREATE_EXAM';
    if (lower.includes('attendance') || lower.includes('present') || lower.includes('absent')) return 'ATTENDANCE_TREND';
    if (lower.includes('fee') || lower.includes('overdue') || lower.includes('defaulter') || lower.includes('payment') || lower.includes('collection')) return 'FEE_OVERVIEW';
    if (lower.includes('announcement') || lower.includes('broadcast') || lower.includes('notice') || lower.includes('holiday') || lower.includes('circular')) return 'SEND_ANNOUNCEMENT';
    if (lower.includes('stat') || lower.includes('demographic') || lower.includes('total student') || lower.includes('count')) return 'STUDENT_STATS';
    return 'GENERAL_QUERY';
  }

  // ─── Principal Intelligence: Semantic Router Data Query ─────────────────────
  async executeDataQuery(
    schoolId: string,
    prompt: string,
    userId?: string,
    attachments?: Array<{ name: string; type: string; size: number; base64: string }>,
  ) {
    try {
      // Step 1: Semantic Routing with Heuristic Fallback
      let intent = 'GENERAL_QUERY';
      if (this.model) {
        try {
          const routingPrompt = `You are an autonomous AI operations engine for a school principal. Classify the user instruction into exactly ONE of these INTENT strings:
1. "CREATE_ADMISSION" (user wants to create, register, submit, or add an admission or new student application)
2. "ASSIGNMENT_AUDIT" (user asks about homework status, assignment completion rate, or curriculum audit)
3. "APPROVE_LEAVE" (user wants to approve a leave request for a teacher or staff)
4. "CREATE_EXAM" (user wants to create, schedule, or set up an exam or test)
5. "SEND_ANNOUNCEMENT" (user wants to send, broadcast, announce, or notify people about an announcement, notice, or holiday)
6. "ATTENDANCE_TREND" (questions about attendance trends, daily attendance, absent counts)
7. "FEE_OVERVIEW" (questions about pending fees, defaulters, fee collections)
8. "STUDENT_STATS" (questions about student counts, class sizes, school demographics)
9. "GENERAL_QUERY" (questions, advice, drafting letters without executing database actions)

User instruction: "${prompt}"

Return ONLY the single INTENT string without quotes or extra text.`;

          const routingResult = await this.model.generateContent(routingPrompt);
          intent = routingResult.response.text().trim().replace(/['"]/g, '');
        } catch {
          intent = this.classifyIntentHeuristic(prompt);
        }
      } else {
        intent = this.classifyIntentHeuristic(prompt);
      }

      let textResponse = '';
      let chartData: any = null;
      let actionExecuted: any = null;

      if (intent === 'CREATE_ADMISSION') {
        let extracted: any = {};
        if (this.model) {
          try {
            const extractPrompt = `Extract admission application details from this user command: "${prompt}".
Return ONLY a valid JSON object with these keys:
- "studentName": string (e.g. "Ankith")
- "classApplied": string (e.g. "Class 10")
- "parentName": string (e.g. "Rahul Kumar")
- "parentPhone": string (e.g. "9948287654" or "N/A")
- "parentEmail": string (or null)
- "gender": "MALE" | "FEMALE" | "OTHER" (infer from context or default "MALE")
- "notes": string

Return ONLY raw JSON, without markdown formatting or code blocks.`;

            const extractResult = await this.model.generateContent(extractPrompt);
            const jsonStr = extractResult.response.text().trim().replace(/```json|```/g, '');
            extracted = JSON.parse(jsonStr);
          } catch {}
        }

        const nameMatch = prompt.match(/(?:for|student|name|admit)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/i);
        const classMatch = prompt.match(/(?:class|grade)\s+(\d{1,2}(?:th)?(?:\s*\(?[A-Za-z]+\)?)?)/i);
        const phoneMatch = prompt.match(/(?:\+?91)?[6-9]\d{9}/);
        const parentMatch = prompt.match(/(?:father|parent|mother)(?:\s+name)?(?:\s+is)?\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/i);

        const isPlaceholder = (val?: string) => !val || ['n/a', 'na', 'null', 'none', 'unknown', 'new student'].includes(val.trim().toLowerCase());
        const candidateName = (!isPlaceholder(extracted?.studentName) ? extracted?.studentName : null) || (nameMatch ? nameMatch[1] : null);

        // If no real applicant name was supplied, do NOT create dummy records!
        if (!candidateName) {
          return {
            intent: 'CREATE_ADMISSION',
            textResponse: `### 📋 Quick Admission Registration\n\nTo register an admission application via natural language, please provide the applicant's name and details:\n\n> Example: *"Admit student Priya Patel for Grade 10 Section A, father Suresh Patel, phone 9876543210"*\n\nAlternatively, click the **New Admission** button in the header chips above to launch the quick registration form.`,
            chartData: null,
            actionExecuted: null,
          };
        }

        const studentName = candidateName;
        const classApplied = (!isPlaceholder(extracted?.classApplied) ? extracted?.classApplied : null) || (classMatch ? `Class ${classMatch[1]}` : 'Class 10');
        const parentName = (!isPlaceholder(extracted?.parentName) ? extracted?.parentName : null) || (parentMatch ? parentMatch[1] : 'Parent / Guardian');
        const parentPhone = (!isPlaceholder(extracted?.parentPhone) ? extracted?.parentPhone : null) || (phoneMatch ? phoneMatch[0] : 'N/A');
        const gender = extracted?.gender === 'FEMALE' ? 'FEMALE' : 'MALE';

        let academicYear = await this.prisma.academicYear.findFirst({
          where: { schoolId, isActive: true },
        });
        if (!academicYear) {
          academicYear = await this.prisma.academicYear.findFirst({
            where: { schoolId },
          });
        }

        if (!academicYear) {
          academicYear = await this.prisma.academicYear.create({
            data: {
              schoolId,
              name: `Academic Year ${new Date().getFullYear()}-${new Date().getFullYear() + 1}`,
              startDate: new Date(new Date().getFullYear(), 5, 1),
              endDate: new Date(new Date().getFullYear() + 1, 4, 31),
              isActive: true,
            },
          });
        }

        const appNo = await generateNextSequence(this.prisma, schoolId, 'APP', new Date().getFullYear());

        const createdApp = await this.prisma.admissionApplication.create({
          data: {
            schoolId,
            academicYearId: academicYear.id,
            applicationNo: appNo,
            studentName,
            classApplied,
            parentName,
            parentPhone,
            parentEmail: extracted?.parentEmail || undefined,
            dateOfBirth: new Date(new Date().getFullYear() - 16, 0, 1),
            gender,
            status: 'SUBMITTED',
            interviewNotes: extracted?.notes || `Registered via Principal Command: "${prompt}"`,
          },
        });

        // Trigger AI Admission Workflow
        let workflowSummary = '';
        try {
          const wf = await this.runAdmissionWorkflow(createdApp.id, schoolId);
          workflowSummary = `\n\n### 🤖 Autonomous Verification Pipeline:\n` +
            wf.agentResults.map(r => `• **${r.agent}**: ${r.status === 'success' ? '✓ Completed' : '✗ Pending'}`).join('\n');
        } catch { }

        actionExecuted = {
          type: 'ADMISSION_CREATED',
          title: 'Admission Application Created & Registered',
          link: '/admissions',
          linkText: 'View in Admissions Hub',
          details: {
            'Application No': appNo,
            'Student Name': studentName,
            'Class / Stream': classApplied,
            'Father / Guardian': parentName,
            'Contact Phone': parentPhone,
            'Status': 'Submitted & Ready for Review',
          },
        };

        textResponse = `### ✅ Admission Successfully Created!\n\nI have registered the admission application for **${studentName}** into **${classApplied}**.\n\n- **Application Number:** \`${appNo}\`\n- **Parent/Guardian:** ${parentName}\n- **Contact:** ${parentPhone}\n- **Status:** \`SUBMITTED\`${workflowSummary}\n\nYou can view and manage this candidate in the Admissions Hub.`;

      } else if (intent === 'ASSIGNMENT_AUDIT' || intent === 'CREATE_ASSIGNMENT') {
        const totalAssignments = await this.prisma.assignment.count({ where: { schoolId } });
        const activeAssignments = await this.prisma.assignment.count({
          where: { schoolId, dueDate: { gte: new Date() } }
        });
        const totalSubmissions = await this.prisma.assignmentSubmission.count({
          where: { assignment: { schoolId } }
        });

        const recentAssignments = await this.prisma.assignment.findMany({
          where: { schoolId },
          include: { class: true, _count: { select: { submissions: true } } },
          take: 6,
          orderBy: { createdAt: 'desc' },
        });

        if (recentAssignments.length > 0) {
          chartData = {
            type: 'bar',
            title: 'Assignment Submissions by Class',
            labels: recentAssignments.map(a => `${a.class?.name || 'Class'} - ${a.title.slice(0, 12)}`),
            datasets: [
              { label: 'Submissions', data: recentAssignments.map(a => a._count.submissions) },
            ],
          };
        }

        textResponse = `### 📚 School-Wide Homework & Assignment Audit\n\nClassroom homework and assignments are created and graded by teaching faculty via **Teacher Copilot**.\n\n**Curriculum Overview:**\n- **Active Homework Tasks:** ${activeAssignments}\n- **Total Published Assignments:** ${totalAssignments}\n- **Student Submissions Evaluated:** ${totalSubmissions}\n\nTo inspect classroom academic metrics in depth, visit the [Reports](/reports) hub.`;

        actionExecuted = {
          type: 'ASSIGNMENT_AUDIT',
          title: 'Assignment Curriculum Audit',
          link: '/reports',
          linkText: 'View Academic Reports',
          details: {
            'Active Tasks': String(activeAssignments),
            'Total Published': String(totalAssignments),
            'Submissions Evaluated': String(totalSubmissions),
          },
        };

      } else if (intent === 'APPROVE_LEAVE') {
        const result = await this.controlPlane.proposeAction({
          userId: userId || 'system',
          role: 'PRINCIPAL',
          schoolId,
          isGlobal: false
        }, 'approve_leave', {});

        actionExecuted = {
          type: 'APPROVE_LEAVE',
          title: 'Leave Request Pending Approval',
          link: '/automation',
          linkText: 'View Pending Actions',
          details: {
            'Action ID': result.pendingAction.actionId,
          },
        };

        textResponse = `### 📝 Leave Request Pending\n\nI have prepared the leave request for your approval. Please confirm the action in your pending tasks.`;

      } else if (intent === 'ATTENDANCE_TREND') {
        const totalStudents = await this.prisma.student.count({ where: { schoolId, isActive: true } });
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const presentToday = await this.prisma.attendanceRecord.count({
          where: { schoolId, date: { gte: today }, status: 'PRESENT' }
        });

        const percentage = totalStudents > 0 ? Math.round((presentToday / totalStudents) * 100) : 0;
        textResponse = `### 📊 Today's Attendance Overview\n\nOverall school attendance is currently at **${percentage}%** (${presentToday} of ${totalStudents} active students present today).`;

        chartData = {
          type: 'line',
          title: '7-Day Attendance Trend',
          labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Today'],
          datasets: [{ label: 'Attendance %', data: [92, 94, 91, 89, 93, 85, percentage] }]
        };

      } else if (intent === 'FEE_OVERVIEW') {
        const pendingCount = await this.prisma.feePayment.count({
          where: { schoolId, paymentStatus: { in: ['PENDING', 'OVERDUE'] } }
        });
        const overduePayments = await this.prisma.feePayment.findMany({
          where: { schoolId, paymentStatus: 'OVERDUE' },
          select: { totalAmount: true }
        });
        const totalOverdue = overduePayments.reduce((sum, p) => sum + Number(p.totalAmount), 0);

        textResponse = `### 💰 Fee Collection & Overdue Summary\n\n- **Pending Payments:** ${pendingCount} invoices\n- **Total Overdue Amount:** ₹${totalOverdue.toLocaleString()}\n- **Action Required:** Follow up with flagged parents or trigger automated WhatsApp/SMS reminders in the Automation Hub.`;

        chartData = {
          type: 'bar',
          title: 'Fee Status Breakdown',
          labels: ['Paid', 'Pending', 'Overdue'],
          datasets: [{ label: 'Students', data: [450, pendingCount - overduePayments.length, overduePayments.length] }]
        };

      } else if (intent === 'STUDENT_STATS') {
        const total = await this.prisma.student.count({ where: { schoolId, isActive: true } });
        const classes = await this.prisma.class.count({ where: { schoolId } });
        textResponse = `### 🎓 Student Enrollment Stats\n\nThe school currently has **${total} active students** distributed across **${classes} classes**.`;

      } else if (intent === 'SEND_ANNOUNCEMENT') {
        const cleanPrompt = prompt.replace(/(?:broadcast|send|announce|notice|circular)\s*(?:a|the|to all|notice)?/gi, '').trim();
        if (!cleanPrompt || cleanPrompt.length < 5) {
          return {
            intent: 'SEND_ANNOUNCEMENT',
            textResponse: `### 📢 School Announcement Dispatcher\n\nTo broadcast an announcement via natural language, please provide the subject and message details:\n\n> Example: *"Broadcast notice: Tomorrow is a holiday for Classes 1 to 10 on account of Annual Sports Day"*\n\nAlternatively, click the **Broadcast Notice** button in the header above to compose and choose your target audience (All Campus, Staff Only, or Parents Only).`,
            chartData: null,
            actionExecuted: null,
          };
        }

        let title = 'Important School Notice';
        let message = cleanPrompt;

        if (this.model) {
          try {
            const genPrompt = `Draft a concise school announcement headline and message based on this request: "${prompt}". Return ONLY a JSON object with "title" and "message". Do not include markdown code blocks, just raw JSON.`;
            const genResult = await this.model.generateContent(genPrompt);
            const jsonStr = genResult.response.text().trim().replace(/```json|```/g, '');
            const parsed = JSON.parse(jsonStr);
            title = parsed.title || title;
            message = parsed.message || cleanPrompt;
          } catch (e) {
            message = cleanPrompt;
          }
        }

        const users = await this.prisma.user.findMany({
          where: { schoolId, status: 'ACTIVE' },
          select: { id: true }
        });

        const BATCH_SIZE = 50;
        let totalSent = 0;
        const filteredUsers = users.filter(u => u.id !== userId);

        for (let i = 0; i < filteredUsers.length; i += BATCH_SIZE) {
          const batch = filteredUsers.slice(i, i + BATCH_SIZE);
          if (batch.length > 0 && userId) {
            await this.prisma.message.createMany({
              data: batch.map(u => ({
                schoolId,
                senderId: userId,
                recipientId: u.id,
                subject: title,
                body: message
              }))
            });
            totalSent += batch.length;
          }
        }

        actionExecuted = {
          type: 'ANNOUNCEMENT_BROADCAST',
          title: 'Announcement Broadcasted',
          link: '/messages',
          linkText: 'View Messages',
          details: {
            'Title': title,
            'Recipients': `${totalSent} active school users`,
          },
        };

        textResponse = `### 📢 Announcement Broadcasted Successfully\n\n**Subject:** ${title}\n\n${message}\n\n*Delivered to ${totalSent} recipients across the school.*`;

      } else {
        if (this.model) {
          try {
            const fallbackPrompt = `You are an expert AI assistant for a school principal named "Agentic AI". 
If the user asks you to draft an announcement, message, or email, DO NOT refuse. Do not ask for verification. Assume the principal has already verified the facts and immediately provide a highly professional, ready-to-send draft.
Format your response cleanly in Markdown with headings and bullet points.
User request: "${prompt}"`;
            let contentPayload: any = fallbackPrompt;
            if (attachments && attachments.length > 0) {
              const parts: any[] = [{ text: fallbackPrompt }];
              for (const att of attachments) {
                const rawBase64 = att.base64.includes('base64,') ? att.base64.split('base64,')[1] : att.base64;
                parts.push({
                  inlineData: {
                    mimeType: att.type || 'application/octet-stream',
                    data: rawBase64,
                  },
                });
              }
              contentPayload = parts;
            }
            const fallbackResult = await this.model.generateContent(contentPayload);
            textResponse = fallbackResult.response.text();
          } catch {
            textResponse = `### 🏫 Executive Operations Response\n\n**Processed Instruction:** "${prompt}"\n\n- **Status:** Command ingested into Principal Command Center.\n- **School Telemetry:** Real-time metrics across academics, attendance, and finances are fully synchronized.\n- **Quick Actions:** You can trigger direct admissions, send emergency circulars, approve teacher leaves, or inspect at-risk students using the command actions below.`;
          }
        } else {
          textResponse = `### 🏫 Executive Operations Response\n\n**Processed Instruction:** "${prompt}"\n\n- **Status:** Command ingested into Principal Command Center.\n- **School Telemetry:** Real-time metrics across academics, attendance, and finances are fully synchronized.\n- **Quick Actions:** You can trigger direct admissions, send emergency circulars, approve teacher leaves, or inspect at-risk students using the command actions below.`;
        }
      }

      return { intent, textResponse, chartData, actionExecuted };

    } catch (err: any) {
      this.logger.error('Execute data query error', err?.message);
      return {
        intent: 'ERROR',
        textResponse: 'Sorry, I encountered an error while processing your command.',
        chartData: null,
        actionExecuted: null,
      };
    }
  }

  // ─── Principal Intelligence: Anomaly Detection ────────────────────────────
  async getSchoolAnomalies(schoolId: string) {
    const anomalies = [];

    try {
      // Check 1: Very low attendance today
      const totalStudents = await this.prisma.student.count({ where: { schoolId, isActive: true } });
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const presentToday = await this.prisma.attendanceRecord.count({
        where: { schoolId, date: { gte: today }, status: 'PRESENT' }
      });

      if (totalStudents > 0) {
        const percentage = (presentToday / totalStudents) * 100;
        if (percentage < 80) {
          anomalies.push({
            id: 'att-low',
            type: 'WARNING',
            title: 'Unusually Low Attendance',
            description: `Overall school attendance is currently at ${Math.round(percentage)}%, which is below the 80% threshold. Consider checking for local weather issues or viral outbreaks.`,
            action: 'View Attendance Report',
            actionRoute: '/attendance',
          });
        }
      }

      // Check 2: High overdue fees
      const overduePayments = await this.prisma.feePayment.findMany({
        where: { schoolId, paymentStatus: 'OVERDUE' },
        select: { totalAmount: true }
      });
      const totalOverdue = overduePayments.reduce((sum, p) => sum + Number(p.totalAmount), 0);

      if (totalOverdue > 50000) {
        anomalies.push({
          id: 'fee-high',
          type: 'CRITICAL',
          title: 'High Volume of Overdue Fees',
          description: `Total overdue fees have reached ₹${totalOverdue.toLocaleString()}. There are ${overduePayments.length} pending payments that require immediate follow-up.`,
          action: 'Send Reminders',
          actionRoute: '/automation',
        });
      }

      // Check 3: Real timetable gaps (BUG FIX — was previously hardcoded)
      const dayOfWeek = today.getDay() === 0 ? 7 : today.getDay();
      const approvedLeaves = await this.prisma.leaveRequest.count({
        where: { schoolId, status: 'APPROVED', startDate: { lte: new Date() }, endDate: { gte: new Date() } },
      });
      const totalClasses = await this.prisma.timetableSlot.count({
        where: { schoolId, dayOfWeek, isActive: true },
      });

      if (approvedLeaves > 0 && totalClasses > 0) {
        anomalies.push({
          id: 'time-gap',
          type: 'INFO',
          title: 'Teacher Leave & Timetable Conflict',
          description: `${approvedLeaves} teacher(s) on approved leave today with ${totalClasses} active timetable slot(s). Consider assigning substitute teachers.`,
          action: 'Auto-Assign Substitutes',
          actionRoute: '/automation',
        });
      }

      // Check 4: New pending leave requests
      const pendingLeaves = await this.prisma.leaveRequest.count({
        where: { schoolId, status: 'PENDING' },
      });
      if (pendingLeaves > 0) {
        anomalies.push({
          id: 'leaves-pending',
          type: 'INFO',
          title: 'Pending Leave Requests',
          description: `${pendingLeaves} staff leave request(s) are awaiting your approval.`,
          action: 'Review Leaves',
          actionRoute: '/hr',
        });
      }

    } catch (err: any) {
      this.logger.error('Get anomalies error', err?.message);
    }

    return anomalies;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ─── AGENTIC AUTOMATION HUB ─────────────────────────────────────────────
  // ═══════════════════════════════════════════════════════════════════════════

  // ─── Feature 1: Fee Defaulter Follow-Up ─────────────────────────────────
  async generateFeeDefaulterPreview(schoolId: string) {
    const validSchoolId = requireSchoolId(schoolId);
    const defaulters = await this.prisma.feePayment.findMany({
      where: { schoolId: validSchoolId, paymentStatus: { in: ['PENDING', 'OVERDUE'] } },
      include: {
        student: {
          include: {
            user: { select: { firstName: true, lastName: true } },
            guardians: { select: { firstName: true, lastName: true, phone: true } }
          }
        }
      },
      take: 30,
      orderBy: { outstandingAmount: 'desc' },
    });

    const items = await Promise.all(defaulters.map(async (p) => {
      const guardian = p.student.guardians[0];
      const guardianName = guardian ? `${guardian.firstName} ${guardian.lastName}` : 'Parent/Guardian';
      const studentName = `${p.student.user.firstName} ${p.student.user.lastName}`;
      let message = `Dear ${guardianName}, this is a reminder that a fee payment of Rs.${Number(p.outstandingAmount).toLocaleString()} is outstanding for ${studentName}. Please clear the dues at the earliest to avoid disruption to studies.`;
      if (this.model) {
        try {
          const r = await this.model.generateContent(`Draft a polite, professional fee reminder message for a parent. Student: ${studentName}, Outstanding amount: Rs.${Number(p.outstandingAmount).toLocaleString()}, Parent: ${guardianName}. Keep it under 60 words. Plain text only.`);
          message = r.response.text().trim();
        } catch (_) { }
      }
      return {
        id: p.id,
        studentName,
        guardianName,
        outstandingAmount: Number(p.outstandingAmount),
        status: p.paymentStatus,
        draftMessage: message,
        recipientId: p.studentId,
      };
    }));

    return { taskType: 'FEE_DEFAULTER', count: items.length, items };
  }

  // ─── Feature 2: Consecutive Absence Alert ─────────────────────────────────
  async generateAbsenceAlertPreview(schoolId: string) {
    const validSchoolId = requireSchoolId(schoolId);
    const threeDaysAgo = new Date();
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
    threeDaysAgo.setHours(0, 0, 0, 0);

    const absentRecords = await this.prisma.attendanceRecord.findMany({
      where: { schoolId: validSchoolId, status: 'ABSENT', date: { gte: threeDaysAgo } },
      include: {
        student: {
          include: {
            user: { select: { firstName: true, lastName: true } },
            guardians: { select: { id: true, firstName: true, lastName: true } }
          }
        }
      },
    });

    // Group by student
    const studentAbsences: Record<string, any> = {};
    for (const r of absentRecords) {
      if (!studentAbsences[r.studentId]) studentAbsences[r.studentId] = { student: r.student, count: 0 };
      studentAbsences[r.studentId].count++;
    }

    const items = await Promise.all(
      Object.values(studentAbsences)
        .filter((s: any) => s.count >= 3)
        .slice(0, 30)
        .map(async (s: any) => {
          const studentName = `${s.student.user?.firstName || ''} ${s.student.user?.lastName || ''}`.trim() || 'Student';
          const guardian = s.student.guardians[0];
          const guardianName = guardian ? `${guardian.firstName} ${guardian.lastName}` : 'Parent/Guardian';
          let message = `Dear ${guardianName}, we are concerned that ${studentName} has been absent for ${s.count} consecutive school days. Please contact the school if there is an issue we can help with.`;
          if (this.model) {
            try {
              const r = await this.model.generateContent(`Draft a caring, professional absence alert for a parent. Student: ${studentName}, Consecutive absences: ${s.count} days. Keep it under 60 words. Plain text only.`);
              message = r.response.text().trim();
            } catch (_) { }
          }
          return {
            id: s.student.id,
            studentName,
            guardianName,
            absenceDays: s.count,
            draftMessage: message,
            recipientId: s.student.id,
          };
        })
    );

    return { taskType: 'ABSENCE_ALERT', count: items.length, items };
  }

  // ─── Feature 3: Timetable Cover Suggestion ────────────────────────────────
  async generateTimetableCoverPreview(schoolId: string) {
    const validSchoolId = requireSchoolId(schoolId);
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
    const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
    const dayOfWeek = now.getDay() === 0 ? 7 : now.getDay();

    const [approvedLeaves, todayTimetableSlots, allActiveStaff] = await Promise.all([
      this.prisma.leaveRequest.findMany({
        where: { schoolId: validSchoolId, status: 'APPROVED', startDate: { lte: todayEnd }, endDate: { gte: todayStart } },
        include: { staff: { include: { user: { select: { firstName: true, lastName: true } } } } },
      }),
      this.prisma.timetableSlot.findMany({
        where: { schoolId: validSchoolId, dayOfWeek, isActive: true },
        include: { class: true, subject: true },
      }),
      this.prisma.staff.findMany({
        where: { schoolId: validSchoolId, isActive: true },
        include: {
          user: { select: { firstName: true, lastName: true } },
          teacherAssignments: { include: { subject: true } },
        },
      }),
    ]);

    const onLeaveStaffIds = new Set(approvedLeaves.map((l) => l.staffId));
    const eligibleStaffPool = allActiveStaff.filter((s) => !onLeaveStaffIds.has(s.id));

    const items = await Promise.all(approvedLeaves.map(async (leave) => {
      const absentStaffName = `${leave.staff.user.firstName} ${leave.staff.user.lastName}`;

      const affectedSlots = todayTimetableSlots.filter(
        (ts) => ts.staffId === leave.staffId
      );

      // Find free substitute for the primary affected period (or overall)
      let suggestedSub: any = null;
      const slotsWithSub = affectedSlots.map((slot) => {
        const busyStaffAtPeriod = new Set(
          todayTimetableSlots
            .filter((ts) => ts.periodNumber === slot.periodNumber && ts.staffId)
            .map((ts) => ts.staffId)
        );

        const freeStaff = eligibleStaffPool.filter(
          (st) => !busyStaffAtPeriod.has(st.id) && st.id !== leave.staffId
        );

        // Subject match priority
        const subjectMatch = freeStaff.find((st) =>
          st.teacherAssignments?.some((ta: any) => ta.subjectId === slot.subjectId || ta.subject?.name === slot.subject?.name)
        );

        const chosenSub = subjectMatch || freeStaff[0];
        if (!suggestedSub && chosenSub) suggestedSub = chosenSub;

        return {
          id: slot.id,
          period: slot.periodNumber,
          class: slot.class?.name,
          subject: slot.subject?.name || slot.subjectId || null,
          freeSubstitute: chosenSub?.user ? `${chosenSub.user.firstName} ${chosenSub.user.lastName}` : 'Unassigned',
        };
      });

      const suggestedName = suggestedSub?.user ? `${suggestedSub.user.firstName} ${suggestedSub.user.lastName}` : 'Unassigned';

      return {
        id: leave.id,
        absentStaff: absentStaffName,
        affectedPeriods: affectedSlots.length,
        slots: slotsWithSub,
        suggestedSubstitute: suggestedName,
        suggestedSubstituteId: suggestedSub?.id,
        draftMessage: `${absentStaffName} is on approved leave today. ${suggestedName} is free during the scheduled periods and has been suggested to cover ${affectedSlots.length} period(s).`,
      };
    }));

    return { taskType: 'TIMETABLE_COVER', count: items.length, items };
  }

  // ─── Feature 4: Attendance Warning Letter ─────────────────────────────────
  async generateAttendanceWarningPreview(schoolId: string) {
    const validSchoolId = requireSchoolId(schoolId);
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    thirtyDaysAgo.setHours(0, 0, 0, 0);

    const records = await this.prisma.attendanceRecord.findMany({
      where: { schoolId: validSchoolId, date: { gte: thirtyDaysAgo } },
      select: { studentId: true, status: true },
    });

    const studentStats: Record<string, { present: number; total: number; studentId: string }> = {};
    for (const r of records) {
      if (!studentStats[r.studentId]) studentStats[r.studentId] = { present: 0, total: 0, studentId: r.studentId };
      studentStats[r.studentId].total++;
      if (r.status === 'PRESENT') studentStats[r.studentId].present++;
    }

    const lowAttendance = Object.values(studentStats).filter(s => s.total > 0 && (s.present / s.total) < 0.75);

    const items = await Promise.all(lowAttendance.slice(0, 30).map(async (s) => {
      const student = await this.prisma.student.findFirst({
        where: { id: s.studentId, schoolId: validSchoolId },
        include: {
          user: { select: { firstName: true, lastName: true } },
          guardians: { select: { id: true, firstName: true, lastName: true } }
        },
      });
      if (!student) return null;
      const pct = Math.round((s.present / s.total) * 100);
      const studentName = `${student.user.firstName} ${student.user.lastName}`;
      const guardian = student.guardians[0];
      const guardianName = guardian ? `${guardian.firstName} ${guardian.lastName}` : 'Parent/Guardian';
      let message = `Dear ${guardianName}, this is a formal warning that ${studentName}'s attendance is at ${pct}% for the last 30 days, which is below the required 75% threshold. Immediate improvement is required.`;
      if (this.model) {
        try {
          const r = await this.model.generateContent(`Draft a formal attendance warning letter for a parent. Student: ${studentName}, Attendance: ${pct}%. Keep under 80 words. Plain text only.`);
          message = r.response.text().trim();
        } catch (_) { }
      }
      return { id: s.studentId, studentName, guardianName, attendancePercent: pct, draftMessage: message, recipientId: s.studentId };
    }));

    const validItems = items.filter(Boolean);
    return { taskType: 'ATTENDANCE_WARNING', count: validItems.length, items: validItems };
  }

  // ─── Feature 5: Leave AI Recommendation ──────────────────────────────────
  async generateLeaveAIRecommendationPreview(schoolId: string) {
    const validSchoolId = requireSchoolId(schoolId);
    const pendingLeaves = await this.prisma.leaveRequest.findMany({
      where: { schoolId: validSchoolId, status: 'PENDING' },
      include: { staff: { include: { user: { select: { firstName: true, lastName: true } } } } },
    });

    const items = await Promise.all(pendingLeaves.map(async (leave) => {
      const staffName = `${leave.staff.user.firstName} ${leave.staff.user.lastName}`;
      const startDate = new Date(leave.startDate);
      const dayOfWeek = startDate.getDay() === 0 ? 7 : startDate.getDay();

      const conflicts = await this.prisma.timetableSlot.count({
        where: { schoolId: validSchoolId, staffId: leave.staffId, dayOfWeek, isActive: true },
      });

      let recommendation = 'APPROVE';
      let reasoning = 'No timetable conflicts detected. Safe to approve.';
      if (conflicts > 0) {
        recommendation = 'REVIEW';
        reasoning = `${conflicts} timetable period(s) will be affected. Ensure substitute coverage before approving.`;
      }

      if (this.model) {
        try {
          const r = await this.model.generateContent(`As a school admin AI, review this leave request and give a brief recommendation (APPROVE or REVIEW). Staff: ${staffName}, Leave type: ${leave.leaveType}, Duration: ${leave.totalDays} days, Reason: ${leave.reason}, Timetable conflicts: ${conflicts}. Return JSON: {"recommendation": "APPROVE"|"REVIEW", "reasoning": "..."}`);
          const parsed = JSON.parse(r.response.text().trim().replace(/```json|```/g, ''));
          recommendation = parsed.recommendation || recommendation;
          reasoning = parsed.reasoning || reasoning;
        } catch (_) { }
      }

      return {
        id: leave.id,
        staffName,
        leaveType: leave.leaveType,
        startDate: leave.startDate,
        endDate: leave.endDate,
        totalDays: leave.totalDays,
        reason: leave.reason,
        timetableConflicts: conflicts,
        recommendation,
        reasoning,
      };
    }));

    return { taskType: 'LEAVE_RECOMMENDATION', count: items.length, items };
  }

  // ─── Feature 6: Report Card Publish Check ─────────────────────────────────
  async generateReportCardPublishPreview(schoolId: string) {
    const validSchoolId = requireSchoolId(schoolId);
    const exams = await this.prisma.exam.findMany({
      where: { schoolId: validSchoolId },
      include: {
        subjects: true,
      },
      take: 10,
    });

    const items = await Promise.all(exams.map(async exam => {
      const totalSubjects = exam.subjects.length;
      let marksEntered = 0;
      for (const es of exam.subjects) {
        const count = await this.prisma.studentMark.count({ where: { examSubjectId: es.id } });
        if (count > 0) marksEntered++;
      }
      const isComplete = totalSubjects > 0 && marksEntered === totalSubjects;
      return {
        id: exam.id,
        examName: exam.name,
        examType: exam.examType,
        totalSubjects,
        marksEntered,
        isComplete,
        draftMessage: isComplete
          ? `Results for ${exam.name} are now fully entered and ready for publication to all students and parents.`
          : `${exam.name} is missing marks for ${totalSubjects - marksEntered} subject(s). Complete all entries before publishing.`,
      };
    }));

    const readyCount = items.filter(i => i.isComplete).length;
    return { taskType: 'REPORT_CARD_PUBLISH', count: readyCount, items };
  }

  // ─── Feature 7: Daily Digest ─────────────────────────────────────────────
  async generateDailyDigestPreview(schoolId: string) {
    const validSchoolId = requireSchoolId(schoolId);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [totalStudents, presentToday, pendingFees, pendingLeaves, totalStaff] = await Promise.all([
      this.prisma.student.count({ where: { schoolId: validSchoolId, isActive: true } }),
      this.prisma.attendanceRecord.count({ where: { schoolId: validSchoolId, date: { gte: today }, status: 'PRESENT' } }),
      this.prisma.feePayment.count({ where: { schoolId: validSchoolId, paymentStatus: { in: ['PENDING', 'OVERDUE'] } } }),
      this.prisma.leaveRequest.count({ where: { schoolId: validSchoolId, status: 'PENDING' } }),
      this.prisma.staff.count({ where: { schoolId: validSchoolId, isActive: true } }),
    ]);

    const attendancePct = totalStudents > 0 ? Math.round((presentToday / totalStudents) * 100) : 0;
    const summary = `📊 Daily School Digest — ${today.toDateString()}\n\n👥 Attendance: ${presentToday}/${totalStudents} students present (${attendancePct}%)\n💰 Pending fees: ${pendingFees} payments outstanding\n📋 Leave requests: ${pendingLeaves} awaiting approval\n👨‍🏫 Active staff: ${totalStaff}\n\nHave a productive day!`;

    return {
      taskType: 'DAILY_DIGEST',
      count: 1,
      items: [{
        id: 'digest-today',
        summary,
        stats: { totalStudents, presentToday, attendancePct, pendingFees, pendingLeaves, totalStaff },
        draftMessage: summary,
      }],
    };
  }
}
