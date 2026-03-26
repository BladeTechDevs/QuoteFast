'use client';

import { useState, useEffect } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { useCreateClient, useUpdateClient, type ClientFormData } from '@/lib/hooks/useClients';
import type { Client } from '@/lib/types';

interface ClientModalProps {
  open: boolean;
  onClose: () => void;
  client?: Client | null; // null/undefined = create mode
}

const EMPTY: ClientFormData = {
  name: '',
  email: '',
  company: '',
  phone: '',
  address: '',
  notes: '',
};

export function ClientModal({ open, onClose, client }: ClientModalProps) {
  const isEdit = !!client;
  const [form, setForm] = useState<ClientFormData>(EMPTY);
  const [nameError, setNameError] = useState('');

  const createClient = useCreateClient();
  const updateClient = useUpdateClient(client?.id ?? '');

  // Sync form when client changes
  useEffect(() => {
    if (client) {
      setForm({
        name: client.name,
        email: client.email ?? '',
        company: client.company ?? '',
        phone: client.phone ?? '',
        address: client.address ?? '',
        notes: client.notes ?? '',
      });
    } else {
      setForm(EMPTY);
    }
    setNameError('');
  }, [client, open]);

  function set(field: keyof ClientFormData, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (field === 'name') setNameError('');
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) {
      setNameError('El nombre es obligatorio');
      return;
    }

    const payload: ClientFormData = {
      name: form.name.trim(),
      email: form.email?.trim() || undefined,
      company: form.company?.trim() || undefined,
      phone: form.phone?.trim() || undefined,
      address: form.address?.trim() || undefined,
      notes: form.notes?.trim() || undefined,
    };

    try {
      if (isEdit) {
        await updateClient.mutateAsync(payload);
      } else {
        await createClient.mutateAsync(payload);
      }
      onClose();
    } catch {
      // errors handled by mutation
    }
  }

  const isPending = createClient.isPending || updateClient.isPending;

  return (
    <Modal open={open} onClose={onClose} title={isEdit ? 'Editar cliente' : 'Nuevo cliente'}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Nombre *"
          value={form.name}
          onChange={(e) => set('name', e.target.value)}
          error={nameError}
          placeholder="Nombre del cliente o empresa"
          autoFocus
        />
        <div className="grid grid-cols-2 gap-4">
          <Input
            label="Email"
            type="email"
            value={form.email}
            onChange={(e) => set('email', e.target.value)}
            placeholder="correo@ejemplo.com"
          />
          <Input
            label="Empresa"
            value={form.company}
            onChange={(e) => set('company', e.target.value)}
            placeholder="Nombre de la empresa"
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Input
            label="Teléfono"
            value={form.phone}
            onChange={(e) => set('phone', e.target.value)}
            placeholder="+52 55 1234 5678"
          />
          <Input
            label="Dirección"
            value={form.address}
            onChange={(e) => set('address', e.target.value)}
            placeholder="Ciudad, País"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-gray-700" htmlFor="client-notes">
            Notas
          </label>
          <textarea
            id="client-notes"
            rows={2}
            value={form.notes}
            onChange={(e) => set('notes', e.target.value)}
            placeholder="Notas internas sobre el cliente…"
            className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-200 resize-none"
          />
        </div>
        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="secondary" onClick={onClose} disabled={isPending}>
            Cancelar
          </Button>
          <Button type="submit" loading={isPending}>
            {isEdit ? 'Guardar cambios' : 'Crear cliente'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
