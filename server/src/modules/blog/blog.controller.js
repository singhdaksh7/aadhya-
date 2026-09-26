import * as blogService from "./blog.service.js";
import { createBlogPostSchema, updateBlogPostSchema } from "./blog.validators.js";

export async function listPublicBlogPosts(req, res, next) {
  try {
    const result = await blogService.listPublicBlogPosts(req.query);
    res.json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
}

export async function getPublicBlogPost(req, res, next) {
  try {
    const allowDraft = req.query.preview === "true" && Boolean(req.adminUser);
    const post = await blogService.getPublicBlogPostBySlug(req.params.slug, { allowDraft });
    res.json({ success: true, data: post });
  } catch (err) {
    next(err);
  }
}

export async function listAdminBlogPosts(req, res, next) {
  try {
    const result = await blogService.listAdminBlogPosts(req.query);
    res.json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
}

export async function getAdminBlogPost(req, res, next) {
  try {
    const post = await blogService.getBlogPostById(req.params.id);
    res.json({ success: true, data: post });
  } catch (err) {
    next(err);
  }
}

export async function createAdminBlogPost(req, res, next) {
  try {
    const validated = createBlogPostSchema.parse(req.body);
    const post = await blogService.createBlogPost(validated);
    res.status(201).json({ success: true, data: post });
  } catch (err) {
    next(err);
  }
}

export async function updateAdminBlogPost(req, res, next) {
  try {
    const validated = updateBlogPostSchema.parse(req.body);
    const post = await blogService.updateBlogPost(req.params.id, validated);
    res.json({ success: true, data: post });
  } catch (err) {
    next(err);
  }
}

export async function deleteAdminBlogPost(req, res, next) {
  try {
    await blogService.deleteBlogPost(req.params.id);
    res.json({ success: true, message: "Blog post deleted successfully" });
  } catch (err) {
    next(err);
  }
}

export async function publishAdminBlogPost(req, res, next) {
  try {
    const post = await blogService.togglePublishBlogPost(req.params.id, req.body || {});
    res.json({ success: true, data: post });
  } catch (err) {
    next(err);
  }
}
