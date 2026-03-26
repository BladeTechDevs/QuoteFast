import { Injectable, Logger } from '@nestjs/common';
import {
  SQSClient,
  SendMessageCommand,
} from '@aws-sdk/client-sqs';

export interface QuoteJobPayload {
  quoteId: string;
  type: 'GENERATE_PDF' | 'SEND_EMAIL' | 'SEND_QUOTE';
  retryCount: number;
}

@Injectable()
export class SqsService {
  private readonly logger = new Logger(SqsService.name);
  private readonly client: SQSClient;
  private readonly queueUrl: string;

  constructor() {
    this.client = new SQSClient({
      region: process.env.AWS_REGION ?? 'us-east-1',
    });
    this.queueUrl = process.env.SQS_QUEUE_URL ?? '';
  }

  async enqueue(payload: QuoteJobPayload): Promise<void> {
    const command = new SendMessageCommand({
      QueueUrl: this.queueUrl,
      MessageBody: JSON.stringify(payload),
    });

    try {
      await this.client.send(command);
      this.logger.log(`Enqueued job: ${payload.type} for quote ${payload.quoteId}`);
    } catch (error) {
      this.logger.error(`Failed to enqueue job for quote ${payload.quoteId}`, error);
      throw error;
    }
  }
}
