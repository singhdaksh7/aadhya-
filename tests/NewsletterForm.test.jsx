import "@testing-library/jest-dom/vitest";
import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import NewsletterForm, { newsletterErrorMessage } from "../src/components/NewsletterForm";
import { subscribeNewsletter } from "../src/lib/api";

vi.mock("../src/lib/api", () => ({ subscribeNewsletter: vi.fn() }));
vi.mock("../src/lib/analytics", () => ({ trackNewsletterSignup: vi.fn() }));

const err = (status, message) => Object.assign(new Error(message), { status });
const fill = async (value) => {
  await userEvent.type(screen.getByLabelText(/email address/i), value);
  await userEvent.click(screen.getByRole("button", { name: /subscribe/i }));
};

describe("NewsletterForm", () => {
  beforeEach(() => vi.clearAllMocks());

  it("submits the trimmed email and shows the success message", async () => {
    subscribeNewsletter.mockResolvedValue({ data: { subscribed: true } });
    render(<NewsletterForm settings={{ successMessage: "Welcome aboard" }} />);
    await fill("  me@example.com ");
    expect(subscribeNewsletter).toHaveBeenCalledWith("me@example.com");
    expect(await screen.findByText("Welcome aboard")).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("shows a loading label, disables the button and ignores a double submit", async () => {
    let resolve;
    subscribeNewsletter.mockReturnValue(new Promise((r) => { resolve = r; }));
    render(<NewsletterForm settings={{ loadingLabel: "Sending…" }} />);
    await userEvent.type(screen.getByLabelText(/email address/i), "a@b.co");
    const button = screen.getByRole("button");
    await userEvent.click(button);
    expect(button).toBeDisabled();
    expect(button).toHaveTextContent("Sending…");
    await userEvent.click(button);
    expect(subscribeNewsletter).toHaveBeenCalledTimes(1);
    resolve({});
    await screen.findByRole("status");
  });

  it("treats an already-subscribed address as success (server answers 201 for duplicates)", async () => {
    subscribeNewsletter.mockResolvedValue({ data: { subscribed: true } });
    render(<NewsletterForm />);
    await fill("dup@example.com");
    expect(await screen.findByText(/thank you for subscribing/i)).toBeInTheDocument();
  });

  it("validates before calling the API", async () => {
    render(<NewsletterForm />);
    await userEvent.click(screen.getByRole("button", { name: /subscribe/i }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/enter your email/i);
    await userEvent.type(screen.getByLabelText(/email address/i), "nope");
    await userEvent.click(screen.getByRole("button", { name: /subscribe/i }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/valid email/i);
    expect(subscribeNewsletter).not.toHaveBeenCalled();
  });

  it("shows the server's validation message on a 400", async () => {
    subscribeNewsletter.mockRejectedValue(err(400, "Please enter a valid email address."));
    render(<NewsletterForm />);
    await fill("a@b.co");
    expect(await screen.findByRole("alert")).toHaveTextContent("Please enter a valid email address.");
  });

  it("shows a clear network error, keeps the typed email and allows retry", async () => {
    subscribeNewsletter.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    render(<NewsletterForm settings={{ errorPrefix: "Oops:" }} />);
    await fill("a@b.co");
    expect(await screen.findByRole("alert")).toHaveTextContent(/Oops: We couldn't reach the server/);
    expect(screen.getByLabelText(/email address/i)).toHaveValue("a@b.co");
    subscribeNewsletter.mockResolvedValueOnce({});
    await userEvent.click(screen.getByRole("button", { name: /subscribe/i }));
    await waitFor(() => expect(screen.getByRole("status")).toBeInTheDocument());
  });

  it("maps rate limiting and server errors to friendly sentences", () => {
    expect(newsletterErrorMessage(err(429, "x"))).toMatch(/too many/i);
    expect(newsletterErrorMessage(err(500, "Internal server error"))).toMatch(/our side/i);
    expect(newsletterErrorMessage(new TypeError("Failed to fetch"))).toMatch(/reach the server/i);
  });
});
