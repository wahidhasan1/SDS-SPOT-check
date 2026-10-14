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

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  description: string;
}

export const PRIMARY_NAV: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, description: "Your practice at a glance" },
  { href: "/free-talk", label: "Free Talk", icon: MessagesSquare, description: "Low-pressure voice conversations" },
  { href: "/battles", label: "Speaking Battles", icon: Swords, description: "Timed challenges with feedback" },
  { href: "/coach", label: "AI Speaking Coach", icon: GraduationCap, description: "Get feedback on your answers" },
  { href: "/progress", label: "Progress", icon: ChartColumn, description: "Minutes, streaks, and skills" },
  { href: "/topics", label: "Topics", icon: Library, description: "Conversation ideas library" },
  { href: "/history", label: "Conversation History", icon: History, description: "Review past sessions" },
  { href: "/achievements", label: "Achievements", icon: Award, description: "Levels, XP, and badges" },
  { href: "/settings", label: "Settings", icon: Settings, description: "Profile, privacy, and preferences" },
];

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
