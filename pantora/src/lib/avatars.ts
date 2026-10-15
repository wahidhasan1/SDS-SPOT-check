// Preset avatars ("Pantora Pals"). Users pick one instead of uploading a photo,
// which keeps profiles anonymous by default. Some styles unlock at higher levels.
export type AvatarFace = "smile" | "joy" | "glasses" | "wink" | "cool" | "star" | "sleepy" | "grin";
export type AvatarExtra = "none" | "sparkle" | "flame" | "antenna" | "crown";

export interface AvatarPreset {
  label: string;
  from: string;
  to: string;
  face: AvatarFace;
  extra?: AvatarExtra;
  /** Level index required to choose this avatar. Omitted means always available. */
  unlockLevel?: number;
}

export const AVATARS: Record<string, AvatarPreset> = {
  aurora: { label: "Aurora", from: "#8c7cfb", to: "#1aa7f5", face: "smile" },
  coral: { label: "Coral", from: "#ff6fb5", to: "#ff9a52", face: "joy" },
  sky: { label: "Sky", from: "#4cc3ff", to: "#6e5bf6", face: "glasses" },
  violet: { label: "Violet", from: "#afa2ff", to: "#5a45e8", face: "wink" },
  emerald: { label: "Emerald", from: "#3ee6a8", to: "#0b86d0", face: "grin" },
  amber: { label: "Amber", from: "#ffd23f", to: "#ff7a1a", face: "smile" },
  teal: { label: "Teal", from: "#7ff0c6", to: "#1aa7f5", face: "cool" },
  rose: { label: "Rose", from: "#ff9fcf", to: "#e0207d", face: "joy" },
  indigo: { label: "Indigo", from: "#8c7cfb", to: "#2d2578", face: "glasses" },
  lime: { label: "Lime", from: "#c6f36b", to: "#10c98a", face: "wink" },
  dusk: { label: "Dusk", from: "#ff9a52", to: "#6e5bf6", face: "sleepy" },
  slate: { label: "Slate", from: "#a7a3bd", to: "#3d3760", face: "grin" },
  nova: { label: "Nova", from: "#ff6fb5", to: "#6e5bf6", face: "star", extra: "sparkle", unlockLevel: 2 },
  blaze: { label: "Blaze", from: "#ffd23f", to: "#ff3d9a", face: "cool", extra: "flame", unlockLevel: 3 },
  cosmo: { label: "Cosmo", from: "#1aa7f5", to: "#17123d", face: "joy", extra: "antenna", unlockLevel: 4 },
  legend: { label: "Legend", from: "#ffd23f", to: "#8c7cfb", face: "grin", extra: "crown", unlockLevel: 5 },
};

export const AVATAR_KEYS = Object.keys(AVATARS);

export function avatarPreset(key: string): AvatarPreset {
  return AVATARS[key] ?? AVATARS.aurora;
}

export function avatarStyle(key: string) {
  const a = avatarPreset(key);
  return { backgroundImage: `linear-gradient(135deg, ${a.from}, ${a.to})` };
}

export function isAvatarUnlocked(key: string, levelIndex: number) {
  const a = AVATARS[key];
  return Boolean(a) && (a.unlockLevel ?? 1) <= levelIndex;
}

/** Avatars that unlock as rewards, in unlock order. */
export const REWARD_AVATARS = AVATAR_KEYS.filter((k) => AVATARS[k].unlockLevel).sort((a, b) => AVATARS[a].unlockLevel! - AVATARS[b].unlockLevel!);
