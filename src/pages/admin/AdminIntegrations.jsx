import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAdminAuth } from "../../context/AdminAuthContext";
import {
  adminGetIntegrationStatus,
  adminSaveIntegration,
  adminTestIntegration,
  adminGetShippingBusiness,
  adminSaveShippingBusiness,
} from "../../lib/api";
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

const Input = ({ label, type = "text", value, onChange, required }) => (
  <label className="admin-label">
    {label}
    <input required={required} type={type} value={value || ""} onChange={onChange} className="admin-input" />
  </label>
);

function ProviderCard({ name, configured, environment, testStatus, lastTestedAt, children }) {
  return (
    <AdminCard
      title={name}
      subtitle={configured ? "Credentials stored securely (masked)" : "Not configured"}
      actions={
        <>
          <StatusBadge value={configured ? "Configured" : "Pending"} tone={configured ? "success" : "neutral"} />
          {environment && <StatusBadge value={environment} />}
        </>
      }
    >
      {(testStatus || lastTestedAt) && (
        <p className="mb-3 text-xs text-charcoal-soft">
          {testStatus || "not tested"}
          {lastTestedAt ? ` · last tested ${new Date(lastTestedAt).toLocaleString("en-IN")}` : ""}
        </p>
      )}
      {children}
    </AdminCard>
  );
}

