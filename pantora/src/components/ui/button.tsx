import Link from "next/link";
import { forwardRef, type ComponentProps } from "react";
import { LoaderCircle } from "lucide-react";
import { cn } from "@/lib/cn";

type Variant = "primary" | "secondary" | "outline" | "ghost" | "danger" | "success" | "dark" | "pop" | "pink" | "white";
type Size = "sm" | "md" | "lg" | "icon";

// Game-style buttons: solid fills with a chunky bottom edge that presses down.
const base =
  "press inline-flex items-center justify-center gap-2 rounded-2xl font-bold disabled:pointer-events-none disabled:opacity-50 select-none whitespace-nowrap";

const variants: Record<Variant, string> = {
  primary: "bg-brand-600 text-white shadow-[0_4px_0_0_var(--color-brand-800)] [--edge:var(--color-brand-800)] hover:bg-brand-500",
  secondary: "bg-brand-50 text-brand-700 shadow-[0_3px_0_0_var(--color-brand-200)] [--edge:var(--color-brand-200)] hover:bg-brand-100",
  outline: "border-2 border-line-strong bg-surface text-ink shadow-[0_3px_0_0_var(--color-line-strong)] hover:bg-surface-muted",
  ghost: "text-ink-soft hover:bg-surface-muted hover:text-ink active:translate-y-0",
  danger: "bg-danger-600 text-white shadow-[0_4px_0_0_var(--color-danger-700)] [--edge:var(--color-danger-700)] hover:bg-danger-500",
  success: "bg-mint-500 text-white shadow-[0_4px_0_0_var(--color-mint-700)] [--edge:var(--color-mint-700)] hover:bg-mint-400",
  dark: "bg-navy-900 text-white shadow-[0_4px_0_0_var(--color-navy-950)] [--edge:var(--color-navy-950)] hover:bg-navy-800",
  pop: "bg-sun-400 text-ink shadow-[0_4px_0_0_var(--color-sun-500)] [--edge:var(--color-sun-500)] hover:bg-sun-300",
  pink: "bg-pink-500 text-white shadow-[0_4px_0_0_var(--color-pink-700)] [--edge:var(--color-pink-700)] hover:bg-pink-400",
  white: "bg-white text-ink shadow-[0_4px_0_0_rgb(23_19_47/0.25)] hover:bg-white/90",
};

const sizes: Record<Size, string> = {
  sm: "h-9 px-3.5 text-sm",
  md: "h-11 px-5 text-sm",
  lg: "h-13 px-6 text-base",
  icon: "h-10 w-10",
};

export function buttonClasses(variant: Variant = "primary", size: Size = "md", className?: string) {
  return cn(base, variants[variant], sizes[size], className);
}

interface ButtonProps extends ComponentProps<"button"> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "primary", size = "md", loading, className, children, disabled, type = "button", ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={buttonClasses(variant, size, className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading && <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden />}
      {children}
    </button>
  );
});

interface ButtonLinkProps extends ComponentProps<typeof Link> {
  variant?: Variant;
  size?: Size;
}

export function ButtonLink({ variant = "primary", size = "md", className, ...props }: ButtonLinkProps) {
  return <Link className={buttonClasses(variant, size, className)} {...props} />;
}
