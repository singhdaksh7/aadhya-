import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { BrowserRouter } from "react-router-dom";
import HowWeWork from "../src/components/HowWeWork";
import HomepageRenderer from "../src/components/HomepageRenderer";
import HomepageSectionFields from "../src/components/admin/HomepageSectionFields";

vi.mock("../src/components/HeroBannerCarousel", () => ({ default: () => <div /> }));
vi.mock("../src/components/PromoStrip", () => ({ default: () => <div /> }));
vi.mock("../src/components/ProductCard", () => ({ default: () => <div /> }));
vi.mock("../src/components/admin/ImagePickerInput", () => ({
  default: ({ label, value, onChange }) => (<label>{label}<input aria-label={label} value={value || ""} onChange={(e) => onChange(e.target.value)} /></label>),
}));
vi.mock("../src/lib/api", async (importOriginal) => ({ ...(await importOriginal()), resolveMediaUrl: (url) => (url ? `http://api.test${url}` : null) }));

const item = (n, over = {}) => ({ id: `i${n}`, title: `Point ${n}`, description: `Desc ${n}`, icon: "leaf", enabled: true, sortOrder: n, ...over });
const view = (config) => render(<BrowserRouter><HowWeWork config={config} /></BrowserRouter>);
const titles = () => screen.getAllByTestId("how-we-work-item").map((n) => within(n).getByRole("heading").textContent);

describe("HowWeWork storefront", () => {
  it("sorts items and hides disabled ones", () => {
    view({ title: "How We Work", image: "/a.jpg", items: [item(3), item(1), item(2, { enabled: false })] });
    expect(titles()).toEqual(["Point 1", "Point 3"]);
    expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent("How We Work");
  });

  it("supports more than five points but caps at eight", () => {
    view({ items: Array.from({ length: 10 }, (_, i) => item(i + 1)) });
    expect(screen.getAllByTestId("how-we-work-item")).toHaveLength(8);
  });

  it("places the image right by default and left when configured, text first in the DOM", () => {
    const { unmount } = view({ title: "T", image: "/a.jpg", items: [item(1)] });
    expect(screen.getByTestId("how-we-work-image")).toHaveClass("lg:order-2");
    expect(screen.getByTestId("how-we-work-content")).toHaveClass("lg:order-1");
    unmount();
    view({ title: "T", image: "/a.jpg", imagePosition: "LEFT", items: [item(1)] });
    expect(screen.getByTestId("how-we-work-image")).toHaveClass("lg:order-1");
    expect(screen.getByTestId("how-we-work-content")).toHaveClass("lg:order-2");
  });

  it("keeps heading and points before the image on mobile", () => {
    view({ title: "T", image: "/a.jpg", imagePosition: "LEFT", items: [item(1)] });
    const content = screen.getByTestId("how-we-work-content");
    const image = screen.getByTestId("how-we-work-image");
    expect(content.compareDocumentPosition(image) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(image).not.toHaveClass("order-first");
  });

  it("renders full width text when there is no image", () => {
    view({ title: "T", items: [item(1)] });
    expect(screen.queryByTestId("how-we-work-image")).toBeNull();
    expect(screen.getByTestId("how-we-work-content").parentElement).not.toHaveClass("lg:grid-cols-2");
  });

  it("hides a broken image and falls back to full width", () => {
    view({ title: "T", image: "/broken.jpg", items: [item(1)] });
    fireEvent.error(screen.getByTestId("how-we-work-image").querySelector("img"));
    expect(screen.queryByTestId("how-we-work-image")).toBeNull();
    expect(screen.getByText("Point 1")).toBeInTheDocument();
  });

  it("applies border and custom background settings", () => {
    view({ title: "T", background: "CUSTOM", backgroundColor: "#112233", showBorder: false, borderRadius: 8, items: [item(1)] });
    const card = screen.getByTestId("how-we-work").firstChild;
    expect(card.style.backgroundColor).toBe("rgb(17, 34, 51)");
    expect(card.style.borderRadius).toBe("8px");
    expect(card.style.borderWidth).toBe("");
  });

  it("renders nothing when empty, and is wired into the homepage renderer", () => {
    const { container } = view({ items: [] });
    expect(container).toBeEmptyDOMElement();
    render(<BrowserRouter><HomepageRenderer sections={[{ id: "s1", type: "HOW_WE_WORK", settings: { title: "Hello", items: [item(1)] } }]} /></BrowserRouter>);
    expect(screen.getByText("Point 1")).toBeInTheDocument();
  });
});

describe("HowWeWork admin fields", () => {
  const setup = (value) => {
    const onChange = vi.fn();
    render(<HomepageSectionFields type="HOW_WE_WORK" value={value} onChange={onChange} />);
    return onChange;
  };

  it("edits text, point fields and image position", () => {
    const onChange = setup({ title: "Old", items: [item(1)], imagePosition: "RIGHT" });
    fireEvent.change(screen.getByDisplayValue("Old"), { target: { value: "New" } });
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ title: "New" }));
    fireEvent.change(screen.getByLabelText("Point title"), { target: { value: "Renamed" } });
    expect(onChange.mock.lastCall[0].items[0].title).toBe("Renamed");
    fireEvent.change(screen.getByDisplayValue("Right of the points"), { target: { value: "LEFT" } });
    expect(onChange.mock.lastCall[0].imagePosition).toBe("LEFT");
  });

  it("adds and removes points", () => {
    const onChange = setup({ items: [item(1), item(2)] });
    fireEvent.click(screen.getByText("+ Add"));
    const added = onChange.mock.lastCall[0].items;
    expect(added).toHaveLength(3);
    expect(added[2]).toMatchObject({ enabled: true, sortOrder: 3, title: "" });
    fireEvent.click(screen.getAllByText("Delete")[0]);
    expect(onChange.mock.lastCall[0].items.map((i) => i.id)).toEqual(["i2"]);
  });

  it("disables adding beyond eight points", () => {
    setup({ items: Array.from({ length: 8 }, (_, i) => item(i + 1)) });
    expect(screen.getByText("+ Add")).toBeDisabled();
  });

  it("reorders via sort order and toggles enabled", () => {
    const onChange = setup({ items: [item(1), item(2)] });
    fireEvent.change(screen.getAllByLabelText("Sort order")[0], { target: { value: "9" } });
    expect(onChange.mock.lastCall[0].items[0].sortOrder).toBe(9);
    fireEvent.click(screen.getAllByLabelText(/Enabled/)[1]);
    expect(onChange.mock.lastCall[0].items[1].enabled).toBe(false);
  });

  it("changes the supporting image and point icon image", () => {
    const onChange = setup({ image: "/old.jpg", items: [item(1)] });
    fireEvent.change(screen.getByLabelText("Supporting image"), { target: { value: "/new.jpg" } });
    expect(onChange.mock.lastCall[0].image).toBe("/new.jpg");
    fireEvent.change(screen.getByLabelText(/Uploaded icon/), { target: { value: "/i.png" } });
    expect(onChange.mock.lastCall[0].items[0].iconImage).toBe("/i.png");
  });
});
