-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM (
  'QUOTE_CREATED',
  'QUOTE_SENT',
  'QUOTE_VIEWED_BY_CLIENT',
  'QUOTE_ACCEPTED_BY_CLIENT',
  'QUOTE_REJECTED_BY_CLIENT',
  'QUOTE_SIGNED_BY_CLIENT',
  'QUOTE_EXPIRED',
  'QUOTE_PDF_READY',
  'QUOTE_REMINDER_SENT',
  'PLAN_LIMIT_WARNING',
  'PLAN_LIMIT_REACHED',
  'PLAN_UPGRADED'
);

-- CreateTable
CREATE TABLE "Notification" (
    "id"        TEXT NOT NULL,
    "userId"    TEXT NOT NULL,
    "type"      "NotificationType" NOT NULL,
    "title"     TEXT NOT NULL,
    "message"   TEXT NOT NULL,
    "quoteId"   TEXT,
    "metadata"  JSONB,
    "read"      BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Notification_userId_idx" ON "Notification"("userId");
CREATE INDEX "Notification_userId_read_idx" ON "Notification"("userId", "read");
CREATE INDEX "Notification_createdAt_idx" ON "Notification"("createdAt");

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
