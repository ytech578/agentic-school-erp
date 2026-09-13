import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface DispatchResult {
  success: boolean;
  channel: 'SMS' | 'WHATSAPP';
  recipient: string;
  messageId?: string;
  simulated?: boolean;
}

@Injectable()
export class SmsWhatsAppService {
  private readonly logger = new Logger(SmsWhatsAppService.name);
  private readonly twilioSid?: string;
  private readonly twilioToken?: string;
  private readonly twilioFrom?: string;
  private readonly whatsappToken?: string;
  private readonly whatsappPhoneId?: string;

  constructor(private config: ConfigService) {
    this.twilioSid = this.config.get<string>('TWILIO_ACCOUNT_SID');
    this.twilioToken = this.config.get<string>('TWILIO_AUTH_TOKEN');
    this.twilioFrom = this.config.get<string>('TWILIO_PHONE_NUMBER');
    this.whatsappToken = this.config.get<string>('WHATSAPP_API_TOKEN');
    this.whatsappPhoneId = this.config.get<string>('WHATSAPP_PHONE_NUMBER_ID');
  }

  async sendSMS(toPhone: string, text: string): Promise<DispatchResult> {
    const cleanPhone = toPhone.replace(/\s+/g, '');

    // Live Twilio SMS dispatch if credentials provided
    if (this.twilioSid && this.twilioToken && this.twilioFrom && !this.twilioSid.includes('placeholder')) {
      try {
        const url = `https://api.twilio.com/2010-04-01/Accounts/${this.twilioSid}/Messages.json`;
        const auth = 'Basic ' + Buffer.from(`${this.twilioSid}:${this.twilioToken}`).toString('base64');
        const params = new URLSearchParams();
        params.append('To', cleanPhone);
        params.append('From', this.twilioFrom);
        params.append('Body', text);

        const res = await fetch(url, {
          method: 'POST',
          headers: {
            'Authorization': auth,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: params.toString(),
        });

        if (res.ok) {
          const resData: any = await res.json();
          this.logger.log(`Live SMS dispatched to ${cleanPhone} (SID: ${resData.sid})`);
          return {
            success: true,
            channel: 'SMS',
            recipient: cleanPhone,
            messageId: resData.sid,
            simulated: false,
          };
        }
      } catch (err: any) {
        this.logger.warn(`Live SMS failed, falling back to simulated dispatch: ${err.message}`);
      }
    }

    // High-fidelity simulation mode
    const simulatedId = `sms_sim_${Date.now().toString(36)}`;
    this.logger.log(`[SMS Gateway Simulated] -> ${cleanPhone}: "${text}" (Ref: ${simulatedId})`);
    return {
      success: true,
      channel: 'SMS',
      recipient: cleanPhone,
      messageId: simulatedId,
      simulated: true,
    };
  }

  async sendWhatsApp(
    toPhone: string,
    templateName: string,
    parameters: Record<string, string>,
  ): Promise<DispatchResult> {
    const cleanPhone = toPhone.replace(/\s+/g, '');

    // Live WhatsApp Cloud API dispatch if token provided
    if (this.whatsappToken && this.whatsappPhoneId && !this.whatsappToken.includes('placeholder')) {
      try {
        const url = `https://graph.facebook.com/v19.0/${this.whatsappPhoneId}/messages`;
        const res = await fetch(url, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.whatsappToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            messaging_product: 'whatsapp',
            to: cleanPhone,
            type: 'template',
            template: {
              name: templateName,
              language: { code: 'en' },
              components: [
                {
                  type: 'body',
                  parameters: Object.entries(parameters).map(([key, text]) => ({
                    type: 'text',
                    text,
                  })),
                },
              ],
            },
          }),
        });

        if (res.ok) {
          const resData: any = await res.json();
          const wamid = resData.messages?.[0]?.id;
          this.logger.log(`Live WhatsApp template [${templateName}] sent to ${cleanPhone} (${wamid})`);
          return {
            success: true,
            channel: 'WHATSAPP',
            recipient: cleanPhone,
            messageId: wamid,
            simulated: false,
          };
        }
      } catch (err: any) {
        this.logger.warn(`Live WhatsApp dispatch failed: ${err.message}`);
      }
    }

    // High-fidelity simulation mode
    const simulatedId = `wa_sim_${Date.now().toString(36)}`;
    this.logger.log(
      `[WhatsApp Gateway Simulated] -> ${cleanPhone}: Template [${templateName}] with ${JSON.stringify(parameters)} (Ref: ${simulatedId})`,
    );
    return {
      success: true,
      channel: 'WHATSAPP',
      recipient: cleanPhone,
      messageId: simulatedId,
      simulated: true,
    };
  }
}
