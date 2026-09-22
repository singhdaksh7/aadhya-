import { z } from "zod";
const password = z.string().min(10, "Password must be at least 10 characters").max(128).regex(/[A-Za-z]/, "Password must contain a letter").regex(/\d/, "Password must contain a number");
const email = z.string().trim().toLowerCase().email();
export const registerSchema = z.object({ name: z.string().trim().min(1).max(120), email, password, phone: z.string().trim().regex(/^[6-9]\d{9}$/).optional() });
export const loginSchema = z.object({ email, password: z.string().min(1).max(128) });
export const profileSchema = z.object({ name: z.string().trim().min(1).max(120), phone: z.string().trim().regex(/^[6-9]\d{9}$/).nullable().optional() });
export const changePasswordSchema = z.object({ currentPassword: z.string().min(1), newPassword: password, confirmPassword: z.string() }).refine(x => x.newPassword === x.confirmPassword, { message: "Passwords do not match", path: ["confirmPassword"] });
export const forgotPasswordSchema = z.object({ email });
export const resetPasswordSchema = z.object({ token: z.string().length(48), newPassword: password, confirmPassword: z.string() }).refine(x => x.newPassword === x.confirmPassword, { message: "Passwords do not match", path: ["confirmPassword"] });
