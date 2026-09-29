export function AdminEmptyState({ title = "Nothing here yet", description, action }) {
  return (
    <div className="admin-empty">
      <p className="admin-empty__title">{title}</p>
      {description && <p className="admin-empty__desc">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
