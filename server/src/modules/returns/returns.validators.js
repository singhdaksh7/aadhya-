import { z } from "zod";

export const createReturnRequestSchema = z.object({
  orderNumber: z.string().trim().min(1, "Order number is required."),
  // .trim() runs before the length checks below, so a whitespace-only or
  // whitespace-padded reason is validated (and stored) by its trimmed
  // length/content — the frontend also trims, but this is the authoritative
  // check, since nothing here should trust client-side trimming alone.
  reason: z
    .string()
    .trim()
    .min(3, "Return reason must be at least 3 characters.")
    .max(500, "Return reason cannot exceed 500 characters."),
  details: z
    .string()
    .trim()
    .max(2000, "Additional details cannot exceed 2000 characters.")
    .optional()
    .transform((v) => (v ? v : undefined)),
  items: z
    .array(
      z.object({
        orderItemId: z.string().min(1, "Item is required."),
        quantity: z.coerce.number().int("Quantity must be a whole number.").min(1, "Quantity must be at least 1."),
      })
    )
    .min(1, "Select at least one item to return."),
});

export const rejectReturnSchema = z.object({
  note: z.string().max(1000).optional(),
});

export const schedulePickupSchema = z.object({
  note: z.string().max(1000).optional(),
});

export const issueRefundSchema = z.object({
  amount: z.coerce.number().positive(),
  method: z.enum(["razorpay", "manual"]),
  reference: z.string().max(200).optional(),
  note: z.string().max(1000).optional(),
});
