import { createContext, useContext, useState } from "react";

const BrochureContext = createContext(null);

export function BrochureProvider({ children }) {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <BrochureContext.Provider value={{ isOpen, open: () => setIsOpen(true), close: () => setIsOpen(false) }}>
      {children}
    </BrochureContext.Provider>
  );
}

export function useBrochure() {
  const ctx = useContext(BrochureContext);
  if (!ctx) throw new Error("useBrochure must be used within BrochureProvider");
  return ctx;
}
