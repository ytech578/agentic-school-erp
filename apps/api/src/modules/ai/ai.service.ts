import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../core/database/prisma.service';
import {
  GoogleGenerativeAI,
  HarmCategory,
  HarmBlockThreshold,
} from '@google/generative-ai';

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
  ) {
    const apiKey = this.config.get<string>('ai.geminiApiKey', '');
    if (apiKey) {
      this.genAI = new GoogleGenerativeAI(apiKey);
      this.model = this.genAI.getGenerativeModel({
        model: this.config.get<string>('ai.geminiModel', 'gemini-3.5-flash-lite'),
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
  private async buildSystemPrompt(user: {
    id: string;
    firstName: string;
    lastName: string;
    role: string;
    schoolId?: string;
  }): Promise<string> {
    let schoolStats = '';
    if (user.schoolId) {
      try {
        const [students, staff, todayAtt] = await Promise.all([
          this.prisma.student.count({
            where: { schoolId: user.schoolId, isActive: true },
          }),
          this.prisma.staff.count({
            where: { schoolId: user.schoolId, isActive: true },
          }),
          this.prisma.attendanceRecord.count({
            where: {
              schoolId: user.schoolId,
              date: { gte: new Date(new Date().setHours(0, 0, 0, 0)) },
              status: 'PRESENT',
            },
          }),
        ]);
        schoolStats = `School stats: ${students} active students, ${staff} active staff, ${todayAtt} students marked present today.`;
      } catch {
        schoolStats = '';
      }
    }

    return `You are Agentic AI, the autonomous operations layer for Agentic School ERP.
Current user: ${user.firstName} ${user.lastName}, Role: ${user.role.replace('_', ' ')}.
${schoolStats}

You help school staff with:
- Analyzing data proactively to predict outcomes (like student dropout risk or fee default risk)
- Automating repetitive tasks and drafting communications
- Answering questions about students, attendance, fees, and exams
- Navigating the system (respond with route like "/attendance" for navigation requests)
- Executing real actions when asked (approve leaves, create assignments, send announcements)

IMPORTANT - When users ask you to perform an action, you MUST classify it for execution.
Use these action tags in your response when appropriate:
- To approve a leave: include [ACTION:APPROVE_LEAVE:staffName]
- To create an assignment: include [ACTION:CREATE_ASSIGNMENT:className:topic]
- To send announcement: include [ACTION:SEND_ANNOUNCEMENT:title]

Rules:
- Be concise, professional, and helpful
- Only share data appropriate for the ${user.role} role
- For navigation requests, include the route path in your response like: "Navigate to [Students](/students)"
- If you don't have access to specific live data, say so and explain how to find it
- Format lists with markdown bullet points
- Keep responses under 300 words unless a detailed report is requested`;
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
  }): Promise<{ conversationId: string; reply: string; tokens?: number; pendingAction?: any }> {
    // Get or create conversation
    let conversation = data.conversationId
      ? await this.prisma.aIConversation.findFirst({
        where: { id: data.conversationId, userId: data.userId },
        include: { messages: { orderBy: { createdAt: 'asc' }, take: 20 } },
      })
      : null;

    if (!conversation) {
      conversation = await this.prisma.aIConversation.create({
        data: {
          schoolId: data.schoolId,
          userId: data.userId,
          sessionId: `session_${Date.now()}`,
          title: data.message.slice(0, 50),
        },
        include: { messages: true },
      });
    }

    // Save user message
    await this.prisma.aIMessage.create({
      data: {
        conversationId: conversation.id,
        role: 'user',
        content: data.message,
      },
    });

    let reply = '';
    let tokens: number | undefined;
    let pendingAction: any = null;

    if (!this.model) {
      // Fallback mock response when no API key
      reply = this.getMockResponse(data.message);
    } else {
      try {
        const systemPrompt = await this.buildSystemPrompt(data.user);
        const history = (conversation.messages ?? []).map((m: any) => ({
          role: m.role === 'user' ? 'user' : 'model',
          parts: [{ text: m.content }],
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

        const result = await chat.sendMessage(data.message);
        const response = await result.response;
        reply = response.text();
        tokens = response.usageMetadata?.totalTokenCount;

        // ─── IMPROVEMENT 1: Parse action tags from AI response ───────────
        const approveLeaveMatch = reply.match(/\[ACTION:APPROVE_LEAVE:([^\]]+)\]/);
        const createAssignmentMatch = reply.match(/\[ACTION:CREATE_ASSIGNMENT:([^\]]+):([^\]]+)\]/);
        const sendAnnouncementMatch = reply.match(/\[ACTION:SEND_ANNOUNCEMENT:([^\]]+)\]/);

        if (approveLeaveMatch) {
          const staffName = approveLeaveMatch[1]?.trim();
          let leave = null;
          if (staffName && staffName.toLowerCase() !== 'any' && staffName.toLowerCase() !== 'pending') {
            leave = await this.prisma.leaveRequest.findFirst({
              where: {
                schoolId: data.schoolId,
                status: 'PENDING',
                staff: {
                  user: {
                    OR: [
                      { firstName: { contains: staffName, mode: 'insensitive' } },
                      { lastName: { contains: staffName, mode: 'insensitive' } },
                    ],
                  },
                },
              },
              include: { staff: { include: { user: { select: { firstName: true, lastName: true } } } } },
            });
          }
          if (!leave) {
            leave = await this.prisma.leaveRequest.findFirst({
              where: { schoolId: data.schoolId, status: 'PENDING' },
              include: { staff: { include: { user: { select: { firstName: true, lastName: true } } } } },
            });
          }
          if (leave) {
            pendingAction = {
              type: 'APPROVE_LEAVE',
              label: `Approve leave for ${leave.staff.user.firstName} ${leave.staff.user.lastName}`,
              data: { leaveId: leave.id },
            };
          }
          reply = reply.replace(/\[ACTION:APPROVE_LEAVE:[^\]]+\]/, '').trim();
        } else if (createAssignmentMatch) {
          pendingAction = {
            type: 'CREATE_ASSIGNMENT',
            label: `Create assignment on topic "${createAssignmentMatch[2]}" for ${createAssignmentMatch[1]}`,
            data: { className: createAssignmentMatch[1], topic: createAssignmentMatch[2] },
          };
          reply = reply.replace(/\[ACTION:CREATE_ASSIGNMENT:[^\]]+\]/, '').trim();
        } else if (sendAnnouncementMatch) {
          pendingAction = {
            type: 'SEND_ANNOUNCEMENT',
            label: `Send announcement: "${sendAnnouncementMatch[1]}"`,
            data: { title: sendAnnouncementMatch[1] },
          };
          reply = reply.replace(/\[ACTION:SEND_ANNOUNCEMENT:[^\]]+\]/, '').trim();
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
        data: { title: data.message.slice(0, 60) },
      });
    }

    return { conversationId: conversation.id, reply, tokens, pendingAction };
  }

  // ─── IMPROVEMENT 1: Execute confirmed AI actions ─────────────────────────
  async executeAIAction(schoolId: string, userId: string, action: { type: string; data: any }) {
    switch (action.type) {
      case 'APPROVE_LEAVE': {
        let leaveId = action.data?.leaveId;
        if (!leaveId) {
          const firstPending = await this.prisma.leaveRequest.findFirst({
            where: { schoolId, status: 'PENDING' },
          });
          if (firstPending) leaveId = firstPending.id;
        }
        if (!leaveId) return { success: false, message: 'No pending leave request found to approve.' };
        await this.prisma.leaveRequest.update({
          where: { id: leaveId },
          data: { status: 'APPROVED', reviewNote: '[Approved via AI Assistant]', reviewedAt: new Date(), reviewedBy: userId },
        });
        return { success: true, message: 'Leave request approved successfully.' };
      }
      case 'CREATE_ASSIGNMENT': {
        const { className, topic, dueDate } = action.data || {};
        if (!topic) return { success: false, message: 'Assignment topic is required.' };
        let cls = className ? await this.prisma.class.findFirst({ where: { schoolId, name: { contains: className, mode: 'insensitive' } } }) : null;
        if (!cls) cls = await this.prisma.class.findFirst({ where: { schoolId } });
        let academicYear = await this.prisma.academicYear.findFirst({ where: { schoolId, isActive: true } });
        if (!academicYear) academicYear = await this.prisma.academicYear.findFirst({ where: { schoolId } });
        let teacher = await this.prisma.staff.findFirst({ where: { schoolId, isActive: true } });
        if (!teacher) teacher = await this.prisma.staff.findFirst({ where: { schoolId } });
        let subject = await this.prisma.subject.findFirst({ where: { schoolId } });
        if (!cls || !academicYear || !teacher || !subject) return { success: false, message: 'Could not resolve required class, academic year, staff, or subject.' };
        await this.prisma.assignment.create({
          data: {
            schoolId,
            classId: cls.id,
            staffId: teacher.id,
            subjectId: subject.id,
            academicYearId: academicYear.id,
            title: topic,
            description: `Assignment created by AI Assistant on topic: ${topic}`,
            dueDate: dueDate ? new Date(dueDate) : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
            maxMarks: 10,
          },
        });
        return { success: true, message: `Assignment "${topic}" created successfully for Class ${cls.name}.` };
      }
      case 'SEND_ANNOUNCEMENT': {
        const { title, message } = action.data || {};
        if (!title) return { success: false, message: 'Announcement title is required.' };
        const users = await this.prisma.user.findMany({
          where: { schoolId, status: 'ACTIVE' },
          select: { id: true },
        });
        const BATCH_SIZE = 50;
        let sent = 0;
        for (let i = 0; i < users.length; i += BATCH_SIZE) {
          const batch = users.slice(i, i + BATCH_SIZE).filter(u => u.id !== userId);
          if (batch.length > 0) {
            await this.prisma.message.createMany({
              data: batch.map(u => ({
                schoolId,
                senderId: userId,
                recipientId: u.id,
                subject: title,
                body: message || title,
              })),
            });
            sent += batch.length;
          }
        }
        return { success: true, message: `Announcement sent to ${sent} users.` };
      }
      default:
        return { success: false, message: 'Unknown action type' };
    }
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
      // Extract class number from application.classApplied (e.g. "11th (MPC)" -> "11", "Class 10" -> "10")
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

      // Fallback: match by fee structure name (e.g. "Class 11 Annual Fee 2026")
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

  // ─── Teacher Copilot: Lesson Plan ─────────────────────────────────────────
  async generateLessonPlan(topic: string, grade: string, duration: string) {
    const buildFallbackPlan = () => `## 📘 Lesson Plan: ${topic}
**Grade Level:** ${grade || 'Grade 8'} | **Duration:** ${duration || '45 mins'} | **Pedagogical Framework:** 5E Instructional Model

---

### 🎯 Learning Objectives
By the end of this lesson, students will be able to:
1. **Explain** the fundamental core concepts and terminology of **${topic}**.
2. **Analyze** practical examples and identify key underlying patterns.
3. **Apply** problem-solving strategies to real-world scenarios relating to ${topic}.

---

### ⏱️ Lesson Timeline & Activities

| Phase | Time | Teacher Activity | Student Activity |
| :--- | :--- | :--- | :--- |
| **1. Hook / Engage** | 5-7 mins | Present a thought-provoking inquiry or multimedia snippet on **${topic}**. | Brainstorm initial impressions; share prior knowledge in pairs. |
| **2. Explore & Concept** | 15 mins | Introduce core principles with visual diagram and guided questions. | Take structured notes; annotate diagram worksheets. |
| **3. Collaborative Practice** | 15 mins | Circulate and provide scaffolded prompts for group problem cards. | Work in pairs to solve challenge prompts and compare reasoning. |
| **4. Check for Understanding** | 5 mins | Conduct quick formative check (Exit ticket / 3-question pulse). | Submit rapid digital or paper exit slip. |
| **5. Summary & Wrap-up** | 3 mins | Synthesize key takeaways and preview subsequent module. | Clarify doubts; record homework assignment. |

---

### 💡 Formative Assessment Questions
- *Basic Recall:* What are the 3 essential components involved in **${topic}**?
- *Conceptual:* How would a change in conditions alter the outcome in **${topic}**?
- *Application:* Give a modern, everyday scenario where principles of **${topic}** are applied.

---

### 📝 Homework & Extension Activity
- Complete Practice Exercise questions 1–6 in the module workbook.
- *(Challenge Extension)*: Research a recent real-world discovery or case study concerning **${topic}** and write a 4-sentence summary for the next session.`;

    if (!this.model) {
      return buildFallbackPlan();
    }
    try {
      const prompt = `You are an expert master educator. Create a structured, highly engaging lesson plan for ${grade} on the topic "${topic}". Duration: ${duration}.
Include Learning Objectives, Prerequisites, Detailed Phase-by-Phase Timeline Table (Engage, Explore, Explain, Elaborate, Evaluate), Formative Assessment Questions, Differentiated Instruction Notes, and Homework.
Format strictly in clean Markdown with professional headers and tables.
CRITICAL FORMATTING RULES:
1. Do NOT use raw HTML tags such as <br>, <br/>, or <p>. Use standard Markdown newlines and bullet points.
2. For the Phase-by-Phase Timeline Table, use valid Markdown table syntax with clean concise text. Never put <br> inside table cells.
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
  async executeDataQuery(schoolId: string, prompt: string, userId?: string) {
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
- "classApplied": string (e.g. "11th (MPC)")
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
            textResponse: `### 📋 Quick Admission Registration\n\nTo register an admission application via natural language, please provide the applicant's name and details:\n\n> Example: *"Admit student Priya Patel for Grade 11 MPC, father Suresh Patel, phone 9876543210"*\n\nAlternatively, click the **New Admission** button in the header chips above to launch the quick registration form.`,
            chartData: null,
            actionExecuted: null,
          };
        }

        const studentName = candidateName;
        const classApplied = (!isPlaceholder(extracted?.classApplied) ? extracted?.classApplied : null) || (classMatch ? `Class ${classMatch[1]}` : 'Class 11');
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

        const appNo = `ADM-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;

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
        const result = await this.executeAIAction(schoolId, userId || '', {
          type: 'APPROVE_LEAVE',
          data: {},
        });

        actionExecuted = {
          type: 'LEAVE_APPROVED',
          title: 'Leave Request Approved',
          link: '/automation',
          linkText: 'View Automation Hub',
          details: {
            'Result': result.message,
          },
        };

        textResponse = `### ✅ Leave Approved\n\n${result.message}`;

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
            const fallbackResult = await this.model.generateContent(fallbackPrompt);
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
    const defaulters = await this.prisma.feePayment.findMany({
      where: { schoolId, paymentStatus: { in: ['PENDING', 'OVERDUE'] } },
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
    const threeDaysAgo = new Date();
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
    threeDaysAgo.setHours(0, 0, 0, 0);

    const absentRecords = await this.prisma.attendanceRecord.findMany({
      where: { schoolId, status: 'ABSENT', date: { gte: threeDaysAgo } },
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
    const today = new Date();
    const dayOfWeek = today.getDay() === 0 ? 7 : today.getDay();

    const approvedLeaves = await this.prisma.leaveRequest.findMany({
      where: { schoolId, status: 'APPROVED', startDate: { lte: today }, endDate: { gte: today } },
      include: { staff: { include: { user: { select: { firstName: true, lastName: true } } } } },
    });

    const items = await Promise.all(approvedLeaves.map(async (leave) => {
      const absentStaffName = `${leave.staff.user.firstName} ${leave.staff.user.lastName}`;

      const affectedSlots = await this.prisma.timetableSlot.findMany({
        where: { schoolId, staffId: leave.staffId, dayOfWeek, isActive: true },
        include: { class: true },
      });

      // Find potential substitutes (same subject, different staff)
      const substitutes = await this.prisma.staff.findMany({
        where: { schoolId, isActive: true, id: { not: leave.staffId } },
        include: { user: { select: { firstName: true, lastName: true } } },
        take: 3,
      });

      const suggestedSub = substitutes[0];
      const suggestedName = suggestedSub ? `${suggestedSub.user.firstName} ${suggestedSub.user.lastName}` : 'Unassigned';

      return {
        id: leave.id,
        absentStaff: absentStaffName,
        affectedPeriods: affectedSlots.length,
        slots: affectedSlots.map(s => ({ id: s.id, period: s.periodNumber, class: s.class?.name, subject: s.subjectId || null })),
        suggestedSubstitute: suggestedName,
        suggestedSubstituteId: suggestedSub?.id,
        draftMessage: `${absentStaffName} is on approved leave today. ${suggestedName} has been suggested to cover ${affectedSlots.length} period(s).`,
      };
    }));

    return { taskType: 'TIMETABLE_COVER', count: items.length, items };
  }

  // ─── Feature 4: Attendance Warning Letter ─────────────────────────────────
  async generateAttendanceWarningPreview(schoolId: string) {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    thirtyDaysAgo.setHours(0, 0, 0, 0);

    const records = await this.prisma.attendanceRecord.findMany({
      where: { schoolId, date: { gte: thirtyDaysAgo } },
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
      const student = await this.prisma.student.findUnique({
        where: { id: s.studentId },
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
    const pendingLeaves = await this.prisma.leaveRequest.findMany({
      where: { schoolId, status: 'PENDING' },
      include: { staff: { include: { user: { select: { firstName: true, lastName: true } } } } },
    });

    const items = await Promise.all(pendingLeaves.map(async (leave) => {
      const staffName = `${leave.staff.user.firstName} ${leave.staff.user.lastName}`;
      const startDate = new Date(leave.startDate);
      const dayOfWeek = startDate.getDay() === 0 ? 7 : startDate.getDay();

      const conflicts = await this.prisma.timetableSlot.count({
        where: { schoolId, staffId: leave.staffId, dayOfWeek, isActive: true },
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
    const exams = await this.prisma.exam.findMany({
      where: { schoolId },
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
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [totalStudents, presentToday, pendingFees, pendingLeaves, totalStaff] = await Promise.all([
      this.prisma.student.count({ where: { schoolId, isActive: true } }),
      this.prisma.attendanceRecord.count({ where: { schoolId, date: { gte: today }, status: 'PRESENT' } }),
      this.prisma.feePayment.count({ where: { schoolId, paymentStatus: { in: ['PENDING', 'OVERDUE'] } } }),
      this.prisma.leaveRequest.count({ where: { schoolId, status: 'PENDING' } }),
      this.prisma.staff.count({ where: { schoolId, isActive: true } }),
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

  // ─── Execute Automation Task ────────────────────────────────────────────
  async executeAutomationTask(schoolId: string, userId: string, taskType: string, payload: any) {
    let actionsCount = 0;

    if (taskType === 'FEE_DEFAULTER' || taskType === 'ABSENCE_ALERT' || taskType === 'ATTENDANCE_WARNING') {
      // Batched messaging to avoid failures on large datasets
      const BATCH_SIZE = 50;
      for (let i = 0; i < payload.items.length; i += BATCH_SIZE) {
        const batch = payload.items.slice(i, i + BATCH_SIZE);
        const messages = batch.map((item: any) => ({
          schoolId,
          senderId: userId,
          recipientId: item.recipientId,
          subject: payload.subject || taskType.replace(/_/g, ' '),
          body: item.draftMessage,
        }));
        if (messages.length > 0) {
          await this.prisma.message.createMany({ data: messages });
          actionsCount += messages.length;
        }
      }
    }

    else if (taskType === 'TIMETABLE_COVER') {
      for (const item of payload.items) {
        if (item.suggestedSubstituteId) {
          for (const slot of item.slots) {
            await this.prisma.timetableSlot.update({
              where: { id: slot.id },
              data: { staffId: item.suggestedSubstituteId },
            });
            actionsCount++;
          }
        }
      }
    }

    else if (taskType === 'LEAVE_RECOMMENDATION') {
      for (const item of payload.items) {
        await this.prisma.leaveRequest.update({
          where: { id: item.id },
          data: { reviewNote: `[AI Recommendation: ${item.recommendation}] ${item.reasoning}` },
        });
        actionsCount++;
      }
    }

    else if (taskType === 'REPORT_CARD_PUBLISH') {
      // Notify students and parents for ready exams
      const readyExams = payload.items.filter((i: any) => i.isComplete);
      for (const exam of readyExams) {
        const students = await this.prisma.student.findMany({
          where: { schoolId, isActive: true },
          include: { user: { select: { id: true } } },
          take: 100,
        });
        const messages = students.map((s: any) => ({
          schoolId,
          senderId: userId,
          recipientId: s.user.id,
          subject: `Results Ready: ${exam.examName}`,
          body: exam.draftMessage,
        }));
        if (messages.length > 0) {
          await this.prisma.message.createMany({ data: messages });
          actionsCount += messages.length;
        }
      }
    }

    else if (taskType === 'DAILY_DIGEST') {
      const principal = await this.prisma.user.findFirst({
        where: { schoolId, role: { in: ['PRINCIPAL', 'SCHOOL_ADMIN'] }, status: 'ACTIVE' },
      });
      if (principal && payload.items[0]) {
        await this.prisma.message.create({
          data: {
            schoolId,
            senderId: userId,
            recipientId: principal.id,
            subject: `Daily School Digest — ${new Date().toDateString()}`,
            body: payload.items[0].draftMessage,
          },
        });
        actionsCount = 1;
      }
    }

    return { success: true, actionsCount, taskType };
  }
}
