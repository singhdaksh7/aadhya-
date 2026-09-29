import { z } from "zod";

export const createReturnRequestSchema = z.object({
  orderNumber: z.string().min(1),
  reason: z.string().min(3).max(500),
  details: z.string().max(2000).optional(),
  items: z
    .array(
      z.object({
        orderItemId: z.string().min(1),
        quantity: z.coerce.number().int().min(1),
      })
    )
    .min(1),
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
