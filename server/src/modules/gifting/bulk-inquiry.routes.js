import { Router } from "express";
import rateLimit from "express-rate-limit";
import { requireAdmin } from "../../middleware/adminAuth.js";
import {
  createBulkGiftingInquiry,
  listBulkGiftingInquiries,
  getBulkGiftingInquiry,
  updateBulkGiftingInquiry,
} from "./bulk-inquiry.service.js";

const skipInTest = () => process.env.NODE_ENV === "test";

export const bulkInquiryLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: {
      code: "RATE_LIMITED",
      message: "Too many inquiries submitted from this IP. Please try again later.",
    },
  },
  skip: skipInTest,
});

export const publicBulkInquiryRouter = Router();

// Public: Submit a bulk gifting inquiry
publicBulkInquiryRouter.post("/gifting/bulk-inquiry", bulkInquiryLimiter, async (req, res, next) => {
  try {
    const inquiry = await createBulkGiftingInquiry(req.body);
    return res.status(201).json({
      success: true,
      message: "Your gifting enquiry has been received. Our team will contact you shortly.",
      data: inquiry,
    });
  } catch (err) {
    if (err.name === "ZodError") {
      return res.status(400).json({
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: err.errors?.[0]?.message || "Invalid input",
          details: err.errors,
        },
      });
    }
    next(err);
  }
});

export const adminBulkInquiryRouter = Router();

// Admin: List inquiries with search and status filter
adminBulkInquiryRouter.get("/gifting/bulk-inquiries", requireAdmin, async (req, res, next) => {
  try {
    const result = await listBulkGiftingInquiries(req.query);
    return res.json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
});

// Admin: Get single inquiry
adminBulkInquiryRouter.get("/gifting/bulk-inquiries/:id", requireAdmin, async (req, res, next) => {
  try {
    const inquiry = await getBulkGiftingInquiry(req.params.id);
    if (!inquiry) {
      return res.status(404).json({ success: false, error: { message: "Inquiry not found" } });
    }
    return res.json({ success: true, data: inquiry });
  } catch (err) {
    next(err);
  }
});

// Admin: Update status / internal notes
adminBulkInquiryRouter.patch("/gifting/bulk-inquiries/:id", requireAdmin, async (req, res, next) => {
  try {
    const updated = await updateBulkGiftingInquiry(req.params.id, req.body);
    return res.json({ success: true, data: updated });
  } catch (err) {
    next(err);
  }
});
