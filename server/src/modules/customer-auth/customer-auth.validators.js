import { z } from "zod";

const password = z.string().min(10, "Password must be at least 10 characters").max(128).regex(/[A-Za-z]/, "Password must contain a letter").regex(/\d/, "Password must contain a number");
const email = z.string().trim().toLowerCase().email();
export function normalizeIndianPhone(value) {
  if (typeof value !== "string") return value;
  const compact = value.trim().replace(/[\s-]/g, "");
  if (compact.startsWith("+91")) return compact.slice(3);
  if (compact.startsWith("91") && compact.length === 12) return compact.slice(2);
  return compact;
}
const phone = z.preprocess(normalizeIndianPhone, z.string().regex(/^[6-9]\d{9}$/, "Enter a valid 10-digit Indian mobile number"));
const optionalPhone = z.preprocess((value) => typeof value === "string" && value.trim() === "" ? undefined : normalizeIndianPhone(value), phone.optional());
export const registerSchema = z.object({ name: z.string().trim().min(1).max(120), email, password, phone: optionalPhone });
export const loginSchema = z.object({ email, password: z.string().min(1).max(128) });
export const profileSchema = z.object({ name: z.string().trim().min(1).max(120), phone: z.preprocess((value) => value === null ? null : normalizeIndianPhone(value), phone.nullable().optional()) });
export const changePasswordSchema = z.object({ currentPassword: z.string().min(1), newPassword: password, confirmPassword: z.string() }).refine(x => x.newPassword === x.confirmPassword, { message: "Passwords do not match", path: ["confirmPassword"] });
export const forgotPasswordSchema = z.object({ email });
export const resetPasswordSchema = z.object({ token: z.string().length(48), newPassword: password, confirmPassword: z.string() }).refine(x => x.newPassword === x.confirmPassword, { message: "Passwords do not match", path: ["confirmPassword"] });
