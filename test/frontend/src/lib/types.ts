export type QuoteStatus =
  | 'DRAFT'
  | 'SENT'
  | 'VIEWED'
  | 'ACCEPTED'
  | 'REJECTED'
  | 'EXPIRED'
  | 'SIGNED';

export interface Client {
  id: string;
  name: string;
  company?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  notes?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface DashboardMetrics {
  statusCounts: Record<QuoteStatus, number>;
  pipelineValue: number;
  conversionRate: number;
  recentQuotes: RecentQuote[];
}

export interface RecentQuote {
  id: string;
  publicId: string;
  title: string;
  status: QuoteStatus;
  total: number;
  currency: string;
  updatedAt: string;
  client: Client | null;
}

export interface Quote {
  id: string;
  publicId: string;
  title: string;
  status: QuoteStatus;
  currency: string;
  subtotal: number;
  taxRate: number;
  taxAmount: number;
  discount: number;
  total: number;
  notes?: string | null;
  terms?: string | null;
  validUntil?: string | null;
  sentAt?: string | null;
  viewedAt?: string | null;
  acceptedAt?: string | null;
  rejectedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  client: Client | null;
}

export interface QuoteItem {
  id: string;
  quoteId: string;
  name: string;
  description?: string | null;
  quantity: number;
  unitPrice: number;
  total: number;
  order: number;
}

export interface QuoteDetail extends Quote {
  items: QuoteItem[];
}

export interface Template {
  id: string;
  name: string;
  content: {
    currency?: string;
    taxRate?: number;
    discount?: number;
    notes?: string;
    terms?: string;
  };
  isDefault: boolean;
  userId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}

export interface PublicQuoteItem {
  id: string;
  name: string;
  description: string | null;
  quantity: number;
  unitPrice: number;
  total: number;
  order: number;
}

export interface PublicQuote {
  publicId: string;
  title: string;
  status: QuoteStatus;
  currency: string;
  items: PublicQuoteItem[];
  subtotal: number;
  taxRate: number;
  taxAmount: number;
  discount: number;
  total: number;
  notes: string | null;
  terms: string | null;
  validUntil: string | null;
  pdfUrl: string | null;
  issuer: { name: string; company: string | null };
  client: { name: string; company: string | null } | null;
}
