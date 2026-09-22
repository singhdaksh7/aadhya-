const PALETTES = {
  green: "from-[#3c4a3a] to-[#5c6e57]",
  sage: "from-[#8a9a82] to-[#c1cbb8]",
  terracotta: "from-[#b8674a] to-[#d99a7f]",
  beige: "from-[#e8ddc9] to-[#f4ede1]",
  charcoal: "from-[#2b2723] to-[#4a443d]",
};

// Generated visual placeholder — used in place of real photography until client assets are supplied.
export default function Placeholder({
  tone = "sage",
  icon,
  label,
  className = "",
  ratio = "aspect-[4/3]",
}) {
  const gradient = PALETTES[tone] ?? PALETTES.sage;
  const isDark = tone === "green" || tone === "charcoal" || tone === "terracotta";
  return (
    <div
      className={`relative overflow-hidden rounded-2xl bg-gradient-to-br ${gradient} ${ratio} ${className}`}
    >
      <div
        className="absolute inset-0 opacity-20"
        style={{
          backgroundImage:
            "radial-gradient(circle at 20% 20%, rgba(255,255,255,0.5) 0, transparent 40%), radial-gradient(circle at 80% 70%, rgba(0,0,0,0.25) 0, transparent 45%)",
        }}
      />
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 px-4 text-center">
        {icon && (
          <div className={isDark ? "text-white/80" : "text-charcoal/60"}>{icon}</div>
        )}
        {label && (
          <span
            className={`font-serif-display text-sm tracking-wide ${
              isDark ? "text-white/70" : "text-charcoal/50"
            }`}
          >
            {label}
          </span>
        )}
      </div>
    </div>
  );
}
