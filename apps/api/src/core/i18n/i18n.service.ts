import { Injectable, Logger } from '@nestjs/common';
import * as enTranslations from './locales/en.json';
import * as hiTranslations from './locales/hi.json';

@Injectable()
export class I18nService {
  private readonly logger = new Logger(I18nService.name);
  private readonly dictionaries: Record<string, any> = {
    en: enTranslations,
    hi: hiTranslations,
  };

  getSupportedLocales(): string[] {
    return Object.keys(this.dictionaries);
  }

  getBundle(locale = 'en'): Record<string, any> {
    const target = this.dictionaries[locale] || this.dictionaries.en;
    return target;
  }

  translate(key: string, locale = 'en', params?: Record<string, any>): string {
    const keys = key.split('.');
    const dict = this.dictionaries[locale] || this.dictionaries.en;

    let value: any = dict;
    for (const k of keys) {
      if (value && typeof value === 'object' && k in value) {
        value = value[k];
      } else {
        value = undefined;
        break;
      }
    }

    // Fallback to English if key missing in requested locale
    if (value === undefined && locale !== 'en') {
      let fallbackValue: any = this.dictionaries.en;
      for (const k of keys) {
        if (
          fallbackValue &&
          typeof fallbackValue === 'object' &&
          k in fallbackValue
        ) {
          fallbackValue = fallbackValue[k];
        } else {
          fallbackValue = undefined;
          break;
        }
      }
      value = fallbackValue;
    }

    if (typeof value !== 'string') {
      return key; // return key as fallback
    }

    // Parameter interpolation: {param}
    if (params) {
      for (const [pKey, pVal] of Object.entries(params)) {
        value = value.replace(new RegExp(`{${pKey}}`, 'g'), String(pVal));
      }
    }

    return value;
  }
}
