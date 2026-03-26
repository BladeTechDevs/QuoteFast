import { SQSEvent, SQSRecord } from 'aws-lambda';
import {
  SESClient,
  SendEmailCommand,
} from '@aws-sdk/client-ses';
import { QuoteStatus } from '@prisma/client';
import { getPrismaClient } from './lib/prisma';

const ses = new SESClient({ region: process.env.AWS_REGION ?? 'us-east-1' });
const SES_FROM_EMAIL = process.env.SES_FROM_EMAIL ?? 'noreply@quotefast.io';
const APP_BASE_URL = process.env.APP_BASE_URL ?? 'https://app.quotefast.io';

const MAX_RETRIES = 3;
const RETRY_DELAYS_MS = [0, 30_000, 300_000]; // 0s, 30s, 5min

interface QuoteJobPayload {
  quoteId: string;
  type: string;
  retryCount: number;
}

export async function handler(event: SQSEvent): Promise<void> {
  for (const record of event.Records) {
    await processRecord(record);
  }
}

async function processRecord(record: SQSRecord): Promise<void> {
  const payload: QuoteJobPayload = JSON.parse(record.body);

  if (payload.type !== 'SEND_QUOTE' && payload.type !== 'SEND_EMAIL') {
    return;
  }

  await sendWithRetry(payload.quoteId, payload.retryCount ?? 0);
}

async function sendWithRetry(quoteId: string, attempt: number): Promise<void> {
  if (attempt >= MAX_RETRIES) {
    throw new Error(`Max retries (${MAX_RETRIES}) exceeded for quote ${quoteId}. Moving to DLQ.`);
  }

  if (attempt > 0 && RETRY_DELAYS_MS[attempt]) {
    await sleep(RETRY_DELAYS_MS[attempt]);
  }

  try {
    await sendEmail(quoteId);
  } catch (error) {
    const nextAttempt = attempt + 1;
    if (nextAttempt < MAX_RETRIES) {
      console.error(`Attempt ${attempt + 1} failed for quote ${quoteId}, retrying...`, error);
      await sendWithRetry(quoteId, nextAttempt);
    } else {
      throw error;
    }
  }
}

async function sendEmail(quoteId: string): Promise<void> {
  const prisma = getPrismaClient();

  const quote = await prisma.quote.findUnique({
    where: { id: quoteId },
    include: { client: true, user: true },
  });

  if (!quote) {
    throw new Error(`Quote not found: ${quoteId}`);
  }

  if (!quote.client?.email) {
    throw new Error(`Quote ${quoteId} has no client email address`);
  }

  const publicLink = `${APP_BASE_URL}/q/${quote.publicId}`;
  const issuerName = quote.user?.company ?? quote.user?.name ?? 'QuoteFast';

  await ses.send(
    new SendEmailCommand({
      Source: SES_FROM_EMAIL,
      Destination: {
        ToAddresses: [quote.client.email],
      },
      Message: {
        Subject: {
          Data: `Quote: ${quote.title} from ${issuerName}`,
          Charset: 'UTF-8',
        },
        Body: {
          Html: {
            Data: buildEmailHtml(quote, publicLink, issuerName),
            Charset: 'UTF-8',
          },
          Text: {
            Data: buildEmailText(quote, publicLink, issuerName),
            Charset: 'UTF-8',
          },
        },
      },
    }),
  );

  await prisma.quote.update({
    where: { id: quoteId },
    data: {
      status: QuoteStatus.SENT,
      sentAt: new Date(),
    },
  });
}

function buildEmailHtml(quote: any, publicLink: string, issuerName: string): string {
  return `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"></head>
<body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
  <h2>Quote from ${issuerName}</h2>
  <p>Dear ${quote.client?.name ?? 'Valued Customer'},</p>
  <p>Please find your quote <strong>${quote.title}</strong> at the link below:</p>
  <p>
    <a href="${publicLink}" style="background:#4F46E5;color:#fff;padding:12px 24px;text-decoration:none;border-radius:4px;display:inline-block;">
      View Quote
    </a>
  </p>
  <p>Or copy this link: <a href="${publicLink}">${publicLink}</a></p>
  ${quote.validUntil ? `<p><em>This quote is valid until ${new Date(quote.validUntil).toLocaleDateString()}.</em></p>` : ''}
  <p>Total: <strong>${quote.currency} ${Number(quote.total).toFixed(2)}</strong></p>
  <hr>
  <p style="font-size:12px;color:#666;">Powered by QuoteFast</p>
</body>
</html>`;
}

function buildEmailText(quote: any, publicLink: string, issuerName: string): string {
  return [
    `Quote from ${issuerName}`,
    '',
    `Dear ${quote.client?.name ?? 'Valued Customer'},`,
    '',
    `Please review your quote "${quote.title}":`,
    publicLink,
    '',
    `Total: ${quote.currency} ${Number(quote.total).toFixed(2)}`,
    quote.validUntil ? `Valid until: ${new Date(quote.validUntil).toLocaleDateString()}` : '',
    '',
    'Powered by QuoteFast',
  ].join('\n');
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
