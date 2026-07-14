"use client";

/** Primitivas de formulario/UI do workspace de cadastros. */

export function FormPanel({
  action,
  children,
  description,
  title,
}: {
  action: (formData: FormData) => void;
  children: React.ReactNode;
  description: string;
  title: string;
}) {
  return (
    <form action={action} className="surface-card p-4">
      <h2 className="font-semibold">{title}</h2>
      <p className="mt-1 text-sm leading-6 text-slate-500 dark:text-slate-400">
        {description}
      </p>
      <div className="mt-4 space-y-3">{children}</div>
      <button className="btn-primary mt-4" type="submit">
        Adicionar
      </button>
    </form>
  );
}

export function EditForm({
  action,
  children,
  layout = "stack",
  onCancel,
}: {
  action: (formData: FormData) => void;
  children: React.ReactNode;
  layout?: "stack" | "grid";
  onCancel: () => void;
}) {
  return (
    <form action={action} className="space-y-3">
      <div
        className={
          layout === "grid"
            ? "grid gap-3 sm:grid-cols-3"
            : "space-y-3"
        }
      >
        {children}
      </div>
      <div className="flex gap-2">
        <button className="btn-primary" type="submit">
          Salvar
        </button>
        <button className="btn-secondary" onClick={onCancel} type="button">
          Cancelar
        </button>
      </div>
    </form>
  );
}

export function Field({
  defaultValue,
  label,
  name,
  required = true,
  type = "text",
}: {
  defaultValue?: string;
  label: string;
  name: string;
  required?: boolean;
  type?: string;
}) {
  return (
    <label className="block text-sm">
      <span className="font-medium text-slate-700 dark:text-slate-300">
        {label}
      </span>
      <input
        className="input-field"
        defaultValue={defaultValue}
        name={name}
        required={required}
        type={type}
      />
    </label>
  );
}

export function Select({
  defaultValue,
  label,
  name,
  options,
}: {
  defaultValue?: string;
  label: string;
  name: string;
  options: Array<string | { label: string; value: string }>;
}) {
  return (
    <label className="block text-sm">
      <span className="font-medium text-slate-700 dark:text-slate-300">
        {label}
      </span>
      <select className="input-field" defaultValue={defaultValue ?? ""} name={name} required>
        <option value="">Selecione</option>
        {options.map((option) => {
          const normalized =
            typeof option === "string" ? { label: option, value: option } : option;
          return (
            <option key={normalized.value} value={normalized.value}>
              {normalized.label}
            </option>
          );
        })}
      </select>
    </label>
  );
}

export function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="surface-card p-4">
      <p className="text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">
        {label}
      </p>
      <p className="mt-2 text-xl font-semibold">{value}</p>
    </div>
  );
}
