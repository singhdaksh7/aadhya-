import { z } from "zod";

export const zoneSchema = z.object({
  name: z.string().trim().min(1).max(120),
  states: z.array(z.string().trim().min(1).max(100)).default([]),
  postalCodes: z.array(z.string().trim().min(1).max(20)).optional().default([]),
  codSupported: z.boolean().optional().default(true),
  active: z.boolean().optional().default(true),
});

export const zoneUpdateSchema = zoneSchema.partial();

export const rateSchema = z.object({
  rate: z.number().nonnegative().max(100000),
  freeAbove: z.number().nonnegative().max(1000000).optional().nullable(),
  deliveryEstimate: z.string().trim().max(100).optional().nullable(),
  active: z.boolean().optional().default(true),
});

export const rateUpdateSchema = rateSchema.partial();
