import { Link } from "react-router-dom";

export function StatCard({ label, value, hint, href, icon, tone = "terracotta" }) {
  const content = (
    <div className="admin-stat-card">
      <div className="admin-stat-card__top">
        {icon && <div className={`admin-stat-card__icon admin-stat-card__icon--${tone}`}>{icon}</div>}
        <div className="admin-stat-card__meta">
          <p className="admin-stat-card__label">{label}</p>
          <p className="admin-stat-card__value">{value}</p>
        </div>
      </div>
      {(hint || href) && (
        <div className="admin-stat-card__footer">
          {hint && <span className="admin-stat-card__hint">{hint}</span>}
          {href && <span className="admin-stat-card__link">View</span>}
        </div>
      )}
    </div>
  );

  if (href) {
    return (
      <Link to={href} className="block transition hover:-translate-y-0.5">
        {content}
      </Link>
    );
  }

  return content;
}
