import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { BrowserRouter } from "react-router-dom";
import OurJourney from "../src/components/OurJourney";
import OurJourneyFields from "../src/components/admin/OurJourneyFields";
import HomepageRenderer from "../src/components/HomepageRenderer";

vi.mock("../src/lib/api", () => ({
  resolveMediaUrl: (url) => (url ? `http://api.test${url}` : null),
  resolveProductImageUrl: (url) => (url ? `http://api.test${url}` : null),
  adminUploadMedia: vi.fn(),
}));
vi.mock("../src/components/cms/MediaPicker", () => ({ default: () => null }));
vi.mock("../src/components/admin/ImageCropModal", () => ({ default: () => null }));

const wrap = (ui) => <BrowserRouter>{ui}</BrowserRouter>;
const m = (id, title, extra = {}) => ({ id, title, date: "Year", description: `${title} text`, enabled: true, ...extra });

describe("OurJourney renderer", () => {
  it("sorts by sortOrder and hides disabled milestones", () => {
    render(wrap(<OurJourney config={{ title: "Journey", milestones: [m("a", "Second", { sortOrder: 2 }), m("b", "First", { sortOrder: 1 }), m("c", "Hidden", { sortOrder: 3, enabled: false })] }} />));
    const titles = screen.getAllByRole("heading", { level: 3 }).map((h) => h.textContent);
    expect(titles).toEqual(["First", "Second"]);
    expect(screen.queryByText("Hidden")).toBeNull();
  });

  it("renders nothing with zero enabled milestones", () => {
    const { container } = render(wrap(<OurJourney config={{ title: "Journey", milestones: [m("a", "Off", { enabled: false })] }} />));
    expect(container).toBeEmptyDOMElement();
    const empty = render(wrap(<OurJourney config={{}} />));
    expect(empty.container).toBeEmptyDOMElement();
  });

  it("images are optional and removed when they fail to load", () => {
    const { container } = render(wrap(<OurJourney config={{ image: "/a.jpg", milestones: [m("a", "One", { image: "/b.jpg" }), m("b", "Two")] }} />));
    const imgs = container.querySelectorAll("img");
    expect(imgs).toHaveLength(2);
    fireEvent.error(imgs[0]);
    fireEvent.error(container.querySelector("img"));
    expect(container.querySelectorAll("img")).toHaveLength(0);
    expect(screen.getByText("One")).toBeInTheDocument();
  });

  it("is wired into HomepageRenderer", () => {
    render(wrap(<HomepageRenderer sections={[{ id: "j", type: "OUR_JOURNEY", isEnabled: true, sortOrder: 1, settings: { milestones: [m("a", "Chapter one")] } }]} />));
    expect(screen.getByTestId("our-journey")).toBeInTheDocument();
  });
});

describe("OurJourneyFields admin editor", () => {
  const setup = (milestones) => {
    const set = vi.fn();
    render(<OurJourneyFields value={{ milestones }} set={set} />);
    return set;
  };

  it("adds a milestone", () => {
    const set = setup([m("a", "A")]);
    fireEvent.click(screen.getByText("+ Add milestone"));
    const [key, next] = set.mock.calls[0];
    expect(key).toBe("milestones");
    expect(next).toHaveLength(2);
    expect(next.map((x) => x.sortOrder)).toEqual([1, 2]);
  });

  it("caps at 12 milestones", () => {
    setup(Array.from({ length: 12 }, (_, i) => m(`id${i}`, `T${i}`)));
    expect(screen.getByText("+ Add milestone")).toBeDisabled();
  });

  it("removes a milestone", () => {
    const set = setup([m("a", "A"), m("b", "B")]);
    fireEvent.click(screen.getByLabelText("Delete milestone 1"));
    expect(set.mock.calls[0][1].map((x) => x.id)).toEqual(["b"]);
  });

  it("reorders and renumbers sort order", () => {
    const set = setup([m("a", "A"), m("b", "B")]);
    fireEvent.click(screen.getByLabelText("Move milestone 1 down"));
    expect(set.mock.calls[0][1].map((x) => [x.id, x.sortOrder])).toEqual([["b", 1], ["a", 2]]);
  });

  it("toggles enabled and edits the milestone image", () => {
    const set = setup([m("a", "A", { image: "/uploads/x.jpg" })]);
    fireEvent.click(screen.getByLabelText("Milestone 1 enabled"));
    expect(set.mock.calls[0][1][0].enabled).toBe(false);
    fireEvent.click(screen.getByText("Remove"));
    expect(set.mock.calls[1][1][0].image).toBe("");
  });
});
