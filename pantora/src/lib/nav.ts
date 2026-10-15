import {
  Award,
  ChartColumn,
  GraduationCap,
  History,
  LayoutDashboard,
  Library,
  MessagesSquare,
  Settings,
  Swords,
  type LucideIcon,
} from "lucide-react";

export type NavColor = "violet" | "pink" | "sky" | "mint" | "sun" | "orange" | "slate";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  description: string;
  color: NavColor;
}

export const PRIMARY_NAV: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, description: "Your practice at a glance", color: "violet" },
  { href: "/battles", label: "Speaking Battles", icon: Swords, description: "Timed speaking mini-games", color: "pink" },
  { href: "/free-talk", label: "Free Talk", icon: MessagesSquare, description: "Low-pressure voice conversations", color: "sky" },
  { href: "/coach", label: "AI Coach", icon: GraduationCap, description: "Feedback on grammar and natural English", color: "mint" },
  { href: "/topics", label: "Topics", icon: Library, description: "Conversation ideas library", color: "sun" },
  { href: "/progress", label: "Progress", icon: ChartColumn, description: "Trends, streaks, and skills", color: "orange" },
  { href: "/achievements", label: "Achievements", icon: Award, description: "Badges, quests, rewards, and league", color: "sun" },
  { href: "/history", label: "History", icon: History, description: "Review past sessions", color: "violet" },
  { href: "/settings", label: "Settings", icon: Settings, description: "Profile, privacy, and preferences", color: "slate" },
];

export const NAV_COLOR_CLASSES: Record<NavColor, string> = {
  violet: "bg-brand-500 text-white",
  pink: "bg-pink-500 text-white",
  sky: "bg-sky-500 text-white",
  mint: "bg-mint-500 text-white",
  sun: "bg-sun-400 text-ink",
  orange: "bg-orange-500 text-white",
  slate: "bg-white/20 text-white",
};

const EXTRA_TITLES: Record<string, string> = {
  "/safety": "Safety Center",
  "/help": "Help & Feedback",
  "/coach/saved": "My Learning",
};

export function titleForPath(pathname: string): string {
  if (EXTRA_TITLES[pathname]) return EXTRA_TITLES[pathname];
  if (pathname.startsWith("/history/")) return "Session Review";
  const match = PRIMARY_NAV.find((n) => pathname === n.href || pathname.startsWith(`${n.href}/`));
  return match?.label ?? "Pantora";
}
