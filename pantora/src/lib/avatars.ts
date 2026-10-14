// Preset avatar styles. Users pick one instead of uploading a photo, which keeps
// profiles anonymous by default.
export const AVATARS: Record<string, { label: string; from: string; to: string }> = {
  aurora: { label: "Aurora", from: "#6e5bf6", to: "#0ea5e9" },
  coral: { label: "Coral", from: "#fb7185", to: "#f59e0b" },
  sky: { label: "Sky", from: "#38bdf8", to: "#6366f1" },
  violet: { label: "Violet", from: "#a78bfa", to: "#7c3aed" },
  emerald: { label: "Emerald", from: "#34d399", to: "#0d9488" },
  amber: { label: "Amber", from: "#fbbf24", to: "#ea580c" },
  teal: { label: "Teal", from: "#2dd4bf", to: "#0284c7" },
  rose: { label: "Rose", from: "#f472b6", to: "#e11d48" },
  indigo: { label: "Indigo", from: "#818cf8", to: "#3730a3" },
  lime: { label: "Lime", from: "#a3e635", to: "#16a34a" },
  dusk: { label: "Dusk", from: "#f97316", to: "#7c3aed" },
  slate: { label: "Slate", from: "#94a3b8", to: "#334155" },
};

export const AVATAR_KEYS = Object.keys(AVATARS);

export function avatarStyle(key: string) {
  const a = AVATARS[key] ?? AVATARS.aurora;
  return { backgroundImage: `linear-gradient(135deg, ${a.from}, ${a.to})` };
}
