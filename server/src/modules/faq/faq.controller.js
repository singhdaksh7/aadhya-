import * as faqService from "./faq.service.js";
import {
  createFaqCategorySchema,
  updateFaqCategorySchema,
  createFaqItemSchema,
  updateFaqItemSchema,
  reorderSchema
} from "./faq.validators.js";

export async function getPublicFaqs(req, res, next) {
  try {
    const categories = await faqService.getPublicFaqs(req.query);
    res.json({ success: true, data: categories });
  } catch (err) {
    next(err);
  }
}

// Admin Category Handlers
export async function listAdminCategories(req, res, next) {
  try {
    const categories = await faqService.listFaqCategories();
    res.json({ success: true, data: categories });
  } catch (err) {
    next(err);
  }
}

export async function createAdminCategory(req, res, next) {
  try {
    const validated = createFaqCategorySchema.parse(req.body);
    const category = await faqService.createFaqCategory(validated);
    res.status(201).json({ success: true, data: category });
  } catch (err) {
    next(err);
  }
}

export async function updateAdminCategory(req, res, next) {
  try {
    const validated = updateFaqCategorySchema.parse(req.body);
    const category = await faqService.updateFaqCategory(req.params.id, validated);
    res.json({ success: true, data: category });
  } catch (err) {
    next(err);
  }
}

export async function deleteAdminCategory(req, res, next) {
  try {
    await faqService.deleteFaqCategory(req.params.id);
    res.json({ success: true, message: "FAQ category deleted successfully" });
  } catch (err) {
    next(err);
  }
}

export async function reorderAdminCategories(req, res, next) {
  try {
    const validated = reorderSchema.parse(req.body);
    await faqService.reorderFaqCategories(validated.items);
    res.json({ success: true, message: "Categories reordered successfully" });
  } catch (err) {
    next(err);
  }
}

// Admin Item Handlers
export async function listAdminItems(req, res, next) {
  try {
    const items = await faqService.listFaqItems(req.query);
    res.json({ success: true, data: items });
  } catch (err) {
    next(err);
  }
}

export async function createAdminItem(req, res, next) {
  try {
    const validated = createFaqItemSchema.parse(req.body);
    const item = await faqService.createFaqItem(validated);
    res.status(201).json({ success: true, data: item });
  } catch (err) {
    next(err);
  }
}

export async function updateAdminItem(req, res, next) {
  try {
    const validated = updateFaqItemSchema.parse(req.body);
    const item = await faqService.updateFaqItem(req.params.id, validated);
    res.json({ success: true, data: item });
  } catch (err) {
    next(err);
  }
}

export async function deleteAdminItem(req, res, next) {
  try {
    await faqService.deleteFaqItem(req.params.id);
    res.json({ success: true, message: "FAQ item deleted successfully" });
  } catch (err) {
    next(err);
  }
}

export async function reorderAdminItems(req, res, next) {
  try {
    const validated = reorderSchema.parse(req.body);
    await faqService.reorderFaqItems(validated.items);
    res.json({ success: true, message: "FAQ items reordered successfully" });
  } catch (err) {
    next(err);
  }
}
