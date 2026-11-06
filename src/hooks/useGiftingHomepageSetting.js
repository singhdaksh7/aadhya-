import { useCallback, useEffect, useState } from "react";
import { adminFetchSiteSettings, adminUpdateSiteSettings } from "../lib/api";
import { refreshSiteSettings } from "./useSiteSettings";

// Single shared admin-side store for `showGiftingOnHomepage`. Every control (Homepage Builder, Gifting page
// settings) reads and writes through here, so they can never disagree; each also re-reads the server on mount.
let current = null; // null = not loaded yet
const subs = new Set();
const publish = (v) => { current = v; subs.forEach((fn) => fn(v)); };

export function useGiftingHomepageSetting() {
  const [value, setValue] = useState(current);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    subs.add(setValue);
    let alive = true;
    (async () => {
      try {
        const res = await adminFetchSiteSettings();
        if (alive) publish((res?.data ?? res)?.showGiftingOnHomepage === true);
      } catch {
        if (alive) setError("Could not load the current setting.");
      }
    })();
    return () => { alive = false; subs.delete(setValue); };
  }, []);

  const save = useCallback(async (next) => {
    const prev = current;
    setError("");
    setSaving(true);
    publish(next);
    try {
      await adminUpdateSiteSettings({ showGiftingOnHomepage: next });
      refreshSiteSettings();
    } catch (err) {
      publish(prev);
      setError(err?.message || "Failed to save.");
    } finally {
      setSaving(false);
    }
  }, []);

  return { value, saving, error, save };
}
