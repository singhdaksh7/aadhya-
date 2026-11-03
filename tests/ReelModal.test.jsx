import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import ShoppableReels from "../src/components/ShoppableReels";

const reel = (id, over = {}) => ({
  id,
  title: `Reel ${id}`,
  videoUrl: `/v/${id}.mp4`,
  coverImage: `/c/${id}.jpg`,
  ctaLabel: "Shop Look",
  products: [{ id: `p-${id}`, name: `Product ${id}`, slug: `prod-${id}`, price: 1500, image: `/p/${id}.jpg` }],
  categories: [],
  ...over,
});

const section = (reels, settings = {}) => ({
  id: "s",
  type: "SHOPPABLE_REELS",
  settings: { title: "Shop Our Reels", reels, ...settings },
});

let playSpy, pauseSpy;

beforeEach(() => {
  playSpy = vi.spyOn(HTMLMediaElement.prototype, "play").mockImplementation(() => Promise.resolve());
  pauseSpy = vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => {});
  window.matchMedia = vi.fn(() => ({ matches: false, addEventListener() {}, removeEventListener() {} }));
});

afterEach(() => {
  vi.restoreAllMocks();
  document.body.style.overflow = "";
});

describe("ReelModal — Large playable popup", () => {
  it("clicking a reel card opens the large modal dialog with the selected reel video", () => {
    render(
      <MemoryRouter>
        <ShoppableReels section={section([reel("1"), reel("2")])} />
      </MemoryRouter>
    );

    expect(screen.queryByTestId("reel-modal")).toBeNull();

    // Click on the reel card
    const cards = screen.getAllByTestId("reel-card");
    fireEvent.click(cards[0]);

    const modal = screen.getByTestId("reel-modal");
    expect(modal).toBeInTheDocument();
    expect(modal).toHaveAttribute("role", "dialog");
    expect(modal).toHaveAttribute("aria-modal", "true");
    expect(within(modal).getByText("Reel 1")).toBeInTheDocument();

    const modalVideo = screen.getByTestId("reel-modal-video");
    expect(modalVideo).toBeInTheDocument();
    expect(modalVideo).toHaveAttribute("src", expect.stringContaining("/v/1.mp4"));
  });

  it("locks body scroll when modal is open and restores it when closed", () => {
    render(
      <MemoryRouter>
        <ShoppableReels section={section([reel("1")])} />
      </MemoryRouter>
    );

    expect(document.body.style.overflow).toBe("");

    fireEvent.click(screen.getByTestId("reel-card"));
    expect(document.body.style.overflow).toBe("hidden");

    // Click close button
    fireEvent.click(screen.getByTestId("reel-modal-close"));
    expect(screen.queryByTestId("reel-modal")).toBeNull();
    expect(document.body.style.overflow).toBe("");
  });

  it("closes modal on Escape key press", () => {
    render(
      <MemoryRouter>
        <ShoppableReels section={section([reel("1")])} />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByTestId("reel-card"));
    expect(screen.getByTestId("reel-modal")).toBeInTheDocument();

    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByTestId("reel-modal")).toBeNull();
  });

  it("closes modal on backdrop click", () => {
    render(
      <MemoryRouter>
        <ShoppableReels section={section([reel("1")])} />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByTestId("reel-card"));
    const backdrop = screen.getByTestId("reel-modal-backdrop");
    fireEvent.mouseDown(backdrop);
    expect(screen.queryByTestId("reel-modal")).toBeNull();
  });

  it("closing the modal stops playback", () => {
    render(
      <MemoryRouter>
        <ShoppableReels section={section([reel("1")])} />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByTestId("reel-card"));
    expect(screen.getByTestId("reel-modal")).toBeInTheDocument();

    pauseSpy.mockClear();
    fireEvent.click(screen.getByTestId("reel-modal-close"));
    expect(pauseSpy).toHaveBeenCalled();
  });

  it("renders graceful fallback when reel has no video URL or video fails", () => {
    render(
      <MemoryRouter>
        <ShoppableReels section={section([reel("no-vid", { videoUrl: "" })])} />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByTestId("reel-card"));
    expect(screen.getByTestId("reel-modal")).toBeInTheDocument();
    expect(screen.getByTestId("reel-modal-fallback")).toBeInTheDocument();
    expect(screen.getByText("Video preview unavailable")).toBeInTheDocument();
  });

  it("toggles play/pause and sound inside modal", () => {
    render(
      <MemoryRouter>
        <ShoppableReels section={section([reel("1")])} />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByTestId("reel-card"));
    const modal = screen.getByTestId("reel-modal");
    const soundBtn = screen.getByTestId("reel-modal-sound");

    // Modal starts unmuted (isMuted: false -> "Turn sound off")
    expect(soundBtn).toHaveAttribute("aria-label", "Turn sound off");
    fireEvent.click(soundBtn);
    expect(soundBtn).toHaveAttribute("aria-label", "Turn sound on");

    // Toggle play
    const playBtn = within(modal).getByRole("button", { name: /Pause modal video|Play modal video/ });
    fireEvent.click(playBtn);
    expect(pauseSpy).toHaveBeenCalled();
  });
});
