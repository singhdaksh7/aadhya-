import fs from "node:fs/promises";
import { createReadStream } from "node:fs";
import path from "node:path";

const ROOT = path.resolve(process.env.PRIVATE_INVOICE_DIR || "private/invoices");

function safeKey(key) {
  if (!/^[A-Za-z0-9._-]+\.pdf$/.test(key || "")) throw new Error("Invalid invoice storage key");
  return key;
}

export async function writeInvoicePdf(key, data) {
  const filename = safeKey(key);
  await fs.mkdir(ROOT, { recursive: true });
  await fs.writeFile(path.join(ROOT, filename), data, { mode: 0o600 });
  return filename;
}

export async function readInvoicePdf(key) {
  const filename = safeKey(key);
  const file = path.join(ROOT, filename);
  const stat = await fs.stat(file).catch(() => null);
  return stat?.isFile() ? { stream: createReadStream(file), size: stat.size } : null;
}
