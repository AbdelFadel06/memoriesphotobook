import { ChevronRight } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

const ROW =
  "-mx-3 flex items-center gap-4 rounded-2xl px-3 py-4 text-[17px] font-medium transition-colors hover:bg-neutral-100 focus-visible:outline-2 focus-visible:outline-neutral-900";

/** One line of the profile menu: icon, label and chevron. */
export function SettingsLink({
  href,
  icon,
  children,
}: {
  href: string;
  icon: ReactNode;
  children: ReactNode;
}) {
  return (
    <Link href={href} className={`${ROW} text-neutral-900`}>
      <span aria-hidden className="text-neutral-800">
        {icon}
      </span>
      <span className="flex-1">{children}</span>
      <ChevronRight aria-hidden className="size-5 text-neutral-400" strokeWidth={2} />
    </Link>
  );
}

export function SettingsButton({
  onClick,
  icon,
  children,
}: {
  onClick: () => void;
  icon: ReactNode;
  children: ReactNode;
}) {
  return (
    <button type="button" onClick={onClick} className={`${ROW} w-[calc(100%+1.5rem)] text-red-600`}>
      <span aria-hidden>{icon}</span>
      <span className="flex-1 text-left">{children}</span>
    </button>
  );
}

export function SettingsSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-4 first:mt-0 md:mt-0">
      <h2 className="pb-2 text-[15px] text-neutral-500">{title}</h2>
      <div>{children}</div>
    </section>
  );
}
