import { useId, type ReactNode } from "react";

export function SettingsSection({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  const id = useId();
  return (
    <section className="settings-section" aria-labelledby={id}>
      <div className="settings-section-heading">
        <h2 id={id}>{title}</h2>
        {description && <p>{description}</p>}
      </div>
      {children}
    </section>
  );
}

export function SettingRow({
  label,
  htmlFor,
  description,
  children,
}: {
  label: string;
  htmlFor: string;
  description: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="setting-row">
      <div className="setting-row-copy">
        <label htmlFor={htmlFor}>{label}</label>
        <p id={`${htmlFor}-description`}>{description}</p>
      </div>
      <div className="setting-row-control">{children}</div>
    </div>
  );
}
