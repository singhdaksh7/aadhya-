import { useEffect, useState } from "react";
import { fetchAdminAnalyticsOverview, fetchAdminAbandonedCarts, sendAbandonedCartRecoveryEmail } from "../../lib/api";
import { LoadingNotice, ErrorNotice } from "../../components/StateNotice";
import { formatInr } from "../../lib/format";

const RANGE_OPTIONS = [
  { value: "today", label: "Today" },
  { value: "7d", label: "Last 7 Days" },
  { value: "30d", label: "Last 30 Days" },
  { value: "90d", label: "Last 90 Days" },
  { value: "custom", label: "Custom" },
];

function StatCard({ label, value, sub }) {
  return (
    <div className="rounded-2xl border border-charcoal/10 bg-white p-5">
      <p className="text-xs font-semibold uppercase tracking-wider text-charcoal-soft">{label}</p>
      <p className="mt-2 text-2xl font-serif-display text-charcoal">{value}</p>
      {sub && <p className="mt-1 text-xs text-charcoal-soft">{sub}</p>}
    </div>
  );
}

export default function AdminAnalytics() {
  const [range, setRange] = useState("30d");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [overview, setOverview] = useState(null);
  const [status, setStatus] = useState("loading");
  const [abandonedCarts, setAbandonedCarts] = useState([]);
  const [cartStatus, setCartStatus] = useState("loading");

  useEffect(() => {
    if (range === "custom" && (!customFrom || !customTo)) return;
    setStatus("loading");
    fetchAdminAnalyticsOverview({ range, from: range === "custom" ? customFrom : undefined, to: range === "custom" ? customTo : undefined })
      .then((res) => {
        setOverview(res.data);
        setStatus("ready");
      })
      .catch(() => setStatus("error"));
  }, [range, customFrom, customTo]);

  useEffect(() => {
    setCartStatus("loading");
    fetchAdminAbandonedCarts()
      .then((res) => {
        setAbandonedCarts(res.data || []);
        setCartStatus("ready");
      })
      .catch(() => setCartStatus("error"));
  }, []);

  const handleSendRecovery = async (cartId) => {
    await sendAbandonedCartRecoveryEmail(cartId);
    const res = await fetchAdminAbandonedCarts();
    setAbandonedCarts(res.data || []);
  };

  const formatDuration = (ms) => {
    const hours = Math.floor(ms / (1000 * 60 * 60));
    if (hours < 24) return `${hours}h`;
    return `${Math.floor(hours / 24)}d ${hours % 24}h`;
  };

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="font-serif-display text-2xl text-charcoal">Analytics</h1>
        <div className="flex flex-wrap items-center gap-2">
          {RANGE_OPTIONS.map((o) => (
            <button
              key={o.value}
              onClick={() => setRange(o.value)}
              className={`rounded-full border px-4 py-1.5 text-xs font-semibold uppercase tracking-wider transition ${
                range === o.value ? "border-terracotta bg-terracotta text-ivory" : "border-charcoal/15 text-charcoal-soft hover:border-terracotta"
              }`}
            >
              {o.label}
            </button>
          ))}
          {range === "custom" && (
            <>
              <input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} className="rounded-full border border-charcoal/15 px-3 py-1.5 text-xs" />
              <input type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)} className="rounded-full border border-charcoal/15 px-3 py-1.5 text-xs" />
            </>
          )}
        </div>
      </div>

      {status === "loading" && <LoadingNotice className="mt-6" />}
      {status === "error" && <ErrorNotice className="mt-6" message="Could not load analytics." />}

      {status === "ready" && overview && (
        <>
          <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
            <StatCard label="Revenue" value={formatInr(overview.revenue.revenue)} sub={`Prev: ${formatInr(overview.revenue.previousRevenue)}`} />
            <StatCard label="Orders" value={overview.revenue.orderCount} />
            <StatCard label="Avg Order Value" value={formatInr(overview.revenue.aov)} />
            <StatCard label="Customers" value={overview.revenue.customerCount} />
          </div>

          <div className="mt-8 grid gap-6 lg:grid-cols-2">
            <section className="rounded-2xl border border-charcoal/10 bg-white p-5">
              <h2 className="mb-3 font-serif-display text-lg text-charcoal">Top Products</h2>
              {overview.products.length === 0 ? (
                <p className="text-sm text-charcoal-soft">No sales in this period.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <tbody>
                      {overview.products.map((p) => (
                        <tr key={p.productId} className="border-b border-charcoal/5">
                          <td className="py-2">{p.product?.name || "Deleted product"}</td>
                          <td className="py-2 text-right">{p.unitsSold} units</td>
                          <td className="py-2 text-right font-medium">{formatInr(p.revenue)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            <section className="rounded-2xl border border-charcoal/10 bg-white p-5">
              <h2 className="mb-3 font-serif-display text-lg text-charcoal">Category Performance</h2>
              {overview.categories.length === 0 ? (
                <p className="text-sm text-charcoal-soft">No sales in this period.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <tbody>
                      {overview.categories.map((c) => (
                        <tr key={c.category.id} className="border-b border-charcoal/5">
                          <td className="py-2">{c.category.name}</td>
                          <td className="py-2 text-right">{c.unitsSold} units</td>
                          <td className="py-2 text-right font-medium">{formatInr(c.revenue)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            <section className="rounded-2xl border border-charcoal/10 bg-white p-5">
              <h2 className="mb-3 font-serif-display text-lg text-charcoal">Collection Performance</h2>
              {overview.collections.length === 0 ? (
                <p className="text-sm text-charcoal-soft">No sales in this period.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <tbody>
                      {overview.collections.map((c) => (
                        <tr key={c.collection.id} className="border-b border-charcoal/5">
                          <td className="py-2">{c.collection.title}</td>
                          <td className="py-2 text-right">{c.unitsSold} units</td>
                          <td className="py-2 text-right font-medium">{formatInr(c.revenue)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            <section className="rounded-2xl border border-charcoal/10 bg-white p-5">
              <h2 className="mb-3 font-serif-display text-lg text-charcoal">Coupon Usage</h2>
              {overview.coupons.length === 0 ? (
                <p className="text-sm text-charcoal-soft">No coupon redemptions in this period.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <tbody>
                      {overview.coupons.map((c, i) => (
                        <tr key={c.coupon?.id || i} className="border-b border-charcoal/5">
                          <td className="py-2">{c.coupon?.code || "Deleted coupon"}</td>
                          <td className="py-2 text-right">{c.redemptions} uses</td>
                          <td className="py-2 text-right font-medium">-{formatInr(c.totalDiscount)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </div>

          <section className="mt-8 rounded-2xl border border-charcoal/10 bg-white p-5">
            <h2 className="mb-3 font-serif-display text-lg text-charcoal">Inventory Insights</h2>
            <div className="grid gap-6 sm:grid-cols-2">
              <div>
                <p className="mb-2 text-sm font-semibold text-charcoal">Low Stock ({overview.inventory.lowStockCount})</p>
                <ul className="space-y-1 text-sm text-charcoal-soft">
                  {overview.inventory.lowStock.slice(0, 8).map((p) => (
                    <li key={p.id}>{p.name} — {p.stockQuantity} left</li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="mb-2 text-sm font-semibold text-charcoal">Out of Stock ({overview.inventory.outOfStockCount})</p>
                <ul className="space-y-1 text-sm text-charcoal-soft">
                  {overview.inventory.outOfStock.slice(0, 8).map((p) => (
                    <li key={p.id}>{p.name}</li>
                  ))}
                </ul>
              </div>
            </div>
          </section>
        </>
      )}

      <section className="mt-8 rounded-2xl border border-charcoal/10 bg-white p-5">
        <h2 className="mb-3 font-serif-display text-lg text-charcoal">Abandoned Carts</h2>
        {cartStatus === "loading" && <LoadingNotice />}
        {cartStatus === "error" && <ErrorNotice message="Could not load abandoned carts." />}
        {cartStatus === "ready" && abandonedCarts.length === 0 && <p className="text-sm text-charcoal-soft">No abandoned carts right now.</p>}
        {cartStatus === "ready" && abandonedCarts.length > 0 && (
          <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wider text-charcoal-soft">
                <th className="py-2">Customer</th>
                <th className="py-2">Items</th>
                <th className="py-2 text-right">Value</th>
                <th className="py-2 text-right">Abandoned</th>
                <th className="py-2 text-right">Recovery</th>
                <th className="py-2" />
              </tr>
            </thead>
            <tbody>
              {abandonedCarts.map((c) => (
                <tr key={c.cartId} className="border-b border-charcoal/5">
                  <td className="py-2">{c.customer?.name}<br /><span className="text-xs text-charcoal-soft">{c.customer?.email}</span></td>
                  <td className="py-2">{c.itemCount} item{c.itemCount === 1 ? "" : "s"}</td>
                  <td className="py-2 text-right font-medium">{formatInr(c.value)}</td>
                  <td className="py-2 text-right">{formatDuration(c.abandonedDurationMs)}</td>
                  <td className="py-2 text-right">{c.recoveryStatus === "sent" ? "Sent" : "Not sent"}</td>
                  <td className="py-2 text-right">
                    {c.recoveryStatus !== "sent" && (
                      <button
                        onClick={() => handleSendRecovery(c.cartId)}
                        className="rounded-full border border-terracotta px-3 py-1 text-xs font-semibold text-terracotta hover:bg-terracotta hover:text-ivory"
                      >
                        Send Recovery Email
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        )}
      </section>
    </div>
  );
}
