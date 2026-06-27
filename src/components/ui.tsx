import {
  CircleAlert,
  LoaderCircle,
  Plane,
  type LucideIcon,
} from "lucide-react";
import type { ButtonHTMLAttributes, ReactNode } from "react";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";

export function Button({
  children,
  className = "",
  icon: Icon,
  loading = false,
  variant = "primary",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  icon?: LucideIcon;
  loading?: boolean;
  variant?: ButtonVariant;
}) {
  const LeadingIcon = loading ? LoaderCircle : Icon;
  return (
    <button
      className={`ar-button ar-button--${variant} ${className}`}
      {...props}
      disabled={loading || props.disabled}
    >
      {LeadingIcon ? (
        <LeadingIcon
          aria-hidden="true"
          className={loading ? "ar-button__spinner" : ""}
          size={17}
          strokeWidth={1.8}
        />
      ) : null}
      <span>{children}</span>
    </button>
  );
}

export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`ar-brand ${compact ? "ar-brand--compact" : ""}`}>
      <span className="ar-brand__mark" aria-hidden="true">
        <Plane size={compact ? 22 : 36} strokeWidth={1.8} />
      </span>
      <span className="ar-brand__name">
        AeroRoute <small>MLX</small>
      </span>
    </div>
  );
}

export function Field({
  children,
  hint,
  label,
}: {
  children: ReactNode;
  hint?: string;
  label: string;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
      {hint ? <small>{hint}</small> : null}
    </label>
  );
}

export function Panel({
  children,
  className = "",
  eyebrow,
  title,
}: {
  children: ReactNode;
  className?: string;
  eyebrow?: string;
  title: string;
}) {
  return (
    <section className={`panel ${className}`}>
      <header className="panel__header">
        {eyebrow ? <span>{eyebrow}</span> : null}
        <h2>{title}</h2>
      </header>
      {children}
    </section>
  );
}

export type TabItem<T extends string> = { id: T; label: string };

export function Tabs<T extends string>({
  active,
  ariaLabel,
  compact = false,
  items,
  onChange,
}: {
  active: T;
  ariaLabel: string;
  compact?: boolean;
  items: TabItem<T>[];
  onChange: (id: T) => void;
}) {
  return (
    <div
      className={`tabs ${compact ? "compact" : ""}`}
      role="tablist"
      aria-label={ariaLabel}
    >
      {items.map((item) => (
        <button
          aria-selected={active === item.id}
          className={active === item.id ? "active" : ""}
          key={item.id}
          onClick={() => onChange(item.id)}
          role="tab"
          type="button"
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}

export function StatusBadge({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "success" | "info" | "warning" | "danger" | "neutral";
}) {
  return (
    <span className={`status-badge status-badge--${tone}`}>{children}</span>
  );
}

export function Metric({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="metric">
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

export function Capability({
  body,
  icon: Icon,
  title,
}: {
  body: string;
  icon: LucideIcon;
  title: string;
}) {
  return (
    <div className="capability">
      <span className="capability__icon" aria-hidden="true">
        <Icon size={30} strokeWidth={1.6} />
      </span>
      <strong>{title}</strong>
      <p>{body}</p>
    </div>
  );
}

export function Alert({
  children,
  tone = "danger",
}: {
  children: ReactNode;
  tone?: "danger" | "warning";
}) {
  return (
    <div className={`ar-alert ar-alert--${tone}`} role="alert">
      <CircleAlert aria-hidden="true" size={18} />
      <span>{children}</span>
    </div>
  );
}
