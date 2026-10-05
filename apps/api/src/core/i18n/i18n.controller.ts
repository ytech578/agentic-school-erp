import { Controller, Get, Param, Query } from '@nestjs/common';
import { I18nService } from './i18n.service';
import { ApiTags, ApiOperation, ApiQuery } from '@nestjs/swagger';

@ApiTags('i18n')
@Controller('i18n')
export class I18nController {
  constructor(private readonly i18nService: I18nService) {}

  @Get('locales')
  @ApiOperation({ summary: 'Get list of supported i18n locales' })
  getSupportedLocales() {
    return {
      locales: this.i18nService.getSupportedLocales(),
      default: 'en',
    };
  }

  /**
   * Primary translation bundle endpoint.
   * GET /i18n/:locale  (e.g. /i18n/en, /i18n/hi)
   */
  @Get(':locale')
  @ApiOperation({
    summary: 'Get translation bundle for a given locale (e.g. en, hi)',
  })
  getBundle(@Param('locale') locale: string) {
    return this.i18nService.getBundle(locale);
  }
}
