import { I18nService } from './i18n.service';

describe('I18nService', () => {
  let service: I18nService;

  beforeEach(() => {
    service = new I18nService();
  });

  it('should return supported locales en and hi', () => {
    const locales = service.getSupportedLocales();
    expect(locales).toContain('en');
    expect(locales).toContain('hi');
  });

  it('should translate english keys correctly', () => {
    expect(service.translate('common.dashboard', 'en')).toBe('Dashboard');
    expect(service.translate('admissions.applyNow', 'en')).toBe(
      'Apply for Admission',
    );
    expect(service.translate('fees.paid', 'en')).toBe('Paid');
  });

  it('should translate hindi keys correctly', () => {
    expect(service.translate('common.dashboard', 'hi')).toBe('डैशबोर्ड');
    expect(service.translate('admissions.applyNow', 'hi')).toBe(
      'प्रवेश हेतु आवेदन करें',
    );
    expect(service.translate('fees.paid', 'hi')).toBe('भुगतान किया गया');
  });

  it('should fallback to english if key is missing in hindi', () => {
    expect(service.translate('nonexistent.key', 'hi')).toBe('nonexistent.key');
  });

  it('should return full bundles for en and hi', () => {
    const enBundle = service.getBundle('en');
    const hiBundle = service.getBundle('hi');
    expect(enBundle.common.save).toBe('Save');
    expect(hiBundle.common.save).toBe('सहेजें');
  });
});
