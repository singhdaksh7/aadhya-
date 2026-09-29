import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAdminAuth } from "../../context/AdminAuthContext";
import { adminGetShippingBusiness, adminSaveShippingBusiness, adminGetIntegrationStatus, adminTestIntegration } from "../../lib/api";
import { PageHeader, AdminCard, StatusBadge } from "../../components/admin/ui";

const initialBusiness = {
  provider: "MANUAL",
  environment: "TEST",
  autoCreateShipment: false,
  autoGenerateAwb: false,
  autoSchedulePickup: false,
  codAllowed: true,
  packageDefaults: { length: 20, width: 15, height: 10, weight: 0.5 },
};

export default function AdminShipping() {
  const { admin } = useAdminAuth();
  const [business, setBusiness] = useState(initialBusiness);
  const [status, setStatus] = useState(null);
  const [message, setMessage] = useState("");

  const load = () => {
    adminGetShippingBusiness()
      .then((r) =>
        setBusiness((v) => ({
          ...v,
          ...r.data,
          packageDefaults: { ...v.packageDefaults, ...(r.data.packageDefaults || {}) },
        }))
      )
      .catch(() => {});
    adminGetIntegrationStatus()
      .then((r) => setStatus(r.data))
      .catch(() => {});
  };

  useEffect(load, []);

  if (admin?.role !== "SUPER_ADMIN") {
    return (
      <p className="rounded-xl bg-terracotta/10 p-4 text-sm text-terracotta">
        Only super administrators may manage shipping settings.
      </p>
    );
  }

  const shiprocket = status?.credentials?.find((x) => x.provider === "SHIPROCKET");

  return (
    <div className="space-y-4 max-w-5xl">
      <PageHeader
        eyebrow="Operations"
        title="Shipping"
        description="Provider, automation, package defaults, and connection health."
        actions={
          <Link to="/admin/integrations" className="admin-btn admin-btn--ghost">
            Integrations
          </Link>
        }
      />
      {message && <p className="rounded-xl bg-sage-light px-3 py-2 text-sm text-green-deep">{message}</p>}

      <div className="grid gap-4 lg:grid-cols-3">
        <AdminCard title="Provider" subtitle="Active fulfilment channel">
          <div className="space-y-3">
            <p className="text-lg font-semibold text-charcoal">{business.provider}</p>
            <StatusBadge value={business.environment} tone={business.environment === "LIVE" ? "success" : "neutral"} />
            <p className="text-xs text-charcoal-soft">
              Delhivery is listed for future use and remains unavailable until contracted API specs land.
            </p>
          </div>
        </AdminCard>
        <AdminCard title="Shiprocket status" subtitle="Masked credential health">
          <p className="text-sm text-charcoal-soft">
            {shiprocket?.configured
              ? `Configured · ${shiprocket.testStatus || "not tested"}`
              : "Not configured"}
          </p>
          {shiprocket?.lastTestedAt && (
            <p className="mt-2 text-xs text-charcoal-soft">
              Last tested {new Date(shiprocket.lastTestedAt).toLocaleString("en-IN")}
            </p>
          )}
          <button
            type="button"
            className="admin-btn admin-btn--ghost mt-3"
            onClick={async () => {
              try {
                await adminTestIntegration("SHIPROCKET", business.environment);
                setMessage("Connection test completed.");
                load();
              } catch (e) {
                setMessage(e.message);
              }
            }}
          >
            Test connection
          </button>
        </AdminCard>
        <AdminCard title="Automation">
          <ul className="space-y-2 text-sm text-charcoal-soft">
            <li>Auto-create shipment: <strong className="text-charcoal">{business.autoCreateShipment ? "On" : "Off"}</strong></li>
            <li>Auto-generate AWB: <strong className="text-charcoal">{business.autoGenerateAwb ? "On" : "Off"}</strong></li>
            <li>Auto-schedule pickup: <strong className="text-charcoal">{business.autoSchedulePickup ? "On" : "Off"}</strong></li>
            <li>COD allowed: <strong className="text-charcoal">{business.codAllowed ? "On" : "Off"}</strong></li>
          </ul>
        </AdminCard>
      </div>

      <AdminCard title="Shipping settings">
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            try {
              await adminSaveShippingBusiness({
                ...business,
                packageDefaults: Object.fromEntries(
                  Object.entries(business.packageDefaults).map(([k, v]) => [k, Number(v)])
                ),
              });
              setMessage("Shipping settings saved.");
              load();
            } catch (err) {
              setMessage(err.message);
            }
          }}
          className="admin-form-grid sm:grid-cols-2"
        >
          <label className="admin-label">
            Provider
            <select
              className="admin-select"
              value={business.provider}
              onChange={(e) => setBusiness({ ...business, provider: e.target.value })}
            >
              <option>MANUAL</option>
              <option>SHIPROCKET</option>
              <option disabled>DELHIVERY</option>
            </select>
          </label>
          <label className="admin-label">
            Environment
            <select
              className="admin-select"
              value={business.environment}
              onChange={(e) => setBusiness({ ...business, environment: e.target.value })}
            >
              <option>TEST</option>
              <option>LIVE</option>
            </select>
          </label>
          {[
            ["autoCreateShipment", "Auto-create shipment"],
            ["autoGenerateAwb", "Auto-generate AWB"],
            ["autoSchedulePickup", "Auto-schedule pickup"],
            ["codAllowed", "COD allowed"],
          ].map(([k, l]) => (
            <label key={k} className="flex items-center gap-2 text-xs text-charcoal">
              <input
                type="checkbox"
                checked={Boolean(business[k])}
                onChange={(e) => setBusiness({ ...business, [k]: e.target.checked })}
              />
              {l}
            </label>
          ))}
          <div className="grid grid-cols-2 gap-3 sm:col-span-2 sm:grid-cols-4">
            {Object.entries(business.packageDefaults).map(([k, v]) => (
              <label key={k} className="admin-label">
                Package {k}
                <input
                  type="number"
                  className="admin-input"
                  value={v}
                  onChange={(e) =>
                    setBusiness({
                      ...business,
                      packageDefaults: { ...business.packageDefaults, [k]: e.target.value },
                    })
                  }
                />
              </label>
            ))}
          </div>
          <div className="sm:col-span-2">
            <button type="submit" className="admin-btn admin-btn--primary">
              Save shipping settings
            </button>
          </div>
        </form>
      </AdminCard>
    </div>
  );
}
