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

  async sendMail(options: SendMailOptions): Promise<void> {
    try {
      await this.transporter.sendMail({
        from: this.config.get<string>(
          'SMTP_FROM',
          'AI School ERP <noreply@schoolerp.com>',
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
      subject: 'Welcome to AI School ERP',
      html: this.getWelcomeTemplate(firstName, role, tempPassword),
    });
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
          <h2 style="color:#0f172a;">Welcome to AI School ERP!</h2>
          <p style="color:#475569;">Hi ${firstName},</p>
          <p style="color:#475569;">Your account has been created with the role of <strong>${role}</strong>.</p>
          ${tempPassword ? `<p style="color:#475569;">Your temporary password is: <strong style="background:#f1f5f9;padding:4px 8px;border-radius:4px;">${tempPassword}</strong></p><p style="color:#94a3b8;font-size:13px;">Please change your password after first login.</p>` : ''}
          <a href="${appUrl}/login" style="display:inline-block;background:#6366f1;color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:600;margin-top:16px;">Login to ERP</a>
        </div>
      </body>
      </html>
    `;
  }
}
