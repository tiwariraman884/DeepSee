import { forwardRef } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

type Variant = "primary" | "secondary" | "ghost" | "destructive";
type Size = "sm" | "md" | "lg";

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
}

const variants: Record<Variant, string> = {
  primary:
    "bg-accent text-white hover:bg-accent-600 hover:shadow-glow-accent focus-visible:ring-accent/50",
  secondary:
    "border border-white/10 bg-secondary text-text-primary hover:bg-white/5 focus-visible:ring-white/20",
  ghost: "text-text-muted hover:bg-white/5 hover:text-text-primary",
  destructive:
    "bg-danger/90 text-white hover:bg-danger focus-visible:ring-danger/50",
};

const sizes: Record<Size, string> = {
  sm: "h-8 px-3 text-xs gap-1.5",
  md: "h-10 px-4 text-sm gap-2",
  lg: "h-12 px-6 text-base gap-2",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "md", loading, disabled, children, ...props }, ref) => (
    <button
      ref={ref}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(
        "inline-flex items-center justify-center rounded-control font-medium transition-all duration-150 ease-out-expo focus:outline-none focus-visible:ring-2 disabled:cursor-not-allowed disabled:opacity-50",
        variants[variant],
        sizes[size],
        className
      )}
      {...props}
    >
      {loading && <Loader2 className={cn("h-4 w-4 animate-spin", children ? "mr-2" : "")} aria-hidden="true" />}
      {children}
    </button>
  )
);
Button.displayName = "Button";
