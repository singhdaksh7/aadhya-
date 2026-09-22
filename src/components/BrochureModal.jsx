import { useBrochure } from "../context/BrochureContext";
import { Modal } from "./ui";

export default function BrochureModal() {
  const { isOpen, close } = useBrochure();
  return (
    <Modal open={isOpen} onClose={close} title="Download Brochure">
      <p className="text-sm leading-relaxed text-charcoal-soft">
        Official brochure will be connected here once client-approved materials are available.
      </p>
    </Modal>
  );
}
