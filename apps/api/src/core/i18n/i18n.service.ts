import { Injectable, Logger } from '@nestjs/common';
import * as enTranslations from './locales/en.json';
import * as hiTranslations from './locales/hi.json';

export type TranslationDict = Record<string, Record<string, string>>;

@Injectable()
export class I18nService {
  private readonly logger = new Logger(I18nService.name);
  private readonly dictionaries: Record<string, TranslationDict> = {
    en: enTranslations as unknown as TranslationDict,
    hi: hiTranslations as unknown as TranslationDict,
  };

  getSupportedLocales(): string[] {
    return Object.keys(this.dictionaries);
  }

  getBundle(locale = 'en'): TranslationDict {
    const target = this.dictionaries[locale] || this.dictionaries.en;
    return target;
  }

  translate(
    key: string,
    locale = 'en',
    params?: Record<string, string | number>,
  ): string {
    const keys = key.split('.');
    const dict = this.dictionaries[locale] || this.dictionaries.en;

    let value: unknown = dict;
    for (const k of keys) {
      if (value && typeof value === 'object' && k in value) {
        value = (value as Record<string, unknown>)[k];
      } else {
        value = undefined;
        break;
      }
    }

    // Fallback to English if key missing in requested locale
    if (value === undefined && locale !== 'en') {
      let fallbackValue: unknown = this.dictionaries.en;
      for (const k of keys) {
        if (
          fallbackValue &&
          typeof fallbackValue === 'object' &&
          k in fallbackValue
        ) {
          fallbackValue = (fallbackValue as Record<string, unknown>)[k];
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

    let result = value;
    // Parameter interpolation: {param}
    if (params) {
      for (const [pKey, pVal] of Object.entries(params)) {
        result = result.replace(new RegExp(`{${pKey}}`, 'g'), String(pVal));
      }
    }

    return result;
  }
}
