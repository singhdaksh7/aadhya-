import { z } from "zod";

// Cashfree order ids are 3-45 chars of letters, digits, underscore and hyphen.
export const verifyPaymentSchema = z.object({
  cashfreeOrderId: z.string().trim().min(3).max(45).regex(/^[A-Za-z0-9_-]+$/),
});
