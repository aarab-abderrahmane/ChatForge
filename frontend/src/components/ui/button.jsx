import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva } from "class-variance-authority";

import { cn } from "../../lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap text-sm font-body transition-all duration-150 ease-out disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2 focus-visible:ring-offset-paper active:translate-y-[1px]",
  {
    variants: {
      variant: {
        default: "bg-green text-paper border border-green hover:bg-green/90",
        destructive: "border border-red text-red hover:bg-red hover:text-paper",
        outline: "border border-ink text-ink hover:bg-muted-100",
        secondary: "border border-divider text-ink hover:bg-muted-100",
        ghost: "text-ink hover:bg-muted-100",
        link: "text-ink underline-offset-4 underline decoration-1 hover:text-red",
      },
      size: {
        default: "h-9 px-4 py-2 has-[>svg]:px-3",
        sm: "h-8 gap-1.5 px-3 has-[>svg]:px-2.5",
        lg: "h-10 px-6 has-[>svg]:px-4",
        icon: "size-9",
        "icon-sm": "size-8",
        "icon-lg": "size-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}) {
  const Comp = asChild ? Slot : "button"
  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props} />
  );
}

export { Button, buttonVariants }
