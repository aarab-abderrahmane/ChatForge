import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva } from "class-variance-authority";

import { cn } from "../../lib/utils"
import { radius } from "../../lib/design-tokens"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap font-body transition-all duration-100 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:ring-2 focus-visible:ring-green/30",
  {
    variants: {
      variant: {
        default:
          "bg-white text-ink border-[3px] border-ink shadow-[4px_4px_0px_0px_#2d2d2d] hover:bg-red hover:text-white hover:shadow-[2px_2px_0px_0px_#2d2d2d] hover:translate-x-[2px] hover:translate-y-[2px] active:shadow-none active:translate-x-[4px] active:translate-y-[4px]",
        destructive:
          "bg-white text-red border-[3px] border-ink shadow-[4px_4px_0px_0px_#2d2d2d] hover:bg-red hover:text-white hover:shadow-[2px_2px_0px_0px_#2d2d2d] hover:translate-x-[2px] hover:translate-y-[2px] active:shadow-none active:translate-x-[4px] active:translate-y-[4px]",
        outline:
          "bg-white text-ink border-2 border-ink border-dashed shadow-hard-sm hover:bg-muted-100 hover:-rotate-1",
        secondary:
          "bg-muted-200 text-ink border-[3px] border-ink shadow-[4px_4px_0px_0px_#2d2d2d] hover:bg-green hover:text-white hover:shadow-[2px_2px_0px_0px_#2d2d2d] hover:translate-x-[2px] hover:translate-y-[2px] active:shadow-none active:translate-x-[4px] active:translate-y-[4px]",
        ghost:
          "text-ink hover:bg-muted-100 hover:rotate-1",
        link:
          "text-ink underline-offset-4 underline decoration-wavy decoration-red hover:text-red",
      },
      size: {
        default: "h-12 px-5 py-2 text-lg has-[>svg]:px-4",
        sm: "h-10 gap-1.5 px-4 text-base has-[>svg]:px-3 border-2",
        lg: "h-14 px-8 text-xl md:text-2xl has-[>svg]:px-6",
        icon: "size-12 border-[3px]",
        "icon-sm": "size-10 border-2",
        "icon-lg": "size-14 border-[3px]",
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
  style,
  ...props
}) {
  const Comp = asChild ? Slot : "button"
  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      style={{ borderRadius: radius.wobblyMd, ...style }}
      {...props} />
  );
}

export { Button, buttonVariants }
