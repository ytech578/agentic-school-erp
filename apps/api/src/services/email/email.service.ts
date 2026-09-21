import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

export interface SendMailOptions {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
}

/**
 * Email Service Abstraction
 * MVP: Nodemailer
 * Future: Swap provider (Resend, SendGrid, SES) without changing callers
 */
@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private transporter: nodemailer.Transporter;

  public sentEmailsLog: Array<
    SendMailOptions & { timestamp: Date; category?: string }
  > = [];

  constructor(private config: ConfigService) {
    this.transporter = nodemailer.createTransport({
      host: this.config.get<string>('SMTP_HOST', 'smtp.gmail.com'),
      port: this.config.get<number>('SMTP_PORT', 587),
      secure: this.config.get<boolean>('SMTP_SECURE', false),
      auth: {
        user: this.config.get<string>('SMTP_USER', ''),
        pass: this.config.get<string>('SMTP_PASS', ''),
      },
    });
  }

  async sendMail(options: SendMailOptions, category?: string): Promise<void> {
    this.sentEmailsLog.push({ ...options, timestamp: new Date(), category });
    try {
      await this.transporter.sendMail({
        from: this.config.get<string>(
          'SMTP_FROM',
          'Agentic School ERP <noreply@schoolerp.com>',
        ),
        to: options.to,
        subject: options.subject,
        html: options.html,
        text: options.text,
      });
      this.logger.log(`Email sent to ${options.to}: ${options.subject}`);
    } catch (error) {
      this.logger.error(
        `Failed to send email to ${options.to}: ${error.message}`,
      );
      // Don't throw — email failure should not break the API flow
    }
  }

  async sendPasswordReset(
    to: string,
    firstName: string,
    resetUrl: string,
  ): Promise<void> {
    await this.sendMail({
      to,
      subject: 'Reset Your AI School ERP Password',
      html: this.getPasswordResetTemplate(firstName, resetUrl),
    });
  }

  async sendPasswordChanged(to: string, firstName: string): Promise<void> {
    await this.sendMail({
      to,
      subject: 'Your Password Has Been Changed',
      html: this.getPasswordChangedTemplate(firstName),
    });
  }

  async sendWelcome(
    to: string,
    firstName: string,
    role: string,
    tempPassword?: string,
  ): Promise<void> {
    await this.sendMail({
      to,
      subject: 'Welcome to Agentic School ERP',
      html: this.getWelcomeTemplate(firstName, role, tempPassword),
    });
  }

  async sendMajorNotification(
    to: string | string[],
    recipientName: string,
    subject: string,
    body: string,
    category: string,
    metadata?: any,
  ): Promise<void> {
    const formattedSubject = `[Official Notice] ${subject}`;
    await this.sendMail(
      {
        to,
        subject: formattedSubject,
        html: this.getMajorNotificationTemplate(
          recipientName,
          subject,
          body,
          category,
          metadata,
        ),
      },
      category,
    );
  }

  // ─── Email Templates ──────────────────────────────────────────────────────

  private getPasswordResetTemplate(
    firstName: string,
    resetUrl: string,
  ): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Reset Password</title>
      </head>
      <body style="margin:0;padding:0;background-color:#f1f5f9;font-family:Inter,-apple-system,BlinkMacSystemFont,sans-serif;">
        <div style="max-width:600px;margin:40px auto;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 6px rgba(0,0,0,0.07);">
          <div style="background:linear-gradient(135deg,#6366f1,#8b5cf6);padding:40px 40px 60px;text-align:center;">
            <h1 style="margin:0;color:#ffffff;font-size:24px;font-weight:700;">AI School ERP</h1>
            <p style="margin:8px 0 0;color:rgba(255,255,255,0.8);font-size:14px;">School Management System</p>
          </div>
          <div style="padding:40px;margin-top:-20px;background:#ffffff;border-radius:12px 12px 0 0;">
            <h2 style="margin:0 0 16px;color:#0f172a;font-size:20px;">Reset Your Password</h2>
            <p style="color:#475569;line-height:1.6;">Hi ${firstName},</p>
            <p style="color:#475569;line-height:1.6;">We received a request to reset your password. Click the button below to create a new password. This link will expire in <strong>1 hour</strong>.</p>
            <div style="text-align:center;margin:32px 0;">
              <a href="${resetUrl}" style="display:inline-block;background:linear-gradient(135deg,#6366f1,#8b5cf6);color:#ffffff;text-decoration:none;padding:14px 32px;border-radius:8px;font-weight:600;font-size:16px;">Reset Password</a>
            </div>
            <p style="color:#94a3b8;font-size:13px;line-height:1.6;">If you did not request a password reset, you can safely ignore this email. Your password will remain unchanged.</p>
            <p style="color:#94a3b8;font-size:12px;">Or copy this link: <a href="${resetUrl}" style="color:#6366f1;">${resetUrl}</a></p>
          </div>
          <div style="background:#f8fafc;padding:24px 40px;text-align:center;border-top:1px solid #e2e8f0;">
            <p style="margin:0;color:#94a3b8;font-size:12px;">© 2026 AI School ERP. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  private getPasswordChangedTemplate(firstName: string): string {
    return `
      <!DOCTYPE html>
      <html>
      <body style="margin:0;padding:0;background-color:#f1f5f9;font-family:Inter,-apple-system,sans-serif;">
        <div style="max-width:600px;margin:40px auto;background:#ffffff;border-radius:12px;padding:40px;">
          <h2 style="color:#0f172a;">Password Changed Successfully</h2>
          <p style="color:#475569;">Hi ${firstName},</p>
          <p style="color:#475569;">Your password has been changed successfully.</p>
          <p style="color:#475569;">If you did not make this change, please contact your administrator immediately.</p>
        </div>
      </body>
      </html>
    `;
  }

  private getWelcomeTemplate(
    firstName: string,
    role: string,
    tempPassword?: string,
  ): string {
    const appUrl = this.config.get('app.appUrl', 'http://localhost:3000');
    return `
      <!DOCTYPE html>
      <html>
      <body style="margin:0;padding:0;background-color:#f1f5f9;font-family:Inter,-apple-system,sans-serif;">
        <div style="max-width:600px;margin:40px auto;background:#ffffff;border-radius:12px;padding:40px;">
          <h2 style="color:#0f172a;">Welcome to Agentic School ERP!</h2>
          <p style="color:#475569;">Hi ${firstName},</p>
          <p style="color:#475569;">Your account has been created with the role of <strong>${role}</strong>.</p>
          ${tempPassword ? `<p style="color:#475569;">Your temporary password is: <strong style="background:#f1f5f9;padding:4px 8px;border-radius:4px;">${tempPassword}</strong></p><p style="color:#94a3b8;font-size:13px;">Please change your password after first login.</p>` : ''}
          <a href="${appUrl}/login" style="display:inline-block;background:#6366f1;color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:600;margin-top:16px;">Login to ERP</a>
        </div>
      </body>
      </html>
    `;
  }

  private getMajorNotificationTemplate(
    recipientName: string,
    subject: string,
    body: string,
    category: string,
    metadata?: any,
  ): string {
    const appUrl = this.config.get('app.appUrl', 'http://localhost:3000');
    const catUpper = (category || 'ANNOUNCEMENT').toUpperCase();

    let badgeBg = '#2563eb';
    let badgeText = '📢 OFFICIAL SCHOOL CIRCULAR';
    if (catUpper.includes('HOLIDAY')) {
      badgeBg = '#d97706';
      badgeText = '🏖️ OFFICIAL HOLIDAY NOTICE';
    } else if (catUpper.includes('EMERGENCY') || catUpper.includes('URGENT')) {
      badgeBg = '#dc2626';
      badgeText = '🚨 URGENT INSTITUTIONAL ADVISORY';
    } else if (catUpper.includes('EXAM')) {
      badgeBg = '#7c3aed';
      badgeText = '📝 ACADEMIC EXAMINATION NOTICE';
    } else if (catUpper.includes('FEE')) {
      badgeBg = '#0891b2';
      badgeText = '💳 FEE SCHEDULE ADVISORY';
    }

    const actionUrl = metadata?.actionUrl
      ? metadata.actionUrl.startsWith('http')
        ? metadata.actionUrl
        : `${appUrl}${metadata.actionUrl}`
      : null;

    const formattedBody = (body || '')
      .split('\n')
      .filter((p) => p.trim().length > 0)
      .map(
        (p) =>
          `<p style="color:#334155;line-height:1.7;margin:0 0 14px 0;font-size:15px;">${p}</p>`,
      )
      .join('');

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${subject}</title>
      </head>
      <body style="margin:0;padding:0;background-color:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:#f8fafc;padding:32px 16px;">
          <tr>
            <td align="center">
              <div style="max-width:620px;width:100%;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 10px 25px -5px rgba(0,0,0,0.08),0 8px 10px -6px rgba(0,0,0,0.04);border:1px solid #e2e8f0;">
                
                <!-- School Header Banner -->
                <div style="background:linear-gradient(135deg,#0f172a 0%,#1e3a8a 50%,#2563eb 100%);padding:36px 36px 30px;text-align:left;">
                  <div style="display:inline-block;padding:6px 12px;background:rgba(255,255,255,0.15);backdrop-filter:blur(8px);border-radius:20px;border:1px solid rgba(255,255,255,0.25);margin-bottom:12px;">
                    <span style="color:#ffffff;font-size:12px;font-weight:700;letter-spacing:0.05em;text-transform:uppercase;">🏛️ Sunrise International School</span>
                  </div>
                  <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:700;letter-spacing:-0.02em;line-height:1.3;">Official Institutional Notice</h1>
                  <p style="margin:6px 0 0;color:rgba(219,234,254,0.9);font-size:13px;">Academic Session 2026-27 · Verified School Circular</p>
                </div>

                <!-- Category Pill -->
                <div style="padding:0 36px;margin-top:-14px;">
                  <span style="display:inline-block;background:${badgeBg};color:#ffffff;font-size:12px;font-weight:700;padding:6px 16px;border-radius:30px;box-shadow:0 4px 10px rgba(0,0,0,0.12);letter-spacing:0.04em;">
                    ${badgeText}
                  </span>
                </div>

                <!-- Notice Body Content -->
                <div style="padding:28px 36px 36px;">
                  <div style="border-bottom:1px solid #e2e8f0;padding-bottom:18px;margin-bottom:22px;">
                    <h2 style="margin:0 0 8px;color:#0f172a;font-size:19px;font-weight:700;line-height:1.4;">${subject}</h2>
                    <p style="margin:0;color:#64748b;font-size:13px;">Date: ${new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })}</p>
                  </div>

                  <p style="color:#0f172a;font-size:15px;font-weight:600;margin:0 0 16px 0;">Dear ${recipientName},</p>
                  
                  <div style="margin-bottom:24px;">
                    ${formattedBody}
                  </div>

                  ${
                    actionUrl
                      ? `
                    <div style="text-align:center;margin:32px 0 24px;">
                      <a href="${actionUrl}" style="display:inline-block;background:linear-gradient(135deg,#1e40af,#2563eb);color:#ffffff;text-decoration:none;padding:14px 32px;border-radius:10px;font-weight:600;font-size:14px;box-shadow:0 4px 14px rgba(37,99,235,0.35);">View in School ERP Portal &rarr;</a>
                    </div>
                  `
                      : ''
                  }

                  <!-- Official Dispatch Disclaimer Box -->
                  <div style="background:#f8fafc;border-left:4px solid ${badgeBg};padding:14px 18px;border-radius:6px;margin-top:24px;">
                    <p style="margin:0;color:#475569;font-size:12px;line-height:1.5;">
                      <strong>Verified School Dispatch:</strong> This notification was officially transmitted by Sunrise International School Administration to your registered student/parent contact.
                    </p>
                  </div>
                </div>

                <!-- Footer -->
                <div style="background:#f1f5f9;padding:22px 36px;border-top:1px solid #e2e8f0;text-align:center;">
                  <p style="margin:0 0 4px;color:#64748b;font-size:12px;font-weight:600;">Sunrise International School · Office of the Principal</p>
                  <p style="margin:0;color:#94a3b8;font-size:11px;">Powered by Agentic School ERP · 256-Bit SSL Encrypted Communication</p>
                </div>
              </div>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `;
  }
}
