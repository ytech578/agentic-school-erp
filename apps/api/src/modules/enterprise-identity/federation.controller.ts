import {
  Body,
  Controller,
  Get,
  Header,
  Param,
  Post,
  Query,
  Req,
  Res,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { FederationService } from './federation.service';
import { z } from 'zod';

@ApiTags('Enterprise SSO')
@Controller('sso')
export class FederationController {
  constructor(
    private readonly federation: FederationService,
    private readonly config: ConfigService,
  ) {}

  @Get(':schoolCode/providers')
  @ApiOperation({ summary: 'Discover enabled SSO providers for a school' })
  async providers(@Param('schoolCode') schoolCode: string) {
    return { data: await this.federation.listPublicProviders(schoolCode) };
  }

  @Get(':schoolCode/:providerSlug/start')
  @ApiOperation({ summary: 'Start an OIDC or SAML authentication flow' })
  async start(
    @Param('schoolCode') schoolCode: string,
    @Param('providerSlug') providerSlug: string,
    @Query('returnUrl') returnUrl: string | undefined,
    @Res() response: Response,
  ) {
    response.redirect(
      302,
      await this.federation.start(schoolCode, providerSlug, returnUrl),
    );
  }

  @Get('oidc/callback')
  async oidcCallback(@Req() request: Request, @Res() response: Response) {
    const state =
      typeof request.query.state === 'string' ? request.query.state : '';
    const callbackUrl = new URL(
      request.originalUrl,
      this.config.getOrThrow<string>('app.apiUrl'),
    );
    const result = await this.federation.completeOidc(
      callbackUrl,
      state,
      this.ip(request),
      request.headers['user-agent'] || '',
    );
    const redirect = new URL(result.returnUrl);
    redirect.searchParams.set('code', result.code);
    response.redirect(302, redirect.href);
  }

  @Post('saml/:providerId/callback')
  async samlCallback(
    @Param('providerId') providerId: string,
    @Body() body: { SAMLResponse?: string; RelayState?: string },
    @Req() request: Request,
    @Res() response: Response,
  ) {
    const result = await this.federation.completeSaml(
      providerId,
      body.SAMLResponse || '',
      body.RelayState || '',
      this.ip(request),
      request.headers['user-agent'] || '',
    );
    const redirect = new URL(result.returnUrl);
    redirect.searchParams.set('code', result.code);
    response.redirect(302, redirect.href);
  }

  @Post('exchange')
  @ApiOperation({
    summary: 'Consume a one-time SSO code and create a local session',
  })
  async exchange(
    @Body() body: unknown,
    @Res({ passthrough: true }) response: Response,
  ) {
    const dto = z
      .object({
        code: z.string().regex(/^[A-Za-z0-9_-]{43}$/),
        otp: z.string().trim().min(6).max(32).optional(),
      })
      .parse(body);
    const result = await this.federation.exchange(dto.code, dto.otp);
    this.setRefreshCookie(response, result.refreshToken);
    return { data: { user: result.user, accessToken: result.accessToken } };
  }

  @Get(':schoolCode/:providerSlug/saml-metadata')
  @Header('Content-Type', 'application/samlmetadata+xml')
  metadata(
    @Param('schoolCode') schoolCode: string,
    @Param('providerSlug') providerSlug: string,
  ) {
    return this.federation.samlMetadata(schoolCode, providerSlug);
  }

  private ip(request: Request) {
    return String(request.headers['x-forwarded-for'] || request.ip || '')
      .split(',')[0]
      .trim();
  }

  private setRefreshCookie(response: Response, token: string) {
    const isProduction =
      this.config.get<string>('app.nodeEnv') === 'production';
    response.cookie('refresh_token', token, {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? 'none' : 'lax',
      maxAge: this.config.get<number>('jwt.refreshExpiresInMs', 604_800_000),
      path: '/',
    });
  }
}