export default function AdminIntegrations() {
  const { admin } = useAdminAuth();
  const [status, setStatus] = useState(null);
  const [message, setMessage] = useState("");
  const [business, setBusiness] = useState(initialBusiness);
  const [razorpay, setRazorpay] = useState({ environment: "TEST", keyId: "", keySecret: "", webhookSecret: "" });
  const [shiprocket, setShiprocket] = useState({
    environment: "TEST",
    apiEmail: "",
    apiPassword: "",
    apiBaseUrl: "",
    webhookSecret: "",
    enabled: true,
  });

  const load = () => {
    adminGetIntegrationStatus()
      .then((r) => setStatus(r.data))
      .catch((e) => setMessage(e.message));
    adminGetShippingBusiness()
      .then((r) =>
        setBusiness((v) => ({
          ...v,
          ...r.data,
          packageDefaults: { ...v.packageDefaults, ...(r.data.packageDefaults || {}) },
        }))
      )
      .catch(() => {});
  };

  useEffect(load, []);

  if (admin?.role !== "SUPER_ADMIN") {
    return (
      <p className="rounded-xl bg-terracotta/10 p-4 text-sm text-terracotta">
        Only super administrators may manage integrations.
      </p>
    );
  }

  const credential = async (e) => {
    e.preventDefault();
    try {
      await adminSaveIntegration({ provider: "SHIPROCKET", environment: shiprocket.environment, data: shiprocket });
      setShiprocket((v) => ({ ...v, apiPassword: "", webhookSecret: "" }));
      setMessage("Shiprocket credentials saved securely.");
      load();
    } catch (err) {
      setMessage(err.message);
    }
  };

  const findCred = (provider) => status?.credentials?.find((x) => x.provider === provider);
  const razorpayCred = findCred("RAZORPAY");
  const shiprocketCred = findCred("SHIPROCKET");

  return (
    <div className="max-w-5xl space-y-4">
      <PageHeader
        eyebrow="Operations"
        title="Integrations"
        description="Payment and shipping providers. Secrets are never displayed after save."
        actions={
          <Link to="/admin/shipping" className="admin-btn admin-btn--ghost">
            Shipping
          </Link>
        }
      />
      {message && (
        <p role="status" aria-live="polite" className="rounded-xl bg-sage-light px-3 py-2 text-sm text-green-deep">
          {message}
        </p>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <ProviderCard
          name="Razorpay"
          configured={Boolean(razorpayCred?.configured)}
          environment={razorpay.environment}
          testStatus={razorpayCred?.testStatus}
          lastTestedAt={razorpayCred?.lastTestedAt}
        >
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              try {
                await adminSaveIntegration({ provider: "RAZORPAY", environment: razorpay.environment, data: razorpay });
                setMessage("Razorpay credentials saved securely.");
                setRazorpay((v) => ({ ...v, keySecret: "", webhookSecret: "" }));
                load();
              } catch (err) {
                setMessage(err.message);
              }
            }}
            className="admin-form-grid sm:grid-cols-2"
          >
            <label className="admin-label">
              Environment
              <select
                className="admin-select"
                value={razorpay.environment}
                onChange={(e) => setRazorpay({ ...razorpay, environment: e.target.value })}
              >
                <option>TEST</option>
                <option>LIVE</option>
              </select>
            </label>
            <Input label="Key ID" value={razorpay.keyId} required onChange={(e) => setRazorpay({ ...razorpay, keyId: e.target.value })} />
            <Input
              label="Key Secret"
              type="password"
              value={razorpay.keySecret}
              required
              onChange={(e) => setRazorpay({ ...razorpay, keySecret: e.target.value })}
            />
            <Input
              label="Webhook secret"
              type="password"
              value={razorpay.webhookSecret}
              onChange={(e) => setRazorpay({ ...razorpay, webhookSecret: e.target.value })}
            />
            <div className="sm:col-span-2">
              <button className="admin-btn admin-btn--primary">Save Razorpay</button>
            </div>
          </form>
        </ProviderCard>

        <ProviderCard
          name="Shiprocket"
          configured={Boolean(shiprocketCred?.configured)}
          environment={shiprocket.environment}
          testStatus={shiprocketCred?.testStatus}
          lastTestedAt={shiprocketCred?.lastTestedAt}
        >
          <form onSubmit={credential} className="admin-form-grid sm:grid-cols-2">
            <Input
              label="Email / username"
              type="email"
              value={shiprocket.apiEmail}
              required
              onChange={(e) => setShiprocket({ ...shiprocket, apiEmail: e.target.value })}
            />
            <Input
              label="Password"
              type="password"
              value={shiprocket.apiPassword}
              required
              onChange={(e) => setShiprocket({ ...shiprocket, apiPassword: e.target.value })}
            />
            <Input
              label="API/base URL (optional)"
              type="url"
              value={shiprocket.apiBaseUrl}
              onChange={(e) => setShiprocket({ ...shiprocket, apiBaseUrl: e.target.value })}
            />
            <Input
              label="Webhook secret"
              type="password"
              value={shiprocket.webhookSecret}
              onChange={(e) => setShiprocket({ ...shiprocket, webhookSecret: e.target.value })}
            />
            <label className="admin-label">
              Environment
              <select
                className="admin-select"
                value={shiprocket.environment}
                onChange={(e) => setShiprocket({ ...shiprocket, environment: e.target.value })}
              >
                <option>TEST</option>
                <option>LIVE</option>
              </select>
            </label>
            <div className="flex flex-wrap items-end gap-2">
              <button className="admin-btn admin-btn--primary">Replace Credentials</button>
              <button
                type="button"
                onClick={async () => {
                  try {
                    await adminTestIntegration("SHIPROCKET", shiprocket.environment);
                    setMessage("Connection test completed.");
                    load();
                  } catch (e) {
                    setMessage(e.message);
                  }
                }}
                className="admin-btn admin-btn--ghost"
              >
                Test Connection
              </button>
            </div>
          </form>
        </ProviderCard>

        <ProviderCard name="Manual shipping" configured environment={business.environment}>
          <p className="text-sm text-charcoal-soft">
            Manual mode lets admins enter carrier and tracking on each order without a courier API.
          </p>
          <Link to="/admin/shipping" className="admin-btn admin-btn--ghost mt-3 inline-flex">
            Open shipping settings
          </Link>
        </ProviderCard>

        <ProviderCard name="Future providers" configured={false}>
          <p className="text-sm text-charcoal-soft">Delhivery and other carriers can be added when API contracts are available.</p>
          <StatusBadge value="Not available" tone="neutral" className="mt-3" />
        </ProviderCard>
      </div>

      <AdminCard title="Quick shipping defaults">
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
          <div className="sm:col-span-2">
            <button className="admin-btn admin-btn--primary">Save shipping defaults</button>
          </div>
        </form>
      </AdminCard>
    </div>
  );
}
