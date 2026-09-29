import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import ImagePickerInput from "../src/components/admin/ImagePickerInput";

vi.mock("../src/lib/api", () => ({
  resolveProductImageUrl: (url) => (url ? `http://api.test${url}` : null),
  adminUploadMedia: vi.fn(),
}));
vi.mock("../src/components/cms/MediaPicker", () => ({
  default: () => null,
}));
vi.mock("../src/components/admin/ImageCropModal", () => ({
  default: ({ isOpen }) => (isOpen ? <div data-testid="crop-modal" /> : null),
}));

describe("ImagePickerInput", () => {
  it("shows Upload / Choose from Media and no Crop/Remove when empty", () => {
    render(<ImagePickerInput label="Logo" value="" onChange={vi.fn()} enableCrop aspect={1} />);
    expect(screen.getByText("Upload / Choose from Media")).toBeInTheDocument();
    expect(screen.queryByText("Crop / Adjust")).not.toBeInTheDocument();
    expect(screen.queryByText("Remove")).not.toBeInTheDocument();
  });

  it("shows Change, Crop / Adjust, and Remove when a value is set and cropping is enabled", () => {
    render(<ImagePickerInput label="Logo" value="/uploads/products/logo.png" onChange={vi.fn()} enableCrop aspect={1} />);
    expect(screen.getByText("Change")).toBeInTheDocument();
    expect(screen.getByText("Crop / Adjust")).toBeInTheDocument();
    expect(screen.getByText("Remove")).toBeInTheDocument();
  });

  it("does not show a Crop button when the field has not opted into cropping", () => {
    render(<ImagePickerInput label="Legacy field" value="/uploads/products/logo.png" onChange={vi.fn()} />);
    expect(screen.queryByText("Crop / Adjust")).not.toBeInTheDocument();
  });

  it("calls onChange('') when Remove is clicked", () => {
    const onChange = vi.fn();
    render(<ImagePickerInput label="Logo" value="/uploads/products/logo.png" onChange={onChange} />);
    screen.getByText("Remove").click();
    expect(onChange).toHaveBeenCalledWith("");
  });
});
