import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { adminDashboard } from "../../lib/api";
import { LoadingNotice, ErrorNotice } from "../../components/StateNotice";
import { formatInr } from "../../lib/format";
import { AdminCard, StatCard, StatusBadge, AdminTable, AdminEmptyState, PageHeader } from "../../components/admin/ui";

const PRIMARY_KPIS = [
  { key: "totalOrders", label: "Total Orders", href: "/admin/orders", tone: "terracotta", hint: "All time", format: "number" },
  { key: "paidRevenue", label: "Revenue", href: "/admin/analytics", tone: "sage", hint: "Paid orders", format: "inr" },
  { key: "customers", label: "Customers", href: "/admin/customers", tone: "beige", hint: "Registered", format: "number" },
  { key: "totalProducts", label: "Products", href: "/admin/products", tone: "terracotta", hint: "Catalog", format: "number" },
];

const SECONDARY_KPIS = [
  { key: "pendingOrders", label: "Pending Orders", href: "/admin/orders" },
  { key: "lowStockProducts", label: "Low Stock", href: "/admin/inventory" },
  { key: "activeCoupons", label: "Active Coupons", href: "/admin/coupons" },
  { key: "digitalDownloads", label: "Digital Downloads", href: "/admin/products" },
];

function formatValue(value, format) {
  if (value == null) return "—";
  if (format === "inr") return formatInr(value);
  return Number(value).toLocaleString("en-IN");
}

function fulfilmentLabel(order) {
  if (order.shipment?.trackingNumber || order.shipment?.carrier) {
    return order.shipment.status || "Shipped";
  }
  if (["SHIPPED", "DELIVERED"].includes(order.status)) return order.status;
  return "Unfulfilled";
}

export default function AdminDashboard() {
  const [data, setData] = useState(null);
  const [status, setStatus] = useState("loading");

  useEffect(() => {
    adminDashboard()
      .then((res) => {
        setData(res.data);
        setStatus("ready");
      })
      .catch(() => setStatus("error"));
  }, []);

  if (status === "loading") return <LoadingNotice />;
  if (status === "error") return <ErrorNotice message="Unable to load the dashboard." />;

  const recent = data.recentOrders || [];

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Overview"
        title="Dashboard"
        description="Live store performance from Aadya orders, catalog, and customers."
        actions={
          <Link to="/admin/products/new" className="admin-btn admin-btn--primary">
            Add Product
          </Link>
        }
      />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {PRIMARY_KPIS.map((kpi) => (
          <StatCard
            key={kpi.key}
            label={kpi.label}
            value={formatValue(data[kpi.key], kpi.format)}
            hint={kpi.hint}
            href={kpi.href}
            tone={kpi.tone}
            icon={<span className="text-sm font-bold">◆</span>}
          />
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {SECONDARY_KPIS.map((kpi) => (
          <Link key={kpi.key} to={kpi.href} className="admin-card px-4 py-3 transition hover:border-terracotta/30">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-charcoal-soft">{kpi.label}</p>
            <p className="mt-1 text-xl font-semibold text-charcoal">{formatValue(data[kpi.key], "number")}</p>
          </Link>
        ))}
      </div>

      <AdminCard
        title="Recent Orders"
        subtitle="Latest storefront checkouts"
        actions={
          <Link to="/admin/orders" className="admin-btn admin-btn--ghost">
            View All
          </Link>
        }
        noPadding
      >
        {recent.length === 0 ? (
          <AdminEmptyState title="No orders yet" description="Orders will appear here as customers check out." />
        ) : (
          <AdminTable
            columns={[
              { key: "order", label: "Order" },
              { key: "date", label: "Date" },
              { key: "customer", label: "Customer" },
              { key: "amount", label: "Amount" },
              { key: "payment", label: "Payment" },
              { key: "fulfilment", label: "Fulfilment" },
              { key: "status", label: "Status" },
              { key: "action", label: "Action" },
            ]}
            minWidth="900px"
          >
            {recent.map((order) => (
              <tr key={order.id}>
                <td>
                  <Link to={`/admin/orders/${order.id}`} className="text-terracotta hover:underline">
                    {order.orderNumber}
                  </Link>
                </td>
                <td>{new Date(order.createdAt).toLocaleDateString("en-IN")}</td>
                <td>
                  <div className="leading-tight">
                    <p className="font-medium text-charcoal">{order.customerName}</p>
                    <p className="text-[11px]">{order.customerEmail}</p>
                  </div>
                </td>
                <td>{formatInr(order.totalAmount)}</td>
                <td>
                  <StatusBadge value={order.paymentStatus} />
                </td>
                <td>
                  <StatusBadge value={fulfilmentLabel(order)} tone={order.shipment ? "info" : "neutral"} />
                </td>
                <td>
                  <StatusBadge value={order.status} />
                </td>
                <td>
                  <Link to={`/admin/orders/${order.id}`} className="admin-btn admin-btn--ghost">
                    View
                  </Link>
                </td>
              </tr>
            ))}
          </AdminTable>
        )}
      </AdminCard>
    </div>
  );
}
