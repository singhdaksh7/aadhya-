import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { recommendedImageSize } from "../src/lib/imageSizeGuide";

vi.mock("../src/lib/api", () => ({ resolveProductImageUrl: (u) => u, adminUploadMedia: vi.fn() }));
vi.mock("../src/components/cms/MediaPicker", () => ({ default: () => null }));
vi.mock("../src/components/admin/ImageCropModal", () => ({ default: () => null }));
const ImagePickerInput = (await import("../src/components/admin/ImagePickerInput")).default;

describe("admin image size guidance", () => {
  it("maps field labels to recommended sizes", () => {
    expect(recommendedImageSize("Category Image")).toMatch(/1080 × 1080/);
    expect(recommendedImageSize("Desktop Image *")).toMatch(/1920 × 700/);
    expect(recommendedImageSize("Mobile Banner")).toMatch(/1080 × 1350/);
    expect(recommendedImageSize("OG Image")).toMatch(/1200 × 630/);
    expect(recommendedImageSize("Desktop Store Logo")).toMatch(/500 × 150/);
  });
  it("shows the hint on every picker and honors an override", () => {
    const { rerender } = render(<ImagePickerInput label="Category Image" value="" onChange={() => {}} />);
    expect(screen.getByTestId("image-size-hint").textContent).toMatch(/Recommended size: 1080 × 1080 px/);
    rerender(<ImagePickerInput label="Category Image" sizeHint="640 × 640 px" value="" onChange={() => {}} />);
    expect(screen.getByTestId("image-size-hint").textContent).toMatch(/640 × 640/);
  });
});
