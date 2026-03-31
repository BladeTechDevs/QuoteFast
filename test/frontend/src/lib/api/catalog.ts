import { apiClient } from '@/lib/api';
import type { CatalogItem, PaginatedResponse } from '@/lib/types';

export interface ListCatalogItemsParams {
  page?: number;
  limit?: number;
  search?: string;
}

export interface CatalogItemFormData {
  name: string;
  description?: string;
  unitPrice: number;
  taxRate?: number;
  discount?: number;
  internalCost?: number;
}

export async function listCatalogItems(params?: ListCatalogItemsParams) {
  const { data } = await apiClient.get<PaginatedResponse<CatalogItem>>('/catalog', { params });
  return data;
}

export async function createCatalogItem(dto: CatalogItemFormData) {
  const { data } = await apiClient.post<CatalogItem>('/catalog', dto);
  return data;
}

export async function updateCatalogItem(id: string, dto: Partial<CatalogItemFormData>) {
  const { data } = await apiClient.patch<CatalogItem>(`/catalog/${id}`, dto);
  return data;
}

export async function deleteCatalogItem(id: string) {
  await apiClient.delete(`/catalog/${id}`);
}
