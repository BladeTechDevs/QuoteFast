'use client';

import { useState } from 'react';
import { useClients, useDeleteClient } from '@/lib/hooks/useClients';
import { ClientModal } from '@/components/clients/ClientModal';
import { Button } from '@/components/ui/Button';
import type { Client } from '@/lib/types';

function formatDate(dateStr?: string) {
  if (!dateStr) return '—';
  return new Intl.DateTimeFormat('es-MX', { dateStyle: 'medium' }).format(new Date(dateStr));
}

export default function ClientsPage() {
  const { data, isLoading, isError } = useClients();
  const deleteClient = useDeleteClient();

  const [modalOpen, setModalOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const clients = data?.data ?? [];

  function openCreate() {
    setEditingClient(null);
    setModalOpen(true);
  }

  function openEdit(client: Client) {
    setEditingClient(client);
    setModalOpen(true);
  }

  async function handleDelete(client: Client) {
    if (!confirm(`¿Eliminar al cliente "${client.name}"? Esta acción no se puede deshacer.`)) return;
    setDeletingId(client.id);
    try {
      await deleteClient.mutateAsync(client.id);
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Clientes</h1>
          <p className="mt-1 text-sm text-gray-500">
            {data ? `${data.total} cliente${data.total !== 1 ? 's' : ''}` : ''}
          </p>
        </div>
        <Button onClick={openCreate}>+ Nuevo cliente</Button>
      </div>

      {/* Content */}
      <div className="rounded-lg border border-gray-200 bg-white shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="flex h-48 items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
          </div>
        ) : isError ? (
          <div className="p-6 text-center text-sm text-red-600">
            Error al cargar los clientes. Intenta de nuevo.
          </div>
        ) : clients.length === 0 ? (
          <div className="p-10 text-center">
            <p className="text-sm text-gray-400">No tienes clientes aún.</p>
            <button
              onClick={openCreate}
              className="mt-2 text-sm text-blue-600 hover:underline"
            >
              Crear tu primer cliente
            </button>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b border-gray-200 bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Nombre</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Empresa</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Email</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Teléfono</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Creado</th>
                <th className="px-4 py-3 text-right font-medium text-gray-600">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {clients.map((client) => (
                <tr key={client.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 font-medium text-gray-900">{client.name}</td>
                  <td className="px-4 py-3 text-gray-500">{client.company ?? '—'}</td>
                  <td className="px-4 py-3 text-gray-500">{client.email ?? '—'}</td>
                  <td className="px-4 py-3 text-gray-500">{client.phone ?? '—'}</td>
                  <td className="px-4 py-3 text-gray-500">{formatDate(client.createdAt)}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openEdit(client)}
                      >
                        Editar
                      </Button>
                      <Button
                        variant="danger"
                        size="sm"
                        loading={deletingId === client.id}
                        onClick={() => handleDelete(client)}
                      >
                        Eliminar
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <ClientModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        client={editingClient}
      />
    </div>
  );
}
