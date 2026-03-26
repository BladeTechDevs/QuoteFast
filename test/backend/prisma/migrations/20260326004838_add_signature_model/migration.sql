-- AlterEnum
ALTER TYPE "QuoteStatus" ADD VALUE 'SIGNED';

-- AlterEnum
ALTER TYPE "TrackingEventType" ADD VALUE 'QUOTE_SIGNED';

-- AlterTable
ALTER TABLE "Quote" ADD COLUMN     "signedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "Signature" (
    "id" TEXT NOT NULL,
    "quoteId" TEXT NOT NULL,
    "signerName" VARCHAR(255) NOT NULL,
    "signatureImage" TEXT NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "signedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Signature_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Signature_quoteId_key" ON "Signature"("quoteId");

-- CreateIndex
CREATE INDEX "Signature_quoteId_idx" ON "Signature"("quoteId");

-- AddForeignKey
ALTER TABLE "Signature" ADD CONSTRAINT "Signature_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "Quote"("id") ON DELETE CASCADE ON UPDATE CASCADE;
