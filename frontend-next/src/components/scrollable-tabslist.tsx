"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { cn } from "@/lib/cn";

interface ScrollableTabsListProps {
  children: ReactNode;
  className?: string;
}

const SCROLL_AMOUNT = 200;

const ScrollableTabsList = ({ children, className }: ScrollableTabsListProps) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const checkScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 0);
    setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 1);
  }, []);

  useEffect(() => {
    checkScroll();
    const el = scrollRef.current;
    if (!el) return;
    el.addEventListener("scroll", checkScroll);
    window.addEventListener("resize", checkScroll);
    return () => {
      el.removeEventListener("scroll", checkScroll);
      window.removeEventListener("resize", checkScroll);
    };
  }, [checkScroll]);

  const scroll = (direction: "left" | "right") => {
    scrollRef.current?.scrollBy({
      left: direction === "left" ? -SCROLL_AMOUNT : SCROLL_AMOUNT,
      behavior: "smooth",
    });
  };

  return (
    <div className={cn("relative", className)}>
      <button
        type="button"
        onClick={() => scroll("left")}
        aria-label="Scroll left"
        aria-hidden={!canScrollLeft}
        tabIndex={canScrollLeft ? 0 : -1}
        className={cn(
          "absolute left-0 top-1/2 z-10 -translate-y-1/2 rounded-full bg-background p-1 text-muted-foreground shadow transition-colors hover:bg-muted hover:text-foreground",
          !canScrollLeft && "invisible",
        )}
      >
        <ChevronLeft className="size-4" />
      </button>
      <div
        ref={scrollRef}
        className="scrollbar-fade w-full overflow-x-auto overflow-y-hidden whitespace-nowrap"
      >
        {children}
      </div>
      <button
        type="button"
        onClick={() => scroll("right")}
        aria-label="Scroll right"
        aria-hidden={!canScrollRight}
        tabIndex={canScrollRight ? 0 : -1}
        className={cn(
          "absolute right-0 top-1/2 z-10 -translate-y-1/2 rounded-full bg-background p-1 text-muted-foreground shadow transition-colors hover:bg-muted hover:text-foreground",
          !canScrollRight && "invisible",
        )}
      >
        <ChevronRight className="size-4" />
      </button>
    </div>
  );
};

export { ScrollableTabsList };
