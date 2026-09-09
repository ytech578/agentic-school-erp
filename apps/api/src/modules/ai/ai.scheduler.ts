import { Injectable, Logger } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { AIService } from "./ai.service";
import { PrismaService } from "../../core/database/prisma.service";

@Injectable()
export class AIScheduler {
  private readonly logger = new Logger(AIScheduler.name);

  constructor(
    private aiService: AIService,
    private prisma: PrismaService,
  ) {}

  /**
   * Run proactive monitoring for ALL active schools every day at 7:00 AM IST.
   */
  @Cron("0 7 * * *", { name: "proactive-monitoring", timeZone: "Asia/Kolkata" })
  async handleDailyMonitoring() {
    this.logger.log("Running daily proactive AI monitoring for all schools...");
    try {
      const schools = await this.prisma.school.findMany({
        select: { id: true, name: true },
        where: { isActive: true },
      });

      for (const school of schools) {
        try {
          await this.aiService.runProactiveMonitoring(school.id);
          this.logger.log(`Monitoring complete for: ${school.name}`);
        } catch (err: any) {
          this.logger.error(`Monitoring failed for ${school.name}: ${err?.message}`);
        }
      }
      this.logger.log(`Daily monitoring complete for ${schools.length} schools.`);
    } catch (err: any) {
      this.logger.error("Daily monitoring scheduler error:", err?.message);
    }
  }
}