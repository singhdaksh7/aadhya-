export function AdminCard({ title, subtitle, actions, children, className = "", bodyClassName = "", noPadding = false }) {
  return (
    <section className={`admin-card ${className}`}>
      {(title || actions) && (
        <div className="admin-card__header">
          <div className="min-w-0">
            {title && <h2 className="admin-card__title">{title}</h2>}
            {subtitle && <p className="admin-card__subtitle">{subtitle}</p>}
          </div>
          {actions && <div className="admin-card__actions">{actions}</div>}
        </div>
      )}
      <div className={`${noPadding ? "" : "admin-card__body"} ${bodyClassName}`}>{children}</div>
    </section>
  );
}
