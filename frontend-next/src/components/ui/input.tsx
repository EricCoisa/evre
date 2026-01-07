import * as React from "react"

import { cn } from "@/lib/utils"

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "file:text-foreground placeholder:text-muted-foreground selection:bg-primary-500 selection:text-white dark:bg-input/30 border-primary-300 dark:border-primary-600 h-9 w-full min-w-0 rounded-md border-2 bg-transparent px-3 py-1 text-base  transition-[color,box-shadow,border-color] outline-none file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
        "focus-visible:border-primary-500 focus-visible:ring-primary-200 dark:focus-visible:ring-primary-800 focus-visible:ring-[3px] hover:border-primary-400 dark:hover:border-primary-500",
        "aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive",
        className
      )}
      {...props}
    />
  )
}

export { Input }
