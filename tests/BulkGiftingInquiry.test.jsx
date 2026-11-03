import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import React from "react";
import { BulkGiftingSection } from "../src/components/gifting/GiftingSections";

describe("BulkGiftingSection Component", () => {
  it("renders bulk gifting section with headings and form", () => {
    render(<BulkGiftingSection content={{ eyebrow: "Bespoke Requests", heading: "Custom Corporate Boxes" }} />);
    expect(screen.getByText("Bespoke Requests")).toBeInTheDocument();
    expect(screen.getByText("Custom Corporate Boxes")).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Priya Nair/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/priya@example.com/i)).toBeInTheDocument();
  });

  it("submits inquiry and shows success confirmation", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, data: { id: "inq-123" } }),
    });

    render(<BulkGiftingSection content={{ successMessage: "We have received your bulk order request." }} />);

    fireEvent.change(screen.getByPlaceholderText(/Priya Nair/i), { target: { value: "Anita Desai" } });
    fireEvent.change(screen.getByPlaceholderText(/priya@example.com/i), { target: { value: "anita@example.com" } });
    fireEvent.change(screen.getByPlaceholderText(/\+91 98765/i), { target: { value: "+91 9988776655" } });
    fireEvent.change(screen.getByPlaceholderText(/e\.g\. 50/i), { target: { value: "75" } });
    fireEvent.change(screen.getByPlaceholderText(/Diwali Corporate/i), { target: { value: "Annual Gathering" } });
    fireEvent.change(screen.getByPlaceholderText(/Tell us about specific items/i), { target: { value: "Need 75 scented candles with brass holders." } });

    fireEvent.click(screen.getByRole("button", { name: /Submit Inquiry/i }));

    await waitFor(() => {
      expect(screen.getByText("Inquiry Received")).toBeInTheDocument();
      expect(screen.getByText("We have received your bulk order request.")).toBeInTheDocument();
    });
  });

  it("does not render when enabled is false", () => {
    const { container } = render(<BulkGiftingSection content={{ enabled: false }} />);
    expect(container.firstChild).toBeNull();
  });
});

