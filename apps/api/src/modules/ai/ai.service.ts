import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../core/database/prisma.service';
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from '@google/generative-ai';

@Injectable()
export class AIService {
  private readonly logger = new Logger(AIService.name);
  private genAI: GoogleGenerativeAI | null = null;
  private model: any = null;
  private insightsCache: Record<string, { time: number; insights: string[] }> = {};

  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
  ) {
    const apiKey = this.config.get<string>('ai.geminiApiKey', '');
    if (apiKey) {
      this.genAI = new GoogleGenerativeAI(apiKey);
      this.model = this.genAI.getGenerativeModel({
        model: this.config.get<string>('ai.geminiModel', 'gemini-3.5-flash'),
        safetySettings: [
          { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
          { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
        ],
      });
    }
  }

  // ─── Build system prompt ─────────────────────────────────────────────────
  private async buildSystemPrompt(user: {
    id: string; firstName: string; lastName: string; role: string; schoolId?: string;
  }): Promise<string> {
    let schoolStats = '';
    if (user.schoolId) {
      try {
        const [students, staff, todayAtt] = await Promise.all([
          this.prisma.student.count({ where: { schoolId: user.schoolId, isActive: true } }),
          this.prisma.staff.count({ where: { schoolId: user.schoolId, isActive: true } }),
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

    return `You are an AI assistant for AI School ERP — an enterprise school management system.
Current user: ${user.firstName} ${user.lastName}, Role: ${user.role.replace('_', ' ')}.
${schoolStats}

You help school staff with:
- Answering questions about students, attendance, fees, and exams
- Explaining how to use the ERP features
- Providing data summaries and analysis
- Navigating the system (respond with route like "/attendance" for navigation requests)

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
    user: { id: string; firstName: string; lastName: string; role: string; schoolId?: string };
    conversationId?: string;
    message: string;
  }): Promise<{ conversationId: string; reply: string; tokens?: number }> {
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
            { role: 'model', parts: [{ text: 'Understood. I am ready to assist with the school ERP.' }] },
            ...history,
          ],
        });

        const result = await chat.sendMessage(data.message);
        const response = await result.response;
        reply = response.text();
        tokens = response.usageMetadata?.totalTokenCount;
      } catch (err: any) {
        this.logger.error('Gemini API error', err?.message);
        if (err?.status === 429 || err?.message?.includes('429')) {
          reply = "I'm currently receiving too many requests and hit the API rate limit. Please try again in a little while.";
        } else {
          reply = 'I encountered an error processing your request. Please try again in a moment.';
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
        modelUsed: this.config.get<string>('ai.geminiModel', 'gemini-3.5-flash'),
      },
    });

    // Update conversation title if first message
    if (!data.conversationId) {
      await this.prisma.aIConversation.update({
        where: { id: conversation.id },
        data: { title: data.message.slice(0, 60) },
      });
    }

    return { conversationId: conversation.id, reply, tokens };
  }

  // ─── Get conversations list ───────────────────────────────────────────────
  async getConversations(userId: string) {
    return this.prisma.aIConversation.findMany({
      where: { userId },
      select: {
        id: true, title: true, createdAt: true, updatedAt: true,
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

  // ─── Generate school insights for dashboard ───────────────────────────────
  async generateDashboardInsights(schoolId: string, user: any): Promise<string[]> {
    if (!this.model) {
      return [
        'Fee collection is tracking well this month.',
        'Monitor students with attendance below 75% — 3 students flagged.',
        'Exam results analysis ready after marks entry is complete.',
      ];
    }

    // Return cached insights if generated within the last hour
    const now = Date.now();
    if (this.insightsCache[schoolId] && (now - this.insightsCache[schoolId].time < 1000 * 60 * 60)) {
      return this.insightsCache[schoolId].insights;
    }

    try {
      const [students, staff, todayAtt, totalAtt, pendingFees] = await Promise.all([
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
          where: { schoolId, date: { gte: new Date(new Date().setHours(0, 0, 0, 0)) } },
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

  // ─── Mock response when no API key ───────────────────────────────────────
  private getMockResponse(message: string): string {
    const lower = message.toLowerCase();
    if (lower.includes('attendance')) return 'Navigate to [Attendance](/attendance) to view and manage daily attendance. Teachers can mark class attendance using the bulk marking feature.';
    if (lower.includes('fee') || lower.includes('payment')) return 'Navigate to [Fees](/fees) to collect fees, view student dues, and manage fee structures per class.';
    if (lower.includes('student')) return 'Navigate to [Students](/students) to view the student list, admit new students, or view individual profiles.';
    if (lower.includes('staff')) return 'Navigate to [Staff](/staff) to manage staff profiles and department assignments.';
    if (lower.includes('exam') || lower.includes('marks') || lower.includes('result')) return 'Navigate to [Exams](/exams) to create exams, enter marks, and generate report cards.';
    if (lower.includes('report')) return 'Report generation is available in each module. Go to Attendance, Fees, or Exams for respective reports.';
    return 'I can help you navigate the school ERP and answer questions about students, attendance, fees, and exams. What would you like to know?';
  }
}
