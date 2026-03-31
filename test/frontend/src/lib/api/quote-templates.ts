import { apiClient } from '@/lib/api';
import type { QuoteTemplate, TemplateItem } from '@/lib/types';

export interface TemplateItemFormData {
  name: string;
  description?: string;
  quantity?: number;
  unitPrice: number;
  discount?: number;
  taxRate?: number;
  internalCost?: number;
  order: number;
}

export interface QuoteTemplateFormData {
  name: string;
  currency?: string;
  taxRate?: number;
  discount?: number;
  notes?: string;
  terms?: string;
  items?: TemplateItemFormData[];
}

export async function listQuoteTemplates(): Promise<QuoteTemplate[]> {
  const { data } = await apiClient.get<QuoteTemplate[]>('/quote-templates');
  return data;
}

export async function getQuoteTemplate(id: string): Promise<QuoteTemplate> {
  const { data } = await apiClient.get<QuoteTemplate>(`/quote-templates/${id}`);
  return data;
}

export async function createQuoteTemplate(dto: QuoteTemplateFormData): Promise<QuoteTemplate> {
  const { data } = await apiClient.post<QuoteTemplate>('/quote-templates', dto);
  return data;
}

export async function updateQuoteTemplate(id: string, dto: Partial<QuoteTemplateFormData>): Promise<QuoteTemplate> {
  const { data } = await apiClient.patch<QuoteTemplate>(`/quote-templates/${id}`, dto);
  return data;
}

export async function deleteQuoteTemplate(id: string): Promise<void> {
  await apiClient.delete(`/quote-templates/${id}`);
}

export async function saveQuoteAsTemplate(quoteId: string, name: string): Promise<QuoteTemplate> {
  const { data } = await apiClient.post<QuoteTemplate>(`/quotes/${quoteId}/save-as-template`, { name });
  return data;
}
