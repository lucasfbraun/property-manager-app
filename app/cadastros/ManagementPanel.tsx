"use client";

/**
 * Painel generico de listagem + edicao inline usado pelas entidades do
 * cadastro (inquilinos, imoveis, proprietarios, recebedores).
 */
export function ManagementPanel<T extends { id: string }>({
  editingId,
  emptyText,
  isSaving,
  items,
  onDelete,
  onEdit,
  renderEditForm,
  renderExtra,
  renderSubtitle,
  renderTitle,
  title,
}: {
  editingId: string | null;
  emptyText: string;
  isSaving: boolean;
  items: T[];
  onDelete: (item: T) => void;
  onEdit: (item: T) => void;
  renderEditForm: (item: T) => React.ReactNode;
  renderExtra?: (item: T) => React.ReactNode;
  renderSubtitle: (item: T) => string;
  renderTitle: (item: T) => string;
  title: string;
}) {
  return (
    <div className="surface-card p-4">
      <h2 className="font-semibold">{title}</h2>
      <div className="mt-3 space-y-2">
        {items.length > 0 ? (
          items.map((item) => (
            <div
              className="rounded-md border border-slate-200 bg-[#F8FAFC] px-3 py-3 dark:border-white/10 dark:bg-white/5"
              key={item.id}
            >
              {editingId === item.id ? (
                renderEditForm(item)
              ) : (
                <div className="flex min-h-14 items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">
                      {renderTitle(item)}
                    </p>
                    <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-500 dark:text-slate-400">
                      {renderSubtitle(item)}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <button
                      className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-white/10 dark:text-slate-200 dark:hover:bg-white/10"
                      disabled={isSaving}
                      onClick={() => onEdit(item)}
                      type="button"
                    >
                      Editar
                    </button>
                    <button
                      className="rounded-md border border-rose-200 px-3 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-rose-500/30 dark:text-rose-300 dark:hover:bg-rose-500/10"
                      disabled={isSaving}
                      onClick={() => onDelete(item)}
                      type="button"
                    >
                      Excluir
                    </button>
                  </div>
                </div>
              )}
              {editingId !== item.id && renderExtra ? renderExtra(item) : null}
            </div>
          ))
        ) : (
          <p className="rounded-md border border-dashed border-slate-200 bg-[#F8FAFC] px-3 py-4 text-sm text-slate-500 dark:border-white/10 dark:bg-white/5 dark:text-slate-400">
            {emptyText}
          </p>
        )}
      </div>
    </div>
  );
}
