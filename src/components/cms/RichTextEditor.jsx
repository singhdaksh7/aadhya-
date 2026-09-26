import React, { useRef, useState, useEffect } from "react";
import DOMPurify from "dompurify";
import MediaPicker from "./MediaPicker";

export default function RichTextEditor({ value = "", onChange, placeholder = "Write rich content here..." }) {
  const editorRef = useRef(null);
  const [showMediaPicker, setShowMediaPicker] = useState(false);
  const [fontSizeInput, setFontSizeInput] = useState("16");
  const [fontColor, setFontColor] = useState("#2B2723");
  const [bgColor, setBgColor] = useState("#FAF6F0");
  const isUpdatingRef = useRef(false);

  // Initialize and sync contenteditable innerHTML when value changes from outside
  useEffect(() => {
    if (editorRef.current && !isUpdatingRef.current) {
      if (editorRef.current.innerHTML !== (value || "")) {
        editorRef.current.innerHTML = value || "";
      }
    }
  }, [value]);

  const handleInput = () => {
    if (!editorRef.current) return;
    isUpdatingRef.current = true;
    const rawHtml = editorRef.current.innerHTML;
    const sanitized = DOMPurify.sanitize(rawHtml, {
      ADD_ATTR: ["style", "target", "rel", "align"],
      ADD_TAGS: ["hr", "mark", "u", "s", "strike"]
    });
    if (onChange) {
      onChange(sanitized);
    }
    setTimeout(() => {
      isUpdatingRef.current = false;
    }, 0);
  };

  const exec = (command, value = null) => {
    if (!editorRef.current) return;
    editorRef.current.focus();
    document.execCommand(command, false, value);
    handleInput();
  };

  const handleBlockFormat = (tag) => {
    exec("formatBlock", tag ? `<${tag}>` : "<p>");
  };

  const handleFontSizeChange = (val) => {
    setFontSizeInput(val);
    const num = parseInt(val, 10);
    if (!isNaN(num) && num >= 8 && num <= 96) {
      const selection = window.getSelection();
      if (!selection.rangeCount) return;
      const range = selection.getRangeAt(0);
      const span = document.createElement("span");
      span.style.fontSize = `${num}px`;
      range.surroundContents(span);
      handleInput();
    }
  };

  const handleApplyColor = (color) => {
    setFontColor(color);
    exec("foreColor", color);
  };

  const handleApplyBgColor = (color) => {
    setBgColor(color);
    exec("hiliteColor", color);
  };

  const handleInsertLink = () => {
    const url = prompt("Enter URL:", "https://");
    if (url) {
      exec("createLink", url);
    }
  };

  const handleMediaSelect = (asset) => {
    const imgUrl = asset.url;
    const altText = asset.altText || asset.title || "Image";
    const imgHtml = `<img src="${imgUrl}" alt="${altText}" style="max-width: 100%; height: auto; border-radius: 8px; margin: 12px 0;" />`;
    exec("insertHTML", imgHtml);
  };

  return (
    <div className="rounded-2xl border border-charcoal/15 bg-white overflow-hidden shadow-sm flex flex-col">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-1.5 p-2 bg-ivory border-b border-charcoal/10 text-charcoal select-none">
        {/* Undo / Redo */}
        <button
          type="button"
          onClick={() => exec("undo")}
          title="Undo"
          className="p-1.5 rounded-lg hover:bg-charcoal/10 text-xs font-semibold"
        >
          ↺
        </button>
        <button
          type="button"
          onClick={() => exec("redo")}
          title="Redo"
          className="p-1.5 rounded-lg hover:bg-charcoal/10 text-xs font-semibold"
        >
          ↻
        </button>

        <div className="h-4 w-px bg-charcoal/15 mx-1" />

        {/* Heading / Block Selector */}
        <select
          onChange={(e) => handleBlockFormat(e.target.value)}
          className="px-2 py-1 text-xs rounded-lg border border-charcoal/15 bg-white text-charcoal focus:outline-none"
          defaultValue="p"
        >
          <option value="p">Paragraph</option>
          <option value="h1">Heading 1</option>
          <option value="h2">Heading 2</option>
          <option value="h3">Heading 3</option>
          <option value="h4">Heading 4</option>
          <option value="blockquote">Blockquote</option>
        </select>

        {/* Custom Font Size Input (8px - 96px) */}
        <div className="flex items-center gap-1 text-xs px-1">
          <span className="text-charcoal-soft text-[11px] font-medium">Size:</span>
          <input
            type="number"
            min="8"
            max="96"
            value={fontSizeInput}
            onChange={(e) => handleFontSizeChange(e.target.value)}
            className="w-12 px-1 py-0.5 text-xs text-center border border-charcoal/15 rounded-lg bg-white"
            title="Font size (8px - 96px)"
          />
          <span className="text-charcoal-soft text-[10px]">px</span>
        </div>

        <div className="h-4 w-px bg-charcoal/15 mx-1" />

        {/* Text Formatting */}
        <button
          type="button"
          onClick={() => exec("bold")}
          title="Bold"
          className="p-1.5 rounded-lg hover:bg-charcoal/10 text-xs font-bold"
        >
          B
        </button>
        <button
          type="button"
          onClick={() => exec("italic")}
          title="Italic"
          className="p-1.5 rounded-lg hover:bg-charcoal/10 text-xs italic font-serif"
        >
          I
        </button>
        <button
          type="button"
          onClick={() => exec("underline")}
          title="Underline"
          className="p-1.5 rounded-lg hover:bg-charcoal/10 text-xs underline"
        >
          U
        </button>
        <button
          type="button"
          onClick={() => exec("strikeThrough")}
          title="Strikethrough"
          className="p-1.5 rounded-lg hover:bg-charcoal/10 text-xs line-through"
        >
          S
        </button>

        <div className="h-4 w-px bg-charcoal/15 mx-1" />

        {/* Text Color Picker */}
        <label className="flex items-center gap-1 cursor-pointer p-1 rounded-lg hover:bg-charcoal/10 text-xs" title="Text Color">
          <span className="text-[10px] font-bold text-charcoal-soft">A</span>
          <input
            type="color"
            value={fontColor}
            onChange={(e) => handleApplyColor(e.target.value)}
            className="w-4 h-4 rounded cursor-pointer border-0 p-0"
          />
        </label>

        {/* Highlight Color Picker */}
        <label className="flex items-center gap-1 cursor-pointer p-1 rounded-lg hover:bg-charcoal/10 text-xs" title="Highlight Color">
          <span className="text-[10px] font-bold bg-yellow-200 px-1 rounded text-charcoal">H</span>
          <input
            type="color"
            value={bgColor}
            onChange={(e) => handleApplyBgColor(e.target.value)}
            className="w-4 h-4 rounded cursor-pointer border-0 p-0"
          />
        </label>

        <div className="h-4 w-px bg-charcoal/15 mx-1" />

        {/* Alignments */}
        <button
          type="button"
          onClick={() => exec("justifyLeft")}
          title="Align Left"
          className="p-1.5 rounded-lg hover:bg-charcoal/10 text-xs"
        >
          ≡ Left
        </button>
        <button
          type="button"
          onClick={() => exec("justifyCenter")}
          title="Align Center"
          className="p-1.5 rounded-lg hover:bg-charcoal/10 text-xs"
        >
          ≡ Center
        </button>
        <button
          type="button"
          onClick={() => exec("justifyRight")}
          title="Align Right"
          className="p-1.5 rounded-lg hover:bg-charcoal/10 text-xs"
        >
          ≡ Right
        </button>
        <button
          type="button"
          onClick={() => exec("justifyFull")}
          title="Justify"
          className="p-1.5 rounded-lg hover:bg-charcoal/10 text-xs"
        >
          ≡ Justify
        </button>

        <div className="h-4 w-px bg-charcoal/15 mx-1" />

        {/* Lists */}
        <button
          type="button"
          onClick={() => exec("insertUnorderedList")}
          title="Bullet List"
          className="p-1.5 rounded-lg hover:bg-charcoal/10 text-xs"
        >
          • List
        </button>
        <button
          type="button"
          onClick={() => exec("insertOrderedList")}
          title="Numbered List"
          className="p-1.5 rounded-lg hover:bg-charcoal/10 text-xs"
        >
          1. List
        </button>

        <div className="h-4 w-px bg-charcoal/15 mx-1" />

        {/* Link & Image */}
        <button
          type="button"
          onClick={handleInsertLink}
          title="Insert Link"
          className="p-1.5 rounded-lg hover:bg-charcoal/10 text-xs font-medium text-terracotta"
        >
          🔗 Link
        </button>
        <button
          type="button"
          onClick={() => setShowMediaPicker(true)}
          title="Insert Image from Media Library"
          className="p-1.5 rounded-lg hover:bg-charcoal/10 text-xs font-medium text-sage-dark"
        >
          🖼️ Image
        </button>

        <div className="h-4 w-px bg-charcoal/15 mx-1" />

        {/* HR & Clear Formatting */}
        <button
          type="button"
          onClick={() => exec("insertHorizontalRule")}
          title="Horizontal Rule"
          className="p-1.5 rounded-lg hover:bg-charcoal/10 text-xs"
        >
          ― HR
        </button>
        <button
          type="button"
          onClick={() => exec("removeFormat")}
          title="Clear Formatting"
          className="p-1.5 rounded-lg hover:bg-charcoal/10 text-xs text-red-600"
        >
          ✕ Clear
        </button>
      </div>

      {/* Editing Surface */}
      <div
        ref={editorRef}
        contentEditable
        onInput={handleInput}
        onBlur={handleInput}
        className="min-h-[220px] p-4 text-sm text-charcoal font-sans outline-none focus:outline-none prose prose-stone max-w-none"
        placeholder={placeholder}
      />

      {/* Media Picker Modal */}
      <MediaPicker
        isOpen={showMediaPicker}
        onClose={() => setShowMediaPicker(false)}
        onSelect={handleMediaSelect}
        title="Insert Image into Content"
      />
    </div>
  );
}
