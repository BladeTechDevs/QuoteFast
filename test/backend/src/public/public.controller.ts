import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Ip,
  Param,
  Post,
  Headers,
  UseGuards,
  Req,
} from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { ApiTags, ApiOperation, ApiResponse, ApiBody } from '@nestjs/swagger';
import { Request } from 'express';
import { PublicQuotesService } from './public-quotes.service';
import { SignatureService } from './signature.service';
import { SignQuoteDto } from './dto/sign-quote.dto';

class TrackEventDto {
  publicId: string;
}

@ApiTags('public')
@Controller('public')
@UseGuards(ThrottlerGuard)
export class PublicController {
  constructor(
    private readonly publicQuotesService: PublicQuotesService,
    private readonly signatureService: SignatureService,
  ) {}

  @Get('quotes/:publicId')
  @ApiOperation({ summary: 'Get a public quote by publicId' })
  @Throttle({ short: { limit: 10, ttl: 60000 }, long: { limit: 60, ttl: 60000 } })
  getQuote(
    @Param('publicId') publicId: string,
    @Ip() ip: string,
    @Headers('user-agent') userAgent: string,
  ) {
    return this.publicQuotesService.getQuoteAndTrackOpen(publicId, ip, userAgent);
  }

  @Post('quotes/:publicId/accept')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Accept a quote' })
  @Throttle({ short: { limit: 3, ttl: 60000 }, long: { limit: 10, ttl: 60000 } })
  accept(
    @Param('publicId') publicId: string,
    @Ip() ip: string,
    @Headers('user-agent') userAgent: string,
  ) {
    return this.publicQuotesService.accept(publicId, ip, userAgent);
  }

  @Post('quotes/:publicId/reject')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Reject a quote' })
  @Throttle({ short: { limit: 3, ttl: 60000 }, long: { limit: 10, ttl: 60000 } })
  reject(
    @Param('publicId') publicId: string,
    @Ip() ip: string,
    @Headers('user-agent') userAgent: string,
  ) {
    return this.publicQuotesService.reject(publicId, ip, userAgent);
  }

  @Post('track')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Track a quote event (PDF download, etc.)' })
  @Throttle({ short: { limit: 5, ttl: 1000 }, long: { limit: 100, ttl: 60000 } })
  trackPdfDownload(
    @Body() body: TrackEventDto,
    @Ip() ip: string,
    @Headers('user-agent') userAgent: string,
  ) {
    return this.publicQuotesService.trackPdfDownload(body.publicId, ip, userAgent);
  }

  @Post('quotes/:publicId/sign')
  @ApiOperation({ summary: 'Sign a quote' })
  @ApiResponse({ 
    status: 200, 
    description: 'Quote signed successfully',
    schema: {
      type: 'object',
      properties: {
        id: { type: 'string', format: 'uuid', description: 'Signature ID' },
        quoteStatus: { type: 'string', enum: ['ACCEPTED'], description: 'Updated quote status' },
        signedAt: { type: 'string', format: 'date-time', description: 'Timestamp of signature' },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Invalid signature data' })
  @ApiResponse({ status: 404, description: 'Quote not found' })
  @ApiResponse({ status: 409, description: 'Quote not in signable state' })
  @ApiBody({
    type: SignQuoteDto,
    description: 'Signature data',
    examples: {
      example1: {
        summary: 'Valid signature',
        value: {
          signerName: 'John Doe',
          signatureImage: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
        },
      },
    },
  })
  @Throttle({ short: { limit: 3, ttl: 60000 }, long: { limit: 10, ttl: 60000 } })
  async signQuote(
    @Param('publicId') publicId: string,
    @Body() dto: SignQuoteDto,
    @Req() request: Request,
  ) {
    const ipAddress = request.ip;
    const userAgent = request.headers['user-agent'];

    return this.signatureService.signQuote({
      publicId,
      signerName: dto.signerName,
      signatureImage: dto.signatureImage,
      ipAddress,
      userAgent,
    });
  }
}
