import { avatarStyle } from "@/lib/avatars";
import { cn } from "@/lib/cn";

export function Avatar({ name, avatar, size = "md", className }: { name: string; avatar: string; size?: "xs" | "sm" | "md" | "lg" | "xl"; className?: string }) {
  const sizes = { xs: "h-7 w-7 text-xs", sm: "h-9 w-9 text-sm", md: "h-11 w-11 text-base", lg: "h-16 w-16 text-2xl", xl: "h-28 w-28 text-5xl" };
  return (
    <span
      className={cn("inline-flex shrink-0 items-center justify-center rounded-full font-bold text-white ring-2 ring-white/70 select-none", sizes[size], className)}
      style={avatarStyle(avatar)}
      aria-hidden
    >
      {name.trim().charAt(0).toUpperCase() || "?"}
    </span>
  );
}
