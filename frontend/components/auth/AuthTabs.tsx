import { LogIn, UserPlus } from "lucide-react";
import Link from "next/link";

export type AuthMode = "login" | "register";

const TABS = [
  { mode: "login", href: "/login", label: "Connexion", Icon: LogIn },
  { mode: "register", href: "/register", label: "Inscription", Icon: UserPlus },
] as const;

/** Desktop segmented control between the two forms. */
export default function AuthTabs({ active }: { active: AuthMode }) {
  return (
    <nav aria-label="Compte" className="hidden justify-center md:flex">
      <div className="inline-flex gap-1 rounded-full bg-neutral-100 p-1">
        {TABS.map(({ mode, href, label, Icon }) => {
          const current = mode === active;
          return (
            <Link
              key={mode}
              href={href}
              aria-current={current ? "page" : undefined}
              className={`flex items-center gap-1.5 rounded-full px-4 py-1.5 text-[15px] transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-900 ${
                current
                  ? "bg-white text-neutral-900 shadow-sm ring-1 ring-black/5"
                  : "text-neutral-500 hover:text-neutral-800"
              }`}
            >
              <Icon aria-hidden className="size-4" strokeWidth={1.75} />
              {label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
