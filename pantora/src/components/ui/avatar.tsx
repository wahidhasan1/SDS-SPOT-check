import { avatarPreset, avatarStyle, type AvatarExtra, type AvatarFace } from "@/lib/avatars";
import { cn } from "@/lib/cn";

const INK = "#17132f";

function Face({ face }: { face: AvatarFace }) {
  const eyes = (() => {
    switch (face) {
      case "joy":
        return <path d="M13 19 l3 -3 l3 3 M21 19 l3 -3 l3 3" fill="none" stroke={INK} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />;
      case "wink":
        return (
          <>
            <circle cx="16" cy="18" r="2" fill={INK} />
            <path d="M21.5 18.5 q2.5 -2 5 0" fill="none" stroke={INK} strokeWidth="2" strokeLinecap="round" />
          </>
        );
      case "sleepy":
        return <path d="M13 18 q3 2.5 6 0 M21 18 q3 2.5 6 0" fill="none" stroke={INK} strokeWidth="2" strokeLinecap="round" />;
      case "cool":
        return <path d="M10.5 16 h19 v1.5 l-1.5 3.5 h-5 l-1.5 -3 h-3 l-1.5 3 h-5 l-1.5 -3.5 z" fill={INK} />;
      case "star":
        return (
          <path
            d="M16 14.5 l1 2.4 2.4 .3 -1.8 1.6 .5 2.5 -2.1 -1.3 -2.1 1.3 .5 -2.5 -1.8 -1.6 2.4 -.3 z M24 14.5 l1 2.4 2.4 .3 -1.8 1.6 .5 2.5 -2.1 -1.3 -2.1 1.3 .5 -2.5 -1.8 -1.6 2.4 -.3 z"
            fill="#fff"
            stroke={INK}
            strokeWidth="1"
            strokeLinejoin="round"
          />
        );
      case "glasses":
        return (
          <>
            <circle cx="16" cy="18" r="3.6" fill="#fff" fillOpacity="0.5" stroke={INK} strokeWidth="1.6" />
            <circle cx="24" cy="18" r="3.6" fill="#fff" fillOpacity="0.5" stroke={INK} strokeWidth="1.6" />
            <path d="M19.6 18 h0.8" stroke={INK} strokeWidth="1.6" />
            <circle cx="16" cy="18" r="1.4" fill={INK} />
            <circle cx="24" cy="18" r="1.4" fill={INK} />
          </>
        );
      default:
        return (
          <>
            <ellipse cx="16" cy="18" rx="1.9" ry="2.3" fill={INK} />
            <ellipse cx="24" cy="18" rx="1.9" ry="2.3" fill={INK} />
          </>
        );
    }
  })();
  const mouth =
    face === "joy" || face === "grin" ? (
      <path d="M15.5 23.5 q4.5 5.5 9 0 z" fill={INK} stroke={INK} strokeWidth="1.2" strokeLinejoin="round" />
    ) : face === "sleepy" ? (
      <circle cx="20" cy="25" r="1.4" fill={INK} />
    ) : (
      <path d="M16 24 q4 3.5 8 0" fill="none" stroke={INK} strokeWidth="2" strokeLinecap="round" />
    );
  return (
    <>
      <ellipse cx="11.5" cy="23" rx="2.6" ry="1.6" fill="#ff8fc4" opacity="0.85" />
      <ellipse cx="28.5" cy="23" rx="2.6" ry="1.6" fill="#ff8fc4" opacity="0.85" />
      {eyes}
      {mouth}
    </>
  );
}

function Extra({ extra }: { extra: AvatarExtra }) {
  switch (extra) {
    case "sparkle":
      return <path d="M31 4 q.8 3.2 4 4 q-3.2 .8 -4 4 q-.8 -3.2 -4 -4 q3.2 -.8 4 -4 z" fill="#ffd23f" stroke={INK} strokeWidth="1" />;
    case "flame":
      return <path d="M20 1.5 q5 4 3 8.5 q2 -1 2.5 -3 q3 4.5 -0.5 8 h-10 q-3.5 -3.5 -0.5 -8 q.5 2 2.5 3 q-2 -4.5 3 -8.5 z" fill="#ff7a1a" stroke={INK} strokeWidth="1" strokeLinejoin="round" />;
    case "antenna":
      return (
        <>
          <path d="M20 9 V3" stroke={INK} strokeWidth="1.6" strokeLinecap="round" />
          <circle cx="20" cy="2.8" r="2.2" fill="#ff3d9a" stroke={INK} strokeWidth="1" />
        </>
      );
    case "crown":
      return <path d="M12.5 10 l1 -7 l3.5 3.5 l3 -5 l3 5 l3.5 -3.5 l1 7 z" fill="#ffd23f" stroke={INK} strokeWidth="1.2" strokeLinejoin="round" />;
    default:
      return null;
  }
}

/** Illustrated preset avatar. Purely decorative: the name is always shown next to it. */
export function Avatar({ name, avatar, size = "md", className }: { name: string; avatar: string; size?: "xs" | "sm" | "md" | "lg" | "xl"; className?: string }) {
  const sizes = { xs: "h-7 w-7", sm: "h-9 w-9", md: "h-11 w-11", lg: "h-16 w-16", xl: "h-28 w-28" };
  const preset = avatarPreset(avatar);
  return (
    <span
      className={cn("relative inline-flex shrink-0 overflow-visible rounded-full ring-2 ring-white select-none", sizes[size], className)}
      style={avatarStyle(avatar)}
      aria-hidden
      data-avatar={avatar}
      title={name}
    >
      <svg viewBox="0 0 40 40" className="h-full w-full overflow-visible">
        <Face face={preset.face} />
        {preset.extra && <Extra extra={preset.extra} />}
      </svg>
    </span>
  );
}
