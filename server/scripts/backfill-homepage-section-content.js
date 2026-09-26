// Safe, idempotent production backfill for Phase F.1. It only fills settings
// keys that were absent on existing homepage sections.
import { prisma } from "../src/lib/prisma.js";
import { mergeMissingSettings, settingsEqual } from "../src/modules/pages/homepage-content.js";

export async function backfillHomepageSectionContent() {
  const page = await prisma.page.findUnique({ where: { slug: "home" }, include: { sections: true } });
  if (!page) return { updated: 0 };
  const updates = page.sections.filter((section) => !settingsEqual(mergeMissingSettings(section.type, section.settings), section.settings || {}));
  if (updates.length) await prisma.$transaction(updates.map((section) => prisma.pageSection.update({
    where: { id: section.id }, data: { settings: mergeMissingSettings(section.type, section.settings) },
  })));
  return { updated: updates.length };
}

if (process.argv[1]?.endsWith("backfill-homepage-section-content.js")) {
  backfillHomepageSectionContent().then(({ updated }) => {
    console.log(`Homepage content backfill complete: ${updated} section(s) updated.`);
  }).finally(() => prisma.$disconnect());
}
