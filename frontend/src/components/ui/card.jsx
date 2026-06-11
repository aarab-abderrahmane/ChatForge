import { cn } from "../../lib/utils";
import { radius, shadows } from "../../lib/design-tokens";

/**
 * Hand-drawn card with optional tape or thumbtack decoration.
 * @param {{ decoration?: 'tape' | 'tack' | null, postit?: boolean, className?: string, style?: object, children: React.ReactNode }} props
 */
export function Card({
  decoration = null,
  postit = false,
  className,
  style,
  children,
  ...props
}) {
  return (
    <div
      className={cn(
        "card-sketch relative p-4 md:p-6",
        postit && "card-sketch-postit",
        decoration === "tape" && "card-sketch-tape pt-6",
        decoration === "tack" && "card-sketch-tack pt-5",
        className
      )}
      style={{
        borderRadius: radius.wobblyMd,
        boxShadow: shadows.hardSm,
        ...style,
      }}
      {...props}
    >
      {children}
    </div>
  );
}
