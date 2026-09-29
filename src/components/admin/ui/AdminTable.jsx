export function AdminTable({ columns, children, minWidth = "720px", stickyHeader = true }) {
  return (
    <div className="admin-table-wrap">
      <table className="admin-table" style={{ minWidth }}>
        <thead className={stickyHeader ? "admin-table__head--sticky" : undefined}>
          <tr>
            {columns.map((col) => (
              <th key={col.key || col.label} className={col.className}>
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

export function AdminTablePagination({ page, totalPages, onPageChange }) {
  if (!totalPages || totalPages <= 1) return null;
  return (
    <div className="admin-pagination">
      <button type="button" disabled={page <= 1} onClick={() => onPageChange(page - 1)} className="admin-btn admin-btn--ghost">
        Previous
      </button>
      <span className="admin-pagination__meta">
        Page {page} of {totalPages}
      </span>
      <button
        type="button"
        disabled={page >= totalPages}
        onClick={() => onPageChange(page + 1)}
        className="admin-btn admin-btn--ghost"
      >
        Next
      </button>
    </div>
  );
}
