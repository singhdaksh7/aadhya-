import { useEffect, useState } from "react";
import { adminDashboard } from "../../lib/api";
import { LoadingNotice, ErrorNotice } from "../../components/StateNotice";
import { formatInr } from "../../lib/format";

const CARDS = [
  ["totalProducts", "Total Products"],
  ["activeProducts", "Active Products"],
  ["books", "Books"],
  ["otherProducts", "Other Products"],
  ["categories", "Categories"],
  ["lowStockProducts", "Low Stock Products"],
  ["totalOrders", "Total Orders"],
  ["pendingOrders", "Pending Orders"],
  ["ordersToday", "Orders Today"],
];

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

  return (
    <div>
      <h1 className="font-serif-display text-2xl text-charcoal">Dashboard</h1>
      <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3">
        {CARDS.map(([key, label]) => (
          <div key={key} className="rounded-2xl border border-charcoal/10 bg-white/60 p-5">
            <p className="text-2xl font-medium text-charcoal">{data[key]}</p>
            <p className="mt-1 text-xs uppercase tracking-wide text-charcoal-soft">{label}</p>
          </div>
        ))}
        <div className="rounded-2xl border border-charcoal/10 bg-white/60 p-5">
          <p className="text-2xl font-medium text-charcoal">{formatInr(data.paidRevenue)}</p>
          <p className="mt-1 text-xs uppercase tracking-wide text-charcoal-soft">Paid Revenue</p>
        </div>
      </div>
    </div>
  );
}
