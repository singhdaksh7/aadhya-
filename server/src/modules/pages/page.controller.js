import * as pageService from "./page.service.js";
import { createPageSchema, updatePageSchema } from "./page.validators.js";

export async function getPublicPage(req, res, next) {
  try {
    const allowDraft = req.query.preview === "true" && Boolean(req.adminUser);
    const page = await pageService.getPageBySlug(req.params.slug, { allowDraft });
    res.json({ success: true, data: page });
  } catch (err) {
    next(err);
  }
}

export async function listAdminPages(req, res, next) {
  try {
    const result = await pageService.listPages(req.query);
    res.json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
}

export async function getAdminPage(req, res, next) {
  try {
    const page = await pageService.getPageById(req.params.id);
    res.json({ success: true, data: page });
  } catch (err) {
    next(err);
  }
}

export async function createAdminPage(req, res, next) {
  try {
    const validated = createPageSchema.parse(req.body);
    const page = await pageService.createPage(validated);
    res.status(201).json({ success: true, data: page });
  } catch (err) {
    next(err);
  }
}

export async function updateAdminPage(req, res, next) {
  try {
    const validated = updatePageSchema.parse(req.body);
    const page = await pageService.updatePage(req.params.id, validated);
    res.json({ success: true, data: page });
  } catch (err) {
    next(err);
  }
}

export async function deleteAdminPage(req, res, next) {
  try {
    await pageService.deletePage(req.params.id);
    res.json({ success: true, message: "Page deleted successfully" });
  } catch (err) {
    next(err);
  }
}

export async function publishAdminPage(req, res, next) {
  try {
    const page = await pageService.togglePublishPage(req.params.id, req.body || {});
    res.json({ success: true, data: page });
  } catch (err) {
    next(err);
  }
}
