import * as React from "react";

export interface Crumb {
  label: string;
  href?: string;
}
export interface BreadcrumbProps {
  items: Crumb[];
}

export function Breadcrumb({ items }: BreadcrumbProps) {
  return (
    <nav aria-label="Breadcrumb">
      <ol className="text-ink3 flex flex-wrap items-center gap-1 text-sm">
        {items.map((c, i) => {
          const last = i === items.length - 1;
          return (
            <li key={`${i}-${c.label}`} className="flex items-center gap-1">
              {last ? (
                <span aria-current="page" className="text-ink2">
                  {c.label}
                </span>
              ) : c.href ? (
                <a href={c.href} className="text-primary">
                  {c.label}
                </a>
              ) : (
                <span>{c.label}</span>
              )}
              {last ? null : <span aria-hidden="true">›</span>}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

export interface PageHeaderProps {
  eyebrow?: string;
  title: React.ReactNode;
  meta?: React.ReactNode;
  breadcrumb?: Crumb[];
  actions?: React.ReactNode;
}

export function PageHeader({ eyebrow, title, meta, breadcrumb, actions }: PageHeaderProps) {
  return (
    <header className="mb-4 flex flex-wrap items-start justify-between gap-4">
      <div className="min-w-0">
        {breadcrumb && breadcrumb.length > 0 ? <Breadcrumb items={breadcrumb} /> : null}
        {eyebrow ? <p className="text-label text-ink3 mb-1 font-semibold">{eyebrow}</p> : null}
        <h1 className="text-page text-ink font-semibold tracking-tight">{title}</h1>
        {meta ? <div className="text-small text-ink2 mt-2">{meta}</div> : null}
      </div>
      {actions ? (
        <div data-slot="actions" className="flex items-center gap-2">
          {actions}
        </div>
      ) : null}
    </header>
  );
}
