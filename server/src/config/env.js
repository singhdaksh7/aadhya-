import "dotenv/config";

function required(name, fallback) {
  const value = process.env[name] ?? fallback;
  if (value === undefined) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export const env = {
  nodeEnv: process.env.NODE_ENV || "development",
  isProduction: process.env.NODE_ENV === "production",
  isTest: process.env.NODE_ENV === "test",
  port: Number(process.env.PORT || 4000),
  frontendUrl: process.env.FRONTEND_URL || "http://localhost:5173",
  databaseUrl: required("DATABASE_URL"),
  jwt: {
    accessSecret: required("JWT_ACCESS_SECRET"),
    refreshSecret: required("JWT_REFRESH_SECRET"),
    accessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN || "15m",
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || "7d",
  },
  admin: {
    name: process.env.ADMIN_NAME,
    email: process.env.ADMIN_EMAIL,
    password: process.env.ADMIN_PASSWORD,
  },
  uploads: {
    dir: process.env.UPLOAD_DIR || "uploads/products",
    maxFileSizeMb: Number(process.env.UPLOAD_MAX_FILE_SIZE_MB || 5),
  },
  storage: {
    driver: process.env.STORAGE_DRIVER || "local",
    endpoint: process.env.S3_ENDPOINT || "",
    region: process.env.S3_REGION || "",
    bucket: process.env.S3_BUCKET || "",
    accessKeyId: process.env.S3_ACCESS_KEY_ID || "",
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY || "",
    publicBaseUrl: process.env.S3_PUBLIC_BASE_URL || "",
  },
  shipping: {
    // Rupees. Flat-rate rule for this phase — see orders/shipping.js.
    freeThreshold: Number(process.env.FREE_SHIPPING_THRESHOLD ?? 2000),
    standardAmount: Number(process.env.STANDARD_SHIPPING_AMOUNT ?? 99),
  },
  razorpay: {
    keyId: process.env.RAZORPAY_KEY_ID || "",
    keySecret: process.env.RAZORPAY_KEY_SECRET || "",
    webhookSecret: process.env.RAZORPAY_WEBHOOK_SECRET || "",
    get isConfigured() {
      return Boolean(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET);
    },
  },
  smtp: {
    host: process.env.SMTP_HOST || "",
    port: Number(process.env.SMTP_PORT || 587),
    user: process.env.SMTP_USER || "",
    pass: process.env.SMTP_PASS || "",
    from: process.env.SMTP_FROM || "Aadya Society <no-reply@aadyasociety.example>",
    get isConfigured() {
      return Boolean(process.env.SMTP_HOST);
    },
  },
};
