import express from "express";
import helmet from "helmet";
import cors from "cors";
import cookieParser from "cookie-parser";
import morgan from "morgan";
import { env } from "./config/env.js";
import { apiLimiter } from "./middleware/rateLimiters.js";
import { notFoundHandler, errorHandler } from "./middleware/errorHandler.js";
import { uploadRootDir } from "./modules/uploads/storage.js";
import routes from "./routes/index.js";
import { handleRazorpayWebhook } from "./modules/payments/webhook.controller.js";

export function createApp() {
  const app = express();

  app.disable("x-powered-by");
  app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
  app.use(
    cors({
      origin: env.frontendUrl,
      credentials: true,
    })
  );
  // Razorpay webhook signature verification needs the exact raw request
  // bytes, so this one route is registered with a raw-body parser ahead of
  // the global express.json() below — every other route gets parsed JSON.
  app.post("/api/webhooks/razorpay", express.raw({ type: "application/json", limit: "1mb" }), handleRazorpayWebhook);

  app.use(express.json({ limit: "1mb" }));
  app.use(cookieParser());
  if (!env.isTest) app.use(morgan(env.isProduction ? "combined" : "dev"));

  app.use("/api", apiLimiter);
  app.use("/uploads/products", express.static(uploadRootDir));
  app.use("/api", routes);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
