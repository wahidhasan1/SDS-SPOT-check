import { Briefcase, Coffee, GraduationCap, Laptop, Palette, Plane, Scale, Sparkles, Sprout, UtensilsCrossed, type LucideIcon } from "lucide-react";
import type { TopicCategory } from "@/lib/types";
import { cn } from "@/lib/cn";

// One icon and colour per topic category, used on topic cards and filters.
export const CATEGORY_STYLE: Record<TopicCategory, { icon: LucideIcon; tile: string }> = {
  "everyday-life": { icon: Coffee, tile: "from-sun-300 to-orange-400" },
  hobbies: { icon: Palette, tile: "from-pink-300 to-pink-500" },
  "travel-culture": { icon: Plane, tile: "from-sky-300 to-sky-500" },
  education: { icon: GraduationCap, tile: "from-brand-300 to-brand-500" },
  career: { icon: Briefcase, tile: "from-navy-600 to-navy-800" },
  "personal-development": { icon: Sprout, tile: "from-mint-300 to-mint-500" },
  technology: { icon: Laptop, tile: "from-sky-400 to-brand-500" },
  "food-lifestyle": { icon: UtensilsCrossed, tile: "from-orange-300 to-pink-400" },
  "opinions-debate": { icon: Scale, tile: "from-pink-400 to-brand-500" },
  storytelling: { icon: Sparkles, tile: "from-sun-300 to-pink-400" },
};

/** Rounded gradient tile with the category's icon. */
export function CategoryTile({ category, className }: { category: TopicCategory; className?: string }) {
  const { icon: Icon, tile } = CATEGORY_STYLE[category];
  return (
    <span className={cn("flex h-12 w-12 shrink-0 -rotate-3 items-center justify-center rounded-2xl bg-gradient-to-br text-white shadow-[0_3px_0_0_rgb(23_19_47/0.15)]", tile, className)} aria-hidden>
      <Icon className="h-6 w-6" strokeWidth={2.3} />
    </span>
  );
}
