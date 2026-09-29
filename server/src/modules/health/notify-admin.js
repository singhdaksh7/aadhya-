// Thin wrapper used by the ops/monitoring code in this module so it never
// has a hard dependency on the admin-notifications module existing. If the
// real service (built by a parallel workstream) is present, we create a
// real AdminNotification row; otherwise we just log clearly.
//
// notifyAdmin({ type, title, message, severity, entityType, entityId })
export async function notifyAdmin({ type, title, message, severity = "WARNING", entityType, entityId }) {
  try {
    const mod = await import("../admin-notifications/admin-notification.service.js");
    if (mod?.createAdminNotification) {
      return await mod.createAdminNotification({ type, title, message, severity, entityType, entityId });
    }
  } catch {
    // Service not available yet — fall through to logging below.
  }
  // eslint-disable-next-line no-console
  console.error(`[admin-notify:${severity}] ${type} — ${title}: ${message}`);
  return null;
}
