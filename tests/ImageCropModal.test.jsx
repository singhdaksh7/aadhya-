import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import ImageCropModal, { CROP_ASPECT_PRESETS } from "../src/components/admin/ImageCropModal";

// react-easy-crop needs real image layout/measurement to compute crop
// geometry, which jsdom doesn't provide. Stub it with a minimal control that
// still exercises the modal's own confirm/cancel/reset wiring, and fires
// onCropComplete exactly once (via an effect, not during render — calling a
// state-setting callback unconditionally in the render body would trigger an
// infinite render loop) so a "confirm" flow can be tested end to end.
vi.mock("react-easy-crop", () => ({
  default: function MockCropper({ onCropComplete }) {
    React.useEffect(() => {
      onCropComplete({}, { x: 0, y: 0, width: 100, height: 100 });
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    return <div data-testid="mock-cropper" />;
  },
}));

describe("ImageCropModal", () => {
  beforeEach(() => {
    // jsdom has no real canvas 2D context; stub just enough for the crop
    // pipeline to produce a blob synchronously.
    HTMLCanvasElement.prototype.getContext = vi.fn(() => ({ drawImage: vi.fn() }));
    HTMLCanvasElement.prototype.toBlob = vi.fn(function (cb) {
      cb(new Blob(["fake-image-bytes"], { type: "image/png" }));
    });
    global.Image = class {
      addEventListener(event, handler) {
        if (event === "load") this._onLoad = handler;
      }
      removeEventListener() {}
      set src(_v) {
        this._onLoad && this._onLoad();
      }
    };
  });

  it("renders nothing when closed", () => {
    const { container } = render(
      <ImageCropModal isOpen={false} imageSrc="http://api.test/uploads/x.png" onCancel={vi.fn()} onConfirm={vi.fn()} />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("calls onCancel when Cancel is clicked", () => {
    const onCancel = vi.fn();
    render(<ImageCropModal isOpen imageSrc="http://api.test/uploads/x.png" onCancel={onCancel} onConfirm={vi.fn()} />);
    fireEvent.click(screen.getByText("Cancel"));
    expect(onCancel).toHaveBeenCalled();
  });

  it("calls onConfirm with a cropped image blob when Confirm Crop is clicked", async () => {
    const onConfirm = vi.fn(() => Promise.resolve());
    render(<ImageCropModal isOpen imageSrc="http://api.test/uploads/x.png" onCancel={vi.fn()} onConfirm={onConfirm} />);

    fireEvent.click(screen.getByText("Confirm Crop"));

    await waitFor(() => expect(onConfirm).toHaveBeenCalledTimes(1));
    const blobArg = onConfirm.mock.calls[0][0];
    expect(blobArg).toBeInstanceOf(Blob);
  });

  it("resets zoom/crop position when Reset is clicked", () => {
    render(<ImageCropModal isOpen imageSrc="http://api.test/uploads/x.png" onCancel={vi.fn()} onConfirm={vi.fn()} />);
    const zoomSlider = screen.getByLabelText("Zoom");
    fireEvent.change(zoomSlider, { target: { value: "2" } });
    expect(zoomSlider.value).toBe("2");
    fireEvent.click(screen.getByText("Reset"));
    expect(zoomSlider.value).toBe("1");
  });

  it("shows aspect ratio presets when aspectOptions has more than one entry", () => {
    render(
      <ImageCropModal
        isOpen
        imageSrc="http://api.test/uploads/x.png"
        aspectOptions={["free", "wide", "square"]}
        onCancel={vi.fn()}
        onConfirm={vi.fn()}
      />
    );
    expect(screen.getByText("Free")).toBeInTheDocument();
    expect(screen.getByText("Wide (16:9)")).toBeInTheDocument();
    expect(screen.getByText("Square (1:1)")).toBeInTheDocument();
  });

  it("defines a dedicated 5:1 Header Logo preset for cropping just the main wordmark", () => {
    expect(CROP_ASPECT_PRESETS.header).toBeDefined();
    expect(CROP_ASPECT_PRESETS.header.value).toBe(5);
    expect(CROP_ASPECT_PRESETS.header.label).toMatch(/Header Logo/);
  });

  it("shows the Header Logo preset button when aspectOptions includes it, alongside other presets", () => {
    render(
      <ImageCropModal
        isOpen
        imageSrc="http://api.test/uploads/x.png"
        aspectOptions={["header", "free", "wide", "square"]}
        onCancel={vi.fn()}
        onConfirm={vi.fn()}
      />
    );
    expect(screen.getByText("Header Logo (5:1)")).toBeInTheDocument();
  });

  it("does not force a single crop ratio for every image — favicon can use a locked 1:1 while logos use 5:1", () => {
    const { unmount } = render(
      <ImageCropModal isOpen imageSrc="http://api.test/uploads/x.png" aspect={1} onCancel={vi.fn()} onConfirm={vi.fn()} />
    );
    // No preset switcher shown for a single fixed aspect (favicon usage).
    expect(screen.queryByText("Square (1:1)")).not.toBeInTheDocument();
    unmount();

    render(
      <ImageCropModal isOpen imageSrc="http://api.test/uploads/x.png" aspect={5 / 1} aspectOptions={["header", "free"]} onCancel={vi.fn()} onConfirm={vi.fn()} />
    );
    expect(screen.getByText("Header Logo (5:1)")).toBeInTheDocument();
  });
});
