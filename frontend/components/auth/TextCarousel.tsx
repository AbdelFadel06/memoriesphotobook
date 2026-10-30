"use client";

import { useEffect, useState } from "react";

export type CarouselItem = { title: string; text: string };

const INTERVAL_MS = 5000;

/**
 * Plain text carousel that advances on its own when there is more than one item.
 * Pauses on hover/focus and stays still for users who prefer reduced motion.
 */
export default function TextCarousel({ items }: { items: readonly CarouselItem[] }) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const multiple = items.length > 1;

  useEffect(() => {
    if (!multiple || paused) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timer = window.setInterval(() => setIndex((i) => (i + 1) % items.length), INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [multiple, paused, items.length]);

  return (
    <section
      aria-roledescription="carrousel"
      aria-label="Ce que vous pouvez faire"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
      className="overflow-hidden"
    >
      <div
        className="flex motion-safe:transition-transform motion-safe:duration-700 motion-safe:ease-out"
        style={{ transform: `translateX(-${index * 100}%)` }}
      >
        {items.map((item, i) => (
          <div
            key={item.title}
            role="group"
            aria-roledescription="diapositive"
            aria-label={`${i + 1} sur ${items.length}`}
            aria-hidden={i !== index}
            className="w-full shrink-0 pr-4"
          >
            <p className="text-3xl leading-tight font-semibold">{item.title}</p>
            <p className="mt-3 max-w-md text-lg leading-relaxed text-white/85">{item.text}</p>
          </div>
        ))}
      </div>

      {multiple && (
        <div className="mt-8 flex gap-2">
          {items.map((item, i) => (
            <button
              key={item.title}
              type="button"
              aria-label={`Afficher le message ${i + 1}`}
              aria-current={i === index}
              onClick={() => setIndex(i)}
              className={`h-1.5 rounded-full transition-all focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white ${
                i === index ? "w-8 bg-white" : "w-1.5 bg-white/50 hover:bg-white/80"
              }`}
            />
          ))}
        </div>
      )}
    </section>
  );
}
