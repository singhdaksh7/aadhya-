import React, { useEffect, useState } from "react";
import { adminListNewsletter, adminDeleteNewsletterSubscriber, adminExportNewsletterCsv } from "../../lib/api";
import { Button } from "../../components/ui";
import { LoadingNotice, ErrorNotice } from "../../components/StateNotice";

const PAGE_SIZE = 50;
const inputCls = "w-full rounded-xl border border-charcoal/15 px-4 py-2.5 text-sm focus:border-charcoal/40 focus:outline-none";

export default function AdminNewsletter() {
  const [data, setData] = useState({ items: [], total: 0, totalAll: 0 });
  const [status, setStatus] = useState("loading");
  const [q, setQ] = useState("");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [reloadToken, setReloadToken] = useState(0);
  const [message, setMessage] = useState("");
  const reload = () => setReloadToken((n) => n + 1);

  useEffect(() => {
    let active = true;
    setStatus("loading");
    adminListNewsletter({ q: query, page, pageSize: PAGE_SIZE })
      .then((res) => { if (active) { setData(res.data); setStatus("ready"); } })
      .catch(() => { if (active) setStatus("error"); });
    return () => { active = false; };
  }, [query, page, reloadToken]);

  const search = (e) => { e.preventDefault(); setPage(1); setQuery(q.trim()); };

  const remove = async (s) => {
    if (!confirm(`Remove ${s.email} from the newsletter list?`)) return;
    try {
      await adminDeleteNewsletterSubscriber(s.id);
      setMessage(`${s.email} was removed.`);
      reload();
    } catch (err) {
      setMessage(err.message);
    }
  };

  const exportCsv = async () => {
    try {
      const blob = await adminExportNewsletterCsv(query);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "newsletter-subscribers.csv";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setMessage(err.message);
    }
  };

  const pages = Math.max(1, Math.ceil((data.total || 0) / PAGE_SIZE));

  return (
    <div>
      <div className="admin-page-header">
        <div>
          <p className="admin-page-header__eyebrow">Marketing</p>
          <h1 className="admin-page-header__title">Newsletter Subscribers</h1>
          <p className="admin-page-header__desc">People who signed up through the homepage newsletter box. Total subscribers: <strong data-testid="newsletter-total">{data.totalAll}</strong></p>
        </div>
        <Button type="button" onClick={exportCsv}>Export CSV</Button>
      </div>

      <form onSubmit={search} className="admin-card mb-5 flex flex-col gap-3 p-4 sm:flex-row">
        <input value={q} onChange={(e) => setQ(e.target.value)} className={inputCls} placeholder="Search by email" aria-label="Search by email" />
        <Button>Search</Button>
        {query && <Button type="button" variant="secondary" onClick={() => { setQ(""); setQuery(""); setPage(1); }}>Clear</Button>}
      </form>

      {message && <p role="status" className="mb-3 text-sm text-charcoal">{message}</p>}

      <div className="admin-card overflow-x-auto">
        {status === "loading" && <LoadingNotice />}
        {status === "error" && <ErrorNotice message="Unable to load subscribers." onRetry={reload} />}
        {status === "ready" && data.items.length === 0 && (
          <p className="py-8 text-center text-sm italic text-charcoal-soft">{query ? "No subscribers match your search." : "No subscribers yet."}</p>
        )}
        {status === "ready" && data.items.length > 0 && (
          <table className="w-full min-w-[480px] text-left text-sm">
            <thead className="bg-ivory-dark text-xs uppercase tracking-wide text-charcoal-soft">
              <tr><th className="px-4 py-3">Email</th><th className="px-4 py-3">Subscribed</th><th className="px-4 py-3">Actions</th></tr>
            </thead>
            <tbody className="divide-y divide-charcoal/10">
              {data.items.map((s) => (
                <tr key={s.id}>
                  <td className="px-4 py-3 font-medium text-charcoal break-all">{s.email}</td>
                  <td className="px-4 py-3 text-xs text-charcoal-soft">{new Date(s.createdAt).toLocaleString()}</td>
                  <td className="px-4 py-3"><button onClick={() => remove(s)} className="text-xs font-semibold text-terracotta hover:underline">Remove</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {status === "ready" && pages > 1 && (
        <div className="mt-4 flex items-center justify-between text-sm text-charcoal-soft">
          <Button type="button" variant="secondary" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</Button>
          <span>Page {page} of {pages} ({data.total} subscribers)</span>
          <Button type="button" variant="secondary" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>Next</Button>
        </div>
      )}
    </div>
  );
}
