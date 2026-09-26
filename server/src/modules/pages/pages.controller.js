import * as pagesService from "./pages.service.js";

export async function handleGetPublicHomepage(req, res, next) {
  try {
    const data = await pagesService.getPublicHomepage();
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function handleGetAdminHomepage(req, res, next) {
  try {
    const data = await pagesService.getAdminHomepage();
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function handleCreateSection(req, res, next) {
  try {
    const { pageId } = req.params;
    const section = await pagesService.createPageSection(pageId, req.body);
    res.status(201).json({ success: true, data: section });
  } catch (err) {
    next(err);
  }
}

export async function handleUpdateSection(req, res, next) {
  try {
    const { sectionId } = req.params;
    const section = await pagesService.updatePageSection(sectionId, req.body);
    res.json({ success: true, data: section });
  } catch (err) {
    next(err);
  }
}

export async function handleDeleteSection(req, res, next) {
  try {
    const { sectionId } = req.params;
    await pagesService.deletePageSection(sectionId);
    res.json({ success: true, message: "Section deleted" });
  } catch (err) {
    next(err);
  }
}

export async function handleDuplicateSection(req, res, next) {
  try {
    const { sectionId } = req.params;
    const section = await pagesService.duplicatePageSection(sectionId);
    res.status(201).json({ success: true, data: section });
  } catch (err) {
    next(err);
  }
}

export async function handleReorderSections(req, res, next) {
  try {
    const { pageId } = req.params;
    const { sectionIds } = req.body;
    const sections = await pagesService.reorderPageSections(pageId, sectionIds);
    res.json({ success: true, data: sections });
  } catch (err) {
    next(err);
  }
}

export async function handlePublishHomepage(req, res, next) {
  try {
    const { pageId } = req.params;
    const page = await pagesService.publishHomepage(pageId);
    res.json({ success: true, data: page });
  } catch (err) {
    next(err);
  }
}
