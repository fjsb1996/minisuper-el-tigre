'use client';

import React, { useState } from 'react';
import {
  Edit3,
  FolderPlus,
  FolderTree,
  Layers,
  Package,
  Plus,
  Trash2,
  X,
} from 'lucide-react';
import { useTiendaStore } from '@/lib/store/useTiendaStore';
import { Category } from '@/types/database';
import { categoryFormSchema } from '@/lib/validations/schemas';
import { toast } from 'sonner';

const COLOR_OPTIONS = [
  '#2563eb', // Azul (Bebidas)
  '#db2777', // Rosa (Golosinas)
  '#ea580c', // Naranja (Abarrotes)
  '#7c3aed', // Morado (Papelería)
  '#16a34a', // Verde (Verduras)
  '#dc2626', // Rojo (Carnes)
  '#e11d48', // Carmesí (Salchichonería)
  '#0891b2', // Cian (Limpieza)
  '#64748b', // Gris (Otros)
];

export default function CategoriasPage() {
  const { categories, products, saveCategory, deleteCategory, currentUser } = useTiendaStore();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCat, setEditingCat] = useState<Category | null>(null);
  const [name, setName] = useState('');
  const [parentId, setParentId] = useState<string>('');
  const [description, setDescription] = useState('');
  const [color, setColor] = useState('#ea580c');
  const [formError, setFormError] = useState<string | null>(null);

  const canEdit = currentUser.role === 'admin' || currentUser.role === 'encargado';

  const mainCategories = categories.filter((c) => !c.parent_id);
  const getSubcategories = (parentIdVal: string) =>
    categories.filter((c) => c.parent_id === parentIdVal);

  const getProductCount = (catId: string, isParent: boolean) => {
    if (isParent) {
      return products.filter((p) => p.category_id === catId).length;
    }
    return products.filter((p) => p.subcategory_id === catId).length;
  };

  const openCreateModal = (defaultParentId = '') => {
    setEditingCat(null);
    setName('');
    setParentId(defaultParentId);
    setDescription('');
    setColor('#ea580c');
    setFormError(null);
    setIsModalOpen(true);
  };

  const openEditModal = (cat: Category) => {
    setEditingCat(cat);
    setName(cat.name);
    setParentId(cat.parent_id || '');
    setDescription(cat.description || '');
    setColor(cat.color || '#ea580c');
    setFormError(null);
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const parsed = categoryFormSchema.safeParse({
      name,
      parent_id: parentId || null,
      description,
      color,
    });

    if (!parsed.success) {
      setFormError(parsed.error.issues[0]?.message || 'Datos inválidos');
      return;
    }

    await saveCategory({
      id: editingCat?.id,
      name: parsed.data.name,
      parent_id: parsed.data.parent_id,
      description: parsed.data.description,
      color: parsed.data.color,
    });

    toast.success(
      editingCat
        ? `Categoría "${parsed.data.name}" actualizada`
        : `Categoría "${parsed.data.name}" creada`
    );
    setIsModalOpen(false);
  };

  return (
    <div className="space-y-6">
      {/* Encabezado Minimalista */}
      <div className="flex flex-col gap-3 rounded-xl border border-[#e0e4e8] bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-lg font-bold text-[#0066cc]">
            Categorías y Subcategorías
          </h1>
          <p className="text-xs text-[#666]">
            Organiza tus departamentos (Bebidas, Golosinas, Abarrotes, Verduras, Carnes, Salchichonería, etc.)
          </p>
        </div>

        {canEdit && (
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => openCreateModal('')}
              className="flex h-9 items-center gap-1.5 rounded-md bg-[#0066cc] px-4 text-xs font-bold text-white shadow-sm hover:bg-[#0055b3]"
            >
              <FolderPlus className="h-4 w-4" />
              Nueva Categoría Principal
            </button>
          </div>
        )}
      </div>

      {/* Tarjetas de Categorías y sus Subcategorías */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {mainCategories.map((cat) => {
          const subs = getSubcategories(cat.id);
          const count = getProductCount(cat.id, true);

          return (
            <div
              key={cat.id}
              className="flex flex-col justify-between rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
            >
              <div>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <div
                      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-white shadow-sm"
                      style={{ backgroundColor: cat.color || '#ea580c' }}
                    >
                      <FolderTree className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="text-base font-extrabold text-zinc-900 dark:text-white">
                        {cat.name}
                      </h3>
                      <p className="text-xs text-zinc-500">
                        {count} {count === 1 ? 'producto registrado' : 'productos registrados'}
                      </p>
                    </div>
                  </div>

                  {canEdit && (
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => openEditModal(cat)}
                        className="rounded-lg p-2 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-800 dark:hover:bg-zinc-800 dark:hover:text-white"
                        title="Editar categoría"
                      >
                        <Edit3 className="h-4 w-4" />
                      </button>
                      {count === 0 && (
                        <button
                          type="button"
                          onClick={async () => {
                            await deleteCategory(cat.id);
                            toast.success(`Categoría "${cat.name}" eliminada`);
                          }}
                          className="rounded-lg p-2 text-zinc-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/50"
                          title="Eliminar categoría"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {cat.description && (
                  <p className="mt-2.5 text-xs text-zinc-600 dark:text-zinc-400">
                    {cat.description}
                  </p>
                )}

                {/* Subcategorías */}
                <div className="mt-4 border-t border-zinc-100 pt-3 dark:border-zinc-800">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-zinc-400">
                      <Layers className="h-3.5 w-3.5" />
                      Subcategorías ({subs.length})
                    </span>
                    {canEdit && (
                      <button
                        type="button"
                        onClick={() => openCreateModal(cat.id)}
                        className="flex items-center gap-1 rounded-lg bg-zinc-100 px-2 py-1 text-[11px] font-bold text-zinc-700 hover:bg-orange-100 hover:text-orange-700 dark:bg-zinc-800 dark:text-zinc-300"
                      >
                        <Plus className="h-3 w-3" />
                        Agregar Subcategoría
                      </button>
                    )}
                  </div>

                  {subs.length === 0 ? (
                    <p className="text-xs italic text-zinc-400">
                      Sin subcategorías específicas (productos directos en {cat.name})
                    </p>
                  ) : (
                    <div className="flex flex-wrap gap-1.5">
                      {subs.map((sub) => {
                        const subCount = getProductCount(sub.id, false);
                        return (
                          <div
                            key={sub.id}
                            className="group flex items-center gap-1.5 rounded-xl border border-zinc-200 bg-zinc-50 px-2.5 py-1.5 text-xs font-medium dark:border-zinc-800 dark:bg-zinc-950"
                          >
                            <span>{sub.name}</span>
                            <span className="rounded-md bg-zinc-200/80 px-1.5 py-0.2 text-[10px] font-bold text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
                              {subCount}
                            </span>
                            {canEdit && (
                              <button
                                type="button"
                                onClick={() => openEditModal(sub)}
                                className="ml-0.5 text-zinc-400 hover:text-orange-600"
                                title="Editar subcategoría"
                              >
                                <Edit3 className="h-3 w-3" />
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Modal de Alta / Edición */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-5 shadow-2xl dark:border-zinc-800 dark:bg-zinc-950">
            <div className="mb-4 flex items-center justify-between border-b border-zinc-200 pb-3 dark:border-zinc-800">
              <h3 className="text-lg font-extrabold">
                {editingCat ? 'Editar Categoría' : 'Nueva Categoría o Subcategoría'}
              </h3>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="rounded-xl p-1.5 text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {formError && (
              <div className="mb-4 rounded-xl bg-red-500/10 p-3 text-xs font-semibold text-red-600 dark:text-red-400">
                {formError}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="mb-1 block text-xs font-bold">
                  Nombre de la Categoría / Subcategoría *
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ej. Lácteos, Botanas, Helados..."
                  className="h-11 w-full rounded-xl border border-zinc-300 bg-transparent px-3 text-sm focus:border-orange-500 focus:outline-none dark:border-zinc-700"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-bold">
                  Categoría Padre (Opcional - déjalo vacío si es principal)
                </label>
                <select
                  value={parentId}
                  onChange={(e) => setParentId(e.target.value)}
                  className="h-11 w-full rounded-xl border border-zinc-300 bg-white px-3 text-sm focus:border-orange-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900"
                >
                  <option value="">— Es una Categoría Principal —</option>
                  {mainCategories
                    .filter((c) => c.id !== editingCat?.id)
                    .map((c) => (
                      <option key={c.id} value={c.id}>
                        Subcategoría de: {c.name}
                      </option>
                    ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-xs font-bold">Descripción</label>
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Descripción breve opcional..."
                  className="h-11 w-full rounded-xl border border-zinc-300 bg-transparent px-3 text-sm focus:border-orange-500 focus:outline-none dark:border-zinc-700"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-bold">Color Identificador</label>
                <div className="flex flex-wrap gap-2">
                  {COLOR_OPTIONS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setColor(c)}
                      className={`h-8 w-8 rounded-full transition-transform ${
                        color === c ? 'scale-110 ring-2 ring-zinc-900 ring-offset-2 dark:ring-white' : ''
                      }`}
                      style={{ backgroundColor: c }}
                      aria-label={`Color ${c}`}
                    />
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="h-11 rounded-xl border border-zinc-300 px-4 text-xs font-bold hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="h-11 rounded-xl bg-orange-600 px-5 text-xs font-bold text-white hover:bg-orange-500"
                >
                  Guardar Categoría
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
