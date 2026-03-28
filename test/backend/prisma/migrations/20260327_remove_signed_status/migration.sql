-- Migrate existing SIGNED quotes to ACCEPTED before removing the enum value
UPDATE "Quote" SET status = 'ACCEPTED' WHERE status = 'SIGNED';

-- Migrate QUOTE_SIGNED tracking events to QUOTE_ACCEPTED
UPDATE "TrackingEvent" SET "eventType" = 'QUOTE_ACCEPTED' WHERE "eventType" = 'QUOTE_SIGNED';

-- Remove SIGNED from QuoteStatus enum
-- Drop the default first so the column can be altered
ALTER TABLE "Quote" ALTER COLUMN status DROP DEFAULT;

ALTER TYPE "QuoteStatus" RENAME TO "QuoteStatus_old";

CREATE TYPE "QuoteStatus" AS ENUM ('DRAFT', 'SENT', 'VIEWED', 'ACCEPTED', 'REJECTED', 'EXPIRED');

ALTER TABLE "Quote" ALTER COLUMN status TYPE "QuoteStatus" USING status::text::"QuoteStatus";

-- Restore the default using the new enum type
ALTER TABLE "Quote" ALTER COLUMN status SET DEFAULT 'DRAFT'::"QuoteStatus";

DROP TYPE "QuoteStatus_old";

-- Remove QUOTE_SIGNED from TrackingEventType enum
ALTER TYPE "TrackingEventType" RENAME TO "TrackingEventType_old";

CREATE TYPE "TrackingEventType" AS ENUM ('QUOTE_OPENED', 'QUOTE_VIEWED', 'QUOTE_ACCEPTED', 'QUOTE_REJECTED', 'QUOTE_PDF_DOWNLOADED', 'QUOTE_EXPIRED');

ALTER TABLE "TrackingEvent" ALTER COLUMN "eventType" TYPE "TrackingEventType" USING "eventType"::text::"TrackingEventType";

DROP TYPE "TrackingEventType_old";
