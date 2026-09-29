import { useEffect, useState } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import { adminListCustomers, adminGetCustomer, adminUpdateCustomerStatus } from "../../lib/api";
import { LoadingNotice, ErrorNotice } from "../../components/StateNotice";
import { formatInr } from "../../lib/format";
import {
  PageHeader,
  AdminCard,
  FilterBar,
  StatusBadge,
  AdminTable,
  AdminTablePagination,
  AdminEmptyState,
  StatCard,
} from "../../components/admin/ui";
import { FilterInput } from "../../components/admin/ui/FilterBar";

export default function AdminCustomers() {
  const { id } = useParams();
  if (id) return <CustomerDetail id={id} />;
  return <CustomerList />;
}

function CustomerList() {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [result, setResult] = useState(null);
  const [status, setStatus] = useState("loading");
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setStatus("loading");
    adminListCustomers({ search: search || undefined, page, limit: 20 })
      .then((res) => {
        if (cancelled) return;
        setResult(res);
        setStatus("ready");
      })
      .catch(() => !cancelled && setStatus("error"));
    return () => {
      cancelled = true;
    };
  }, [search, page, reloadToken]);

  return (
    <div>
      <PageHeader eyebrow="Sales" title="Customers" description="Registered storefront customers and spend." />
      <FilterBar>
        <FilterInput
          type="search"
          value={search}
          onChange={(e) => {
            setPage(1);
            setSearch(e.target.value);
          }}
          placeholder="Search name, email, phone…"
          className="min-w-[240px] flex-1"
        />
      </FilterBar>
      <AdminCard noPadding>
        {status === "loading" && <LoadingNotice />}
        {status === "error" && <ErrorNotice message="Unable to load customers." onRetry={() => setReloadToken((t) => t + 1)} />}
        {status === "ready" && result.data.length === 0 && <AdminEmptyState title="No customers found" />}
        {status === "ready" && result.data.length > 0 && (
          <AdminTable
            columns={[
              { key: "name", label: "Name" },
              { key: "email", label: "Email" },
              { key: "phone", label: "Phone" },
              { key: "orders", label: "Orders" },
              { key: "spent", label: "Total Spent" },
              { key: "joined", label: "Joined" },
              { key: "status", label: "Status" },
              { key: "actions", label: "Actions" },
            ]}
            minWidth="900px"
          >
            {result.data.map((c) => (
              <tr key={c.id}>
                <td>{c.name}</td>
                <td>{c.email}</td>
                <td>{c.phone || "—"}</td>
                <td>{c.ordersCount ?? 0}</td>
                <td>{formatInr(c.totalSpent ?? 0)}</td>
                <td>{new Date(c.createdAt).toLocaleDateString("en-IN")}</td>
                <td>
                  <StatusBadge value={c.isActive ? "Active" : "Inactive"} tone={c.isActive ? "success" : "neutral"} />
                </td>
                <td>
                  <Link to={`/admin/customers/${c.id}`} className="admin-btn admin-btn--ghost">
                    View
                  </Link>
                </td>
              </tr>
            ))}
          </AdminTable>
        )}
      </AdminCard>
      {status === "ready" && (
        <AdminTablePagination page={page} totalPages={result?.meta?.totalPages} onPageChange={setPage} />
      )}
    </div>
  );
}

function CustomerDetail({ id }) {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [status, setStatus] = useState("loading");
  const [tab, setTab] = useState("orders");

  const load = () => {
    setStatus("loading");
    adminGetCustomer(id)
      .then((res) => {
        setData(res.data);
        setStatus("ready");
      })
      .catch(() => setStatus("error"));
  };

  useEffect(load, [id]);

  if (status === "loading") return <LoadingNotice />;
  if (status === "error" || !data) return <ErrorNotice message="Unable to load customer." onRetry={load} />;

  const profile = data.profile || data;
  const isActive = data.status === "active" || profile.isActive;

  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow="Sales"
        title={profile.name}
        description={profile.email}
        actions={
          <>
            <StatusBadge value={isActive ? "Active" : "Inactive"} tone={isActive ? "success" : "neutral"} />
            <button
              type="button"
              className="admin-btn admin-btn--ghost"
              onClick={async () => {
                await adminUpdateCustomerStatus(id, !isActive);
                load();
              }}
            >
              {isActive ? "Deactivate" : "Activate"}
            </button>
            <button type="button" className="admin-btn admin-btn--ghost" onClick={() => navigate("/admin/customers")}>
              Back
            </button>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Orders" value={data.orderCount ?? profile.ordersCount ?? 0} tone="terracotta" />
        <StatCard label="Total Spent" value={formatInr(data.totalSpend ?? profile.totalSpent ?? 0)} tone="sage" />
        <StatCard label="Reviews" value={data.reviewCount ?? profile.reviewsCount ?? 0} tone="beige" />
        <StatCard label="Wishlist" value={data.wishlistCount ?? profile.wishlistCount ?? 0} tone="terracotta" />
      </div>

      <div className="flex flex-wrap gap-2">
        {["orders", "addresses", "profile"].map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`admin-btn ${tab === t ? "admin-btn--primary" : "admin-btn--ghost"}`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === "orders" && (
        <AdminCard title="Recent Orders" noPadding>
          {(data.recentOrders || []).length === 0 ? (
            <AdminEmptyState title="No orders" />
          ) : (
            <AdminTable
              columns={[
                { key: "order", label: "Order" },
                { key: "date", label: "Date" },
                { key: "total", label: "Total" },
                { key: "payment", label: "Payment" },
                { key: "status", label: "Status" },
              ]}
            >
              {data.recentOrders.map((o) => (
                <tr key={o.id}>
                  <td>
                    <Link to={`/admin/orders/${o.id}`} className="text-terracotta hover:underline">
                      {o.orderNumber}
                    </Link>
                  </td>
                  <td>{new Date(o.createdAt).toLocaleDateString("en-IN")}</td>
                  <td>{formatInr(o.totalAmount)}</td>
                  <td>
                    <StatusBadge value={o.paymentStatus} />
                  </td>
                  <td>
                    <StatusBadge value={o.status} />
                  </td>
                </tr>
              ))}
            </AdminTable>
          )}
        </AdminCard>
      )}

      {tab === "addresses" && (
        <AdminCard title="Addresses">
          {(data.addresses || []).length === 0 ? (
            <p className="text-sm text-charcoal-soft">No saved addresses.</p>
          ) : (
            <ul className="space-y-3 text-sm text-charcoal-soft">
              {data.addresses.map((a) => (
                <li key={a.id} className="rounded-lg border border-charcoal/10 px-3 py-2">
                  <p className="font-semibold text-charcoal">{a.label || "Address"}{a.isDefault ? " · Default" : ""}</p>
                  <p>
                    {a.city}, {a.state}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </AdminCard>
      )}

      {tab === "profile" && (
        <AdminCard title="Profile">
          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-xs uppercase tracking-wider text-charcoal-soft">Phone</dt>
              <dd className="mt-1 text-charcoal">{profile.phone || "—"}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wider text-charcoal-soft">Joined</dt>
              <dd className="mt-1 text-charcoal">{new Date(profile.createdAt).toLocaleDateString("en-IN")}</dd>
            </div>
          </dl>
        </AdminCard>
      )}
    </div>
  );
}
