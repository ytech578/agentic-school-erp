import {
  Controller,
  Post,
  Headers,
  Body,
  Req,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { FeesService } from './fees.service';

@ApiTags('Fees')
@Controller('fees/webhook')
export class FeesWebhookController {
  constructor(private readonly feesService: FeesService) {}

  @Post('razorpay')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Handle incoming Razorpay payment captured webhooks',
  })
  @ApiResponse({ status: 200, description: 'Webhook processed successfully' })
  async handleRazorpayWebhook(
    @Headers('x-razorpay-signature') signature: string,
    @Body() payload: any,
    @Req() req: any,
  ) {
    const rawPayload = req.rawBody ?? JSON.stringify(payload);
    return this.feesService.handleRazorpayWebhook(
      signature,
      rawPayload,
      payload,
    );
  }
}
