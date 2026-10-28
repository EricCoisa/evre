"use client"

import * as React from "react"
import * as TabsPrimitive from "@radix-ui/react-tabs"
import { ChevronLeft, ChevronRight } from "lucide-react"

import { cn } from "@/lib/cn"
import { useIsMobile } from "@/hooks/use-mobile"

function Tabs({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Root>) {
  return (
    <TabsPrimitive.Root
      data-slot="tabs"
      className={cn("flex flex-col gap-2 w-full min-w-0 pt-2 sm:pt-4 max-w-full", className)}
      {...props}
    />
  )
}

function TabsList({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.List>) {
  const isMobile = useIsMobile()
  const scrollRef = React.useRef<HTMLDivElement>(null)
  const [showLeftArrow, setShowLeftArrow] = React.useState(false)
  const [showRightArrow, setShowRightArrow] = React.useState(false)

  const checkScroll = React.useCallback(() => {
    if (!scrollRef.current) return
    
    const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current
    setShowLeftArrow(scrollLeft > 1)
    setShowRightArrow(scrollLeft < scrollWidth - clientWidth - 1)
  }, [])

  React.useEffect(() => {
    checkScroll()
    const scrollElement = scrollRef.current
    if (!scrollElement) return

    scrollElement.addEventListener('scroll', checkScroll, { passive: true })
    window.addEventListener('resize', checkScroll)

    const resizeObserver = new ResizeObserver(() => {
      checkScroll()
    })
    resizeObserver.observe(scrollElement)
    Array.from(scrollElement.children).forEach((child) => {
      resizeObserver.observe(child)
    })

    // Scroll active tab into view on mount
    const timer = setTimeout(() => {
      const activeEl = scrollElement.querySelector<HTMLElement>('[data-state="active"]')
      if (activeEl) {
        activeEl.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' })
      }
    }, 50)

    return () => {
      clearTimeout(timer)
      scrollElement.removeEventListener('scroll', checkScroll)
      window.removeEventListener('resize', checkScroll)
      resizeObserver.disconnect()
    }
  }, [checkScroll])

  const scroll = (direction: 'left' | 'right') => {
    if (!scrollRef.current) return
    const scrollAmount = 200
    scrollRef.current.scrollBy({
      left: direction === 'left' ? -scrollAmount : scrollAmount,
      behavior: 'smooth'
    })
  }

  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    if (!scrollRef.current) return
    const { scrollWidth, clientWidth } = scrollRef.current
    if (scrollWidth > clientWidth && Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
      scrollRef.current.scrollLeft += e.deltaY
    }
  }

  return (
    <div className="relative flex-1 w-full max-w-full min-w-0">
      {showLeftArrow && (
        <button
          type="button"
          onClick={() => scroll('left')}
          className={cn(
            "absolute left-0 top-0 z-10 flex items-center justify-center transition-opacity",
            isMobile
              ? "h-9 w-8 bg-gradient-to-r from-background via-background/80 to-transparent"
              : "h-9 w-8 rounded-l-lg bg-gradient-to-r from-muted via-muted/90 to-transparent text-muted-foreground hover:text-foreground"
          )}
          aria-label="Scroll left"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
      )}
      <TabsPrimitive.List
        ref={scrollRef}
        data-slot="tabs-list"
        onWheel={handleWheel}
        className={cn(
          "inline-flex h-9 items-center w-full overflow-x-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]",
          isMobile
            ? "gap-0 border-b border-border"
            : "bg-muted text-muted-foreground justify-start rounded-lg p-[3px]",
          className
        )}
        {...props}
      />
      {showRightArrow && (
        <button
          type="button"
          onClick={() => scroll('right')}
          className={cn(
            "absolute right-0 top-0 z-10 flex items-center justify-center transition-opacity",
            isMobile
              ? "h-9 w-8 bg-gradient-to-l from-background via-background/80 to-transparent"
              : "h-9 w-8 rounded-r-lg bg-gradient-to-l from-muted via-muted/90 to-transparent text-muted-foreground hover:text-foreground"
          )}
          aria-label="Scroll right"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      )}
    </div>
  )
}

function TabsTrigger({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Trigger>) {
  const isMobile = useIsMobile()
  
  return (
    <TabsPrimitive.Trigger
      data-slot="tabs-trigger"
      className={cn(
        "inline-flex items-center justify-center gap-1.5 text-sm font-medium whitespace-nowrap transition-all disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        isMobile
          ? "text-muted-foreground data-[state=active]:text-foreground px-4 py-2 border-b-2 border-transparent data-[state=active]:border-primary rounded-none h-full"
          : "data-[state=active]:bg-background dark:data-[state=active]:text-foreground focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:outline-ring dark:data-[state=active]:border-input dark:data-[state=active]:bg-input/30 text-foreground dark:text-muted-foreground h-[calc(100%-1px)] flex-1 shrink-0 rounded-md border border-transparent px-3 py-1 focus-visible:ring-[3px] focus-visible:outline-1 data-[state=active]:shadow-sm",
        className
      )}
      onClick={(e) => {
        e.currentTarget.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' })
        props.onClick?.(e)
      }}
      {...props}
    />
  )
}

function TabsContent({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Content>) {
  return (
    <TabsPrimitive.Content
      data-slot="tabs-content"
      className={cn("flex-1 outline-none w-full min-w-0", className)}
      {...props}
    />
  )
}

export { Tabs, TabsList, TabsTrigger, TabsContent }
