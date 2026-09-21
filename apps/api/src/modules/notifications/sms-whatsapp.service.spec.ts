import { SmsWhatsAppService } from './sms-whatsapp.service';

describe('SmsWhatsAppService - Multi-Channel Dispatch (Part 2)', () => {
  let service: SmsWhatsAppService;
  let mockConfig: any;

  beforeEach(() => {
    mockConfig = {
      get: jest.fn((key: string) => {
        return null; // Simulation mode
      }),
    };

    service = new SmsWhatsAppService(mockConfig);
  });

  it('dispatches simulated SMS and returns tracking messageId', async () => {
    const result = await service.sendSMS(
      '+919876543210',
      'Dear parent, your ward was marked absent today.',
    );

    expect(result.success).toBe(true);
    expect(result.channel).toBe('SMS');
    expect(result.recipient).toBe('+919876543210');
    expect(result.simulated).toBe(true);
    expect(result.messageId).toMatch(/^sms_sim_/);
  });

  it('dispatches simulated WhatsApp template and returns tracking messageId', async () => {
    const result = await service.sendWhatsApp('+919876543210', 'fee_reminder', {
      student_name: 'Aarav Sharma',
      amount: '5000',
    });

    expect(result.success).toBe(true);
    expect(result.channel).toBe('WHATSAPP');
    expect(result.recipient).toBe('+919876543210');
    expect(result.simulated).toBe(true);
    expect(result.messageId).toMatch(/^wa_sim_/);
  });
});
