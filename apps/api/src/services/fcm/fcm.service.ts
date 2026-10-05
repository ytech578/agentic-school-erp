import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../core/database/prisma.service';
import { initializeApp, cert, App } from 'firebase-admin/app';
import { getMessaging } from 'firebase-admin/messaging';

export interface PushNotificationPayload {
  title: string;
  body: string;
  data?: Record<string, string>;
}

@Injectable()
export class FcmService implements OnModuleInit {
  private readonly logger = new Logger(FcmService.name);
  private firebaseApp: App | null = null;
  private isConfigured = false;

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  onModuleInit() {
    try {
      const serviceAccountJson = this.config.get<string>(
        'FIREBASE_SERVICE_ACCOUNT',
      );
      const projectId = this.config.get<string>('FIREBASE_PROJECT_ID');
      const clientEmail = this.config.get<string>('FIREBASE_CLIENT_EMAIL');
      const privateKey = this.config.get<string>('FIREBASE_PRIVATE_KEY');

      if (serviceAccountJson) {
        const credentials = JSON.parse(serviceAccountJson);
        this.firebaseApp = initializeApp({
          credential: cert(credentials),
        });
        this.isConfigured = true;
        this.logger.log('FCM initialized via service account credentials.');
      } else if (projectId && clientEmail && privateKey) {
        this.firebaseApp = initializeApp({
          credential: cert({
            projectId,
            clientEmail,
            privateKey: privateKey.replace(/\\n/g, '\n'),
          }),
        });
        this.isConfigured = true;
        this.logger.log('FCM initialized via environment variables.');
      } else {
        this.isConfigured = false;
        this.logger.warn(
          'FCM credentials not provided. Operating in graceful mock mode (push notifications will be logged).',
        );
      }
    } catch (err: any) {
      this.isConfigured = false;
      this.logger.error(
        `Failed to initialize Firebase Admin SDK: ${err.message}`,
      );
    }
  }

  // ─── 1. TOKEN REGISTRATION ────────────────────────────────────────────────

  async registerToken(
    userId: string,
    schoolId: string,
    token: string,
    platform: 'ANDROID' | 'IOS' | 'WEB' = 'ANDROID',
  ) {
    if (!token) return null;

    return this.prisma.deviceToken.upsert({
      where: { token },
      update: {
        userId,
        schoolId,
        platform,
        updatedAt: new Date(),
      },
      create: {
        userId,
        schoolId,
        token,
        platform,
      },
    });
  }

  async unregisterToken(token: string) {
    if (!token) return;
    try {
      await this.prisma.deviceToken.deleteMany({
        where: { token },
      });
    } catch (err: any) {
      this.logger.warn(`Failed to delete device token: ${err.message}`);
    }
  }

  // ─── 2. SEND PUSH NOTIFICATIONS ───────────────────────────────────────────

  async sendToUser(
    userId: string,
    payload: PushNotificationPayload,
  ): Promise<boolean> {
    const tokens = await this.prisma.deviceToken.findMany({
      where: { userId },
      select: { token: true },
    });

    if (tokens.length === 0) return false;
    const tokenList = tokens.map((t) => t.token);
    return this.sendMulticast(tokenList, payload);
  }

  async sendToSchool(
    schoolId: string,
    payload: PushNotificationPayload,
  ): Promise<boolean> {
    const tokens = await this.prisma.deviceToken.findMany({
      where: { schoolId },
      select: { token: true },
    });

    if (tokens.length === 0) return false;
    const tokenList = tokens.map((t) => t.token);
    return this.sendMulticast(tokenList, payload);
  }

  async sendToTopic(
    topic: string,
    payload: PushNotificationPayload,
  ): Promise<boolean> {
    if (!this.isConfigured || !this.firebaseApp) {
      this.logger.log(
        `[FCM Mock Topic] [${topic}] ${payload.title} - ${payload.body}`,
      );
      return true;
    }

    try {
      await getMessaging(this.firebaseApp).send({
        topic,
        notification: {
          title: payload.title,
          body: payload.body,
        },
        data: payload.data,
      });
      return true;
    } catch (err: any) {
      this.logger.error(`FCM topic push failed for ${topic}: ${err.message}`);
      return false;
    }
  }

  // ─── Internal: Send Multicast with Stale Token Pruning ─────────────────────

  private async sendMulticast(
    tokens: string[],
    payload: PushNotificationPayload,
  ): Promise<boolean> {
    if (!this.isConfigured || !this.firebaseApp) {
      this.logger.log(
        `[FCM Mock Push] [${tokens.length} devices] Title: "${payload.title}" | Body: "${payload.body}"`,
      );
      return true;
    }

    try {
      const response = await getMessaging(
        this.firebaseApp,
      ).sendEachForMulticast({
        tokens,
        notification: {
          title: payload.title,
          body: payload.body,
        },
        data: payload.data,
        android: {
          priority: 'high',
          notification: {
            channelId: 'school_erp_announcements',
            sound: 'default',
          },
        },
        apns: {
          payload: {
            aps: {
              sound: 'default',
              badge: 1,
            },
          },
        },
      });

      // Cleanup stale tokens that failed
      if (response.failureCount > 0) {
        const staleTokens: string[] = [];
        response.responses.forEach((resp: any, idx: number) => {
          if (!resp.success) {
            const errCode = resp.error?.code;
            if (
              errCode === 'messaging/registration-token-not-registered' ||
              errCode === 'messaging/invalid-registration-token'
            ) {
              staleTokens.push(tokens[idx]);
            }
          }
        });

        if (staleTokens.length > 0) {
          this.logger.log(
            `Pruning ${staleTokens.length} unregistered FCM tokens.`,
          );
          await this.prisma.deviceToken.deleteMany({
            where: { token: { in: staleTokens } },
          });
        }
      }

      return response.successCount > 0;
    } catch (err: any) {
      this.logger.error(`FCM multicast failed: ${err.message}`);
      return false;
    }
  }
}
