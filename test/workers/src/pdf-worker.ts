import { SQSEvent, SQSRecord } from 'aws-lambda';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import PDFDocument from 'pdfkit';
import { getPrismaClient } from './lib/prisma';

const s3 = new S3Client({ region: process.env.AWS_REGION ?? 'us-east-1' });
const S3_BUCKET = process.env.S3_BUCKET ?? '';

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

  if (payload.type !== 'SEND_QUOTE' && payload.type !== 'GENERATE_PDF') {
    return;
  }

  const prisma = getPrismaClient();

  const quote = await prisma.quote.findUnique({
    where: { id: payload.quoteId },
    include: {
      items: { orderBy: { order: 'asc' } },
      client: true,
      user: true,
    },
  });

  if (!quote) {
    throw new Error(`Quote not found: ${payload.quoteId}`);
  }

  const pdfBuffer = await generatePdf(quote);

  const key = `quotes/${quote.id}/quote-${quote.publicId}.pdf`;
  await s3.send(
    new PutObjectCommand({
      Bucket: S3_BUCKET,
      Key: key,
      Body: pdfBuffer,
      ContentType: 'application/pdf',
    }),
  );

  const pdfUrl = `https://${S3_BUCKET}.s3.amazonaws.com/${key}`;

  await prisma.quote.update({
    where: { id: quote.id },
    data: { pdfUrl },
  });
}

async function generatePdf(quote: any): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50 });
    const chunks: Buffer[] = [];

    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    // Header: company/issuer info
    doc.fontSize(20).text('QuoteFast', { align: 'left' });
    if (quote.user?.company) {
      doc.fontSize(12).text(quote.user.company);
    }
    doc.moveDown();

    // Quote title and metadata
    doc.fontSize(16).text(quote.title, { align: 'center' });
    doc.fontSize(10)
      .text(`Quote #: ${quote.publicId}`, { align: 'right' })
      .text(`Status: ${quote.status}`, { align: 'right' })
      .text(`Currency: ${quote.currency}`, { align: 'right' });

    if (quote.validUntil) {
      doc.text(`Valid Until: ${new Date(quote.validUntil).toLocaleDateString()}`, { align: 'right' });
    }
    doc.moveDown();

    // Client info
    if (quote.client) {
      doc.fontSize(12).text('Bill To:', { underline: true });
      doc.fontSize(10).text(quote.client.name);
      if (quote.client.company) doc.text(quote.client.company);
      if (quote.client.email) doc.text(quote.client.email);
      if (quote.client.phone) doc.text(quote.client.phone);
      if (quote.client.address) doc.text(quote.client.address);
      doc.moveDown();
    }

    // Items table header
    doc.fontSize(12).text('Items', { underline: true });
    doc.moveDown(0.5);

    const tableTop = doc.y;
    const colName = 50;
    const colQty = 280;
    const colPrice = 340;
    const colTotal = 430;

    doc.fontSize(10)
      .text('Description', colName, tableTop)
      .text('Qty', colQty, tableTop)
      .text('Unit Price', colPrice, tableTop)
      .text('Total', colTotal, tableTop);

    doc.moveTo(50, doc.y + 5).lineTo(550, doc.y + 5).stroke();
    doc.moveDown();

    // Items rows
    for (const item of quote.items) {
      const y = doc.y;
      doc.fontSize(10)
        .text(item.name + (item.description ? `\n${item.description}` : ''), colName, y, { width: 220 })
        .text(String(Number(item.quantity)), colQty, y)
        .text(Number(item.unitPrice).toFixed(2), colPrice, y)
        .text(Number(item.total).toFixed(2), colTotal, y);
      doc.moveDown();
    }

    doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke();
    doc.moveDown();

    // Totals
    const totalsX = 380;
    doc.fontSize(10)
      .text('Subtotal:', totalsX)
      .text(`${quote.currency} ${Number(quote.subtotal).toFixed(2)}`, colTotal, doc.y - doc.currentLineHeight());

    doc.text(`Tax (${Number(quote.taxRate)}%):`, totalsX)
      .text(`${quote.currency} ${Number(quote.taxAmount).toFixed(2)}`, colTotal, doc.y - doc.currentLineHeight());

    if (Number(quote.discount) > 0) {
      doc.text('Discount:', totalsX)
        .text(`-${quote.currency} ${Number(quote.discount).toFixed(2)}`, colTotal, doc.y - doc.currentLineHeight());
    }

    doc.fontSize(12)
      .text('Total:', totalsX)
      .text(`${quote.currency} ${Number(quote.total).toFixed(2)}`, colTotal, doc.y - doc.currentLineHeight());

    doc.moveDown();

    // Notes and terms
    if (quote.notes) {
      doc.fontSize(10).text('Notes:', { underline: true }).text(quote.notes);
      doc.moveDown();
    }

    if (quote.terms) {
      doc.fontSize(10).text('Terms & Conditions:', { underline: true }).text(quote.terms);
    }

    doc.end();
  });
}
