import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { BrowserRouter } from "react-router-dom";
import TopUtilityBar from "../components/TopUtilityBar";
import Footer from "../components/Footer";
import { applyThemeVariables, DEFAULT_SITE_SETTINGS } from "../hooks/useSiteSettings";

// Mock site settings hook
vi.mock("../hooks/useSiteSettings", async () => {
  const actual = await vi.importActual("../hooks/useSiteSettings");
  return {
    ...actual,
    useSiteSettings: () => ({
      ...actual.DEFAULT_SITE_SETTINGS,
      general: {
        storeName: "Aadya Test Store",
        shortDescription: "Custom Artisan Home Decor Store",
        supportEmail: "support@aadyatest.com",
        supportPhone: "+91 99999 88888",
        businessAddress: "123 Craft Lane",
        city: "Bengaluru",
      },
      header: {
        showUtilityBar: true,
        utilityBarItems: [
          { id: "1", enabled: true, title: "Custom Free Express Shipping", link: "/shipping" },
          { id: "2", enabled: true, title: "10-Day Hassle-Free Returns", link: "/returns" },
        ],
      },
      footer: {
        brandDescription: "Dynamic Footer Brand Story Test Description",
        contactDetails: true,
        socialLinksVisibility: true,
        paymentIcons: ["Visa", "Mastercard", "Razorpay"],
      },
      social: {
        instagram: "https://instagram.com/aadyatest",
        facebook: "https://facebook.com/aadyatest",
      },
      shipping: {
        freeShippingThreshold: 3500,
        standardShippingAmount: 200,
      },
      payments: {
        razorpayEnabled: true,
        codEnabled: true,
        razorpayDisplayLabel: "Razorpay Online",
        codDisplayLabel: "Cash on Delivery",
      },
    }),
  };
});

describe("Phase F — Frontend Store Settings Components", () => {
  it("TopUtilityBar renders dynamic utility bar items from site settings", () => {
    render(
      <BrowserRouter>
        <TopUtilityBar />
      </BrowserRouter>
    );

    expect(screen.getByText("Custom Free Express Shipping")).toBeInTheDocument();
    expect(screen.getByText("10-Day Hassle-Free Returns")).toBeInTheDocument();
  });

  it("Footer renders dynamic brand description, support details, and social links", () => {
    render(
      <BrowserRouter>
        <Footer />
      </BrowserRouter>
    );

    expect(screen.getByText("Dynamic Footer Brand Story Test Description")).toBeInTheDocument();
    expect(screen.getByText("support@aadyatest.com")).toBeInTheDocument();
    expect(screen.getByText("+91 99999 88888")).toBeInTheDocument();
    expect(screen.getByText("Instagram")).toBeInTheDocument();
    expect(screen.getByText("Facebook")).toBeInTheDocument();
  });

  it("applyThemeVariables updates document root CSS properties", () => {
    const appearance = {
      colors: {
        primary: "#123456",
        secondary: "#654321",
        background: "#FFFFFF",
      },
      layout: {
        cardRadius: "1.5rem",
        buttonRadius: "8px",
      },
    };

    applyThemeVariables(appearance);

    expect(document.documentElement.style.getPropertyValue("--color-primary")).toBe("#123456");
    expect(document.documentElement.style.getPropertyValue("--color-secondary")).toBe("#654321");
    expect(document.documentElement.style.getPropertyValue("--radius-card")).toBe("1.5rem");
    expect(document.documentElement.style.getPropertyValue("--radius-button")).toBe("8px");
  });
});
