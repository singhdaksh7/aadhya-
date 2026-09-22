import { env } from "../config/env.js";
import { ZodError } from "zod";
import multer from "multer";

export function notFoundHandler(req, res) {
  res.status(404).json({ success: false, error: { message: "Route not found" } });
}

// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, next) {
  if (err instanceof ZodError) {
    return res.status(400).json({
      success: false,
      error: {
        message: "Validation failed",
        details: err.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
      },
    });
  }

  if (err instanceof multer.MulterError) {
    return res.status(400).json({ success: false, error: { message: err.message } });
  }

  const statusCode = err.isApiError ? err.statusCode : err.statusCode || 500;
  const message = statusCode < 500 ? err.message : "Internal server error";

  if (statusCode >= 500) {
    // eslint-disable-next-line no-console
    console.error(err);
  }

  res.status(statusCode).json({
    success: false,
    error: {
      message,
      details: err.isApiError ? err.details : undefined,
      stack: env.isProduction ? undefined : err.stack,
    },
  });
}
