import { describe, it, expect } from "vitest";
import { settingsValidationSchema } from "../src/modules/settings/settings.routes.js";

// DB-free contract tests for the category strip + ALL_CATEGORIES mega menu settings.
describe("category strip + ALL_CATEGORIES contract", () => {
  const strip = (circularCategories) => settingsValidationSchema.safeParse({ header: { circularCategories } });

  it("accepts every shape and the full strip configuration without stripping anything", () => {
    for (const shape of ["CIRCLE", "SQUARE", "ROUNDED_SQUARE", "RECTANGLE"]) {
      expect(strip({ shape }).success).toBe(true);
    }
    const full = {
      enabled: true,
      shape: "RECTANGLE",
      mode: "MANUAL",
      sortBy: "NAME",
      rootOnly: false,
      categoryDepth: "ALL",
      maxItems: 8,
      showDesktop: true,
      showMobile: false,
      desktopSize: "large",
      mobileSize: "small",
      imageFit: "contain",
      showLabels: true,
      showArrows: false,
      showPartialNextMobile: true,
      spacingDensity: "compact",
      backgroundMode: "soft",
      showTopSeparator: true,
      showBottomSeparator: false,
      showDividers: true,
      items: [
        {
          id: "s1",
          categoryId: "c1",
          slug: "books",
          enabled: true,
          displayLabelOverride: "Reads",
          imageOverride: "/uploads/a.jpg",
          mobileImageOverride: "/uploads/b.jpg",
          badgeText: "NEW",
          destinationOverride: "/books",
        },
      ],
    };
    const res = strip(full);
    expect(res.success).toBe(true);
    expect(res.data.header.circularCategories).toEqual(full);
  });

  it("rejects bad shapes, sizes and unsafe strip URLs", () => {
    expect(strip({ shape: "TRIANGLE" }).success).toBe(false);
    expect(strip({ desktopSize: "huge" }).success).toBe(false);
    expect(strip({ imageFit: "stretch" }).success).toBe(false);
    expect(strip({ items: [{ enabled: true, imageOverride: "javascript:alert(1)" }] }).success).toBe(false);
    expect(strip({ items: [{ enabled: true, mobileImageOverride: "javascript:alert(1)" }] }).success).toBe(false);
    expect(strip({ items: [{ enabled: true, destinationOverride: "data:text/html,x" }] }).success).toBe(false);
    expect(strip({ items: Array.from({ length: 25 }, () => ({ enabled: true })) }).success).toBe(false);
  });

  it("accepts ALL_CATEGORIES nav config and rejects an invalid scope", () => {
    const nav = (extra) =>
      settingsValidationSchema.safeParse({
        header: { primaryNav: { items: [{ id: "n", label: "Books", enabled: true, megaMenuMode: "ALL_CATEGORIES", ...extra }] } },
      });
    const ok = nav({ megaCategoryScope: "PARENTS", megaParentIds: ["a"], megaExcludedCategoryIds: ["b"], megaMaxCategories: 12 });
    expect(ok.success).toBe(true);
    expect(ok.data.header.primaryNav.items[0]).toMatchObject({
      megaCategoryScope: "PARENTS",
      megaParentIds: ["a"],
      megaExcludedCategoryIds: ["b"],
      megaMaxCategories: 12,
    });
    expect(nav({ megaCategoryScope: "EVERYTHING" }).success).toBe(false);
    expect(nav({ megaMaxCategories: 0 }).success).toBe(false);
  });
});
