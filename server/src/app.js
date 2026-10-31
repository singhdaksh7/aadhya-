import express from "express";
import helmet from "helmet";
import cors from "cors";
import cookieParser from "cookie-parser";
import morgan from "morgan";
import { env } from "./config/env.js";
import { apiLimiter, publicReadLimiter, adminApiLimiter } from "./middleware/rateLimiters.js";
import { notFoundHandler, errorHandler } from "./middleware/errorHandler.js";
import { uploadRootDir } from "./modules/uploads/storage.js";
import routes from "./routes/index.js";
import { handleCashfreeWebhook } from "./modules/payments/webhook.controller.js";
import { handleShipmentStatusWebhook } from "./modules/shipping/shipment-status.webhook.js";
import { handleShippingWebhook } from "./modules/shipping/webhook.controller.js";

export function createApp() {
  const app = express();

  app.disable("x-powered-by");
  if (env.trustProxy > 0) app.set("trust proxy", env.trustProxy);
  app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
  app.use(
    cors({
      origin: env.corsOrigins,
      credentials: true,
    })
  );
  // Cashfree webhook signature verification needs the exact raw request
  // bytes, so this one route is registered with a raw-body parser ahead of
  // the global express.json() below — every other route gets parsed JSON.
  app.post("/api/webhooks/cashfree", express.raw({ type: "application/json", limit: "1mb" }), handleCashfreeWebhook);
  // Courier tracking updates (neutral path: Shiprocket rejects URLs containing its own name or "sr"/"kr").
  app.post("/api/webhooks/shipment-status", express.raw({ type: "*/*", limit: "1mb" }), handleShipmentStatusWebhook);
  app.post("/api/webhooks/shipping/:provider", express.raw({ type: "application/json", limit: "1mb" }), handleShippingWebhook);

  app.use(express.json({ limit: "1mb" }));
  app.use(cookieParser());
  if (!env.isTest) app.use(morgan(env.isProduction ? "combined" : "dev"));

  app.use("/api", publicReadLimiter, adminApiLimiter, apiLimiter);
  // Upload filenames are random UUIDs and files are never rewritten in place, so a URL's content
// never changes: let browsers/CDNs keep them for 30 days instead of revalidating every view.
  app.use("/uploads/products", express.static(uploadRootDir, { maxAge: "30d", immutable: true }));
  app.use("/api", routes);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
