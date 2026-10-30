import AuthShowcase from "@/components/auth/AuthShowcase";
import MobileHero from "@/components/auth/MobileHero";

/**
 * Fills the viewport exactly, without page scroll.
 * Mobile: photo on top, form sheet below. Desktop: form on the left (2/5), photo on the right (3/5).
 */
export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-white md:grid md:grid-cols-[minmax(400px,2fr)_3fr]">
      <MobileHero />
      {/* overflow-y-auto only kicks in on very small screens where the form cannot fit. */}
      <main className="relative z-10 -mt-8 flex min-h-0 flex-1 flex-col overflow-y-auto rounded-t-4xl bg-white px-6 pt-8 pb-6 md:mt-0 md:h-full md:rounded-none md:px-10 md:py-10">
        <div className="mx-auto flex w-full max-w-[380px] flex-1 flex-col">{children}</div>
      </main>
      <AuthShowcase />
    </div>
  );
}
