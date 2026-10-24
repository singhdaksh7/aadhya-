import { createApp } from "./app.js";
import { env } from "./config/env.js";
import { retryDueNotifications } from "./modules/mailer/mailer.service.js";

const app = createApp();

app.listen(env.port, () => {
  // eslint-disable-next-line no-console
  console.log(`Tushaqsa commerce API listening on http://localhost:${env.port}`);
});

// Bounded retry of customer emails that failed (SMTP down, wrong password fixed later, ...). Each failed
// notification is retried at most MAX_AUTOMATIC_ATTEMPTS times in total, with growing delays; an Admin
// can retry one by hand from the email log. Skipped in tests, and never allowed to crash the process.
if (!env.isTest) {
  const timer = setInterval(() => {
    retryDueNotifications().catch((err) => console.error("[notify] retry sweep failed:", err.message));
  }, 5 * 60 * 1000);
  timer.unref?.();
}
