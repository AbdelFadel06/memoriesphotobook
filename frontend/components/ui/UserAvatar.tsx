// Soft backgrounds with dark text: every pair meets AA contrast.
const PALETTE = [
  "bg-amber-100 text-amber-900",
  "bg-emerald-100 text-emerald-900",
  "bg-sky-100 text-sky-900",
  "bg-rose-100 text-rose-900",
  "bg-violet-100 text-violet-900",
  "bg-lime-100 text-lime-900",
];

const SIZES = {
  sm: "size-9 text-sm",
  lg: "size-20 text-2xl",
  hero: "size-20 text-2xl lg:size-28 lg:text-4xl",
} as const;

export function initials(name: string, email: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length >= 2) return (words[0][0] + words[words.length - 1][0]).toUpperCase();
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return email.slice(0, 2).toUpperCase();
}

/** Colour picked from the email so a user always gets the same one. */
function colourFor(email: string): string {
  let hash = 0;
  for (const char of email) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return PALETTE[hash % PALETTE.length];
}

/** Profile picture when there is one, initials otherwise. Decorative: callers label it. */
export default function UserAvatar({
  name,
  email,
  avatarUrl,
  size = "sm",
}: {
  name: string;
  email: string;
  avatarUrl?: string | null;
  size?: keyof typeof SIZES;
}) {
  if (avatarUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- short-lived signed URL, nothing to optimise
      <img
        src={avatarUrl}
        alt=""
        decoding="async"
        className={`shrink-0 rounded-full bg-neutral-200 object-cover ${SIZES[size]}`}
      />
    );
  }
  return (
    <span
      aria-hidden
      className={`grid shrink-0 place-items-center rounded-full font-semibold select-none ${SIZES[size]} ${colourFor(email)}`}
    >
      {initials(name, email)}
    </span>
  );
}
