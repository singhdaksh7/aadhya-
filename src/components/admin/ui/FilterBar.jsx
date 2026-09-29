export function FilterBar({ children, className = "" }) {
  return <div className={`admin-filter-bar ${className}`}>{children}</div>;
}

export function FilterInput(props) {
  return <input {...props} className={`admin-input ${props.className || ""}`} />;
}

export function FilterSelect(props) {
  return <select {...props} className={`admin-input admin-select ${props.className || ""}`} />;
}
