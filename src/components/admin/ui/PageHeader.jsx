export function PageHeader({ eyebrow, title, description, actions, children }) {
  return (
    <div className="admin-page-header">
      <div className="min-w-0 flex-1">
        {eyebrow && <p className="admin-page-header__eyebrow">{eyebrow}</p>}
        <h1 className="admin-page-header__title">{title}</h1>
        {description && <p className="admin-page-header__desc">{description}</p>}
        {children}
      </div>
      {actions && <div className="admin-page-header__actions">{actions}</div>}
    </div>
  );
}
