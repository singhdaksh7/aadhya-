import * as mediaService from "./media.service.js";
import { updateMediaMetadataSchema, listMediaSchema } from "./media.validators.js";

export async function listAdminMedia(req, res, next) {
  try {
    const query = listMediaSchema.parse(req.query);
    const result = await mediaService.listMedia(query);
    res.json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
}

export async function getAdminMedia(req, res, next) {
  try {
    const asset = await mediaService.getMediaById(req.params.id);
    res.json({ success: true, data: asset });
  } catch (err) {
    next(err);
  }
}

export async function uploadAdminMedia(req, res, next) {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: "No file uploaded" });
    }
    const adminId = req.admin ? req.admin.id : null;
    const asset = await mediaService.createMediaAsset(req.file, req.body || {}, adminId);
    res.status(201).json({ success: true, data: asset });
  } catch (err) {
    next(err);
  }
}

export async function updateAdminMediaMetadata(req, res, next) {
  try {
    const validated = updateMediaMetadataSchema.parse(req.body);
    const asset = await mediaService.updateMediaMetadata(req.params.id, validated);
    res.json({ success: true, data: asset });
  } catch (err) {
    next(err);
  }
}

export async function deleteAdminMedia(req, res, next) {
  try {
    const force = req.query.force === "true" || req.body.force === true;
    await mediaService.deleteMediaAsset(req.params.id, { force });
    res.json({ success: true, message: "Media asset deleted successfully" });
  } catch (err) {
    next(err);
  }
}
