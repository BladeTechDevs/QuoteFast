import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  listCatalogItems,
  createCatalogItem,
  updateCatalogItem,
  deleteCatalogItem,
  type ListCatalogItemsParams,
  type CatalogItemFormData,
} from '@/lib/api/catalog';

export function useListCatalogItems(params?: ListCatalogItemsParams) {
  return useQuery({
    queryKey: ['catalog', params],
    queryFn: () => listCatalogItems(params),
  });
}

export function useCreateCatalogItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (dto: CatalogItemFormData) => createCatalogItem(dto),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['catalog'] }),
  });
}

export function useUpdateCatalogItem(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (dto: Partial<CatalogItemFormData>) => updateCatalogItem(id, dto),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['catalog'] }),
  });
}

export function useDeleteCatalogItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteCatalogItem(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['catalog'] }),
  });
}
