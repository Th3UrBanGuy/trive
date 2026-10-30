"use client"

import * as React from "react"
import * as DialogPrimitive from "@radix-ui/react-dialog"
import { X } from "lucide-react"
import { cn } from "@/lib/utils"

/**
 * ResponsiveDialogContent — a Radix Dialog.Content wrapper that does NOT
 * inherit the conflicting base classes from src/components/ui/dialog.tsx.
 *
 * Why this exists:
 *   The default DialogContent forces `top-[50%] left-[50%] translate-x-[-50%]
 *   translate-y-[-50%] grid gap-4 p-6` with NO max-height or overflow.
 *   On small screens, when content is taller than the viewport, the dialog
 *   overflows past the visible area and the footer (Cancel/Create buttons)
 *   becomes unreachable.
 *
 *   tailwind-merge *should* dedupe conflicting classes, but the `grid` layout
 *   doesn't honor `shrink-0` / `min-h-0` the way `flex flex-col` does. So we
 *   bypass the wrapper entirely and use Radix primitives directly.
 *
 * Layout:
 *   Mobile (< sm): bottom-sheet anchored to bottom, rounded top corners only,
 *                  max-h-[90vh], flex column with shrink-0 header/footer +
 *                  flex-1 min-h-0 overflow-y-auto body.
 *   Desktop (>= sm): centered modal, max-h-[85vh], rounded all corners.
 *
 * Children MUST be the same structure:
 *   <ResponsiveDialogContent>
 *     <div className="shrink-0 ...header" />
 *     <div className="flex-1 min-h-0 overflow-y-auto ...body" />
 *     <div className="shrink-0 ...footer" />
 *   </ResponsiveDialogContent>
 */
type ResponsiveDialogContentProps = React.ComponentProps<typeof DialogPrimitive.Content> & {
  /** Max width class for desktop, e.g. "sm:max-w-2xl" or "sm:max-w-3xl". */
  desktopMaxWidth?: string
  /** Whether to render the default close (X) button in the top-right. */
  showCloseButton?: boolean
}

export function ResponsiveDialogContent({
  className,
  children,
  desktopMaxWidth = "sm:max-w-lg",
  showCloseButton = false,
  ...props
}: ResponsiveDialogContentProps) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay
        className={cn(
          "fixed inset-0 z-50 bg-black/50 backdrop-blur-[2px]",
          "data-[state=open]:animate-in data-[state=closed]:animate-out",
          "data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0",
        )}
      />
      <DialogPrimitive.Content
        aria-describedby={undefined}
        className={cn(
          // ---- Mobile-first: bottom-sheet anchored to the bottom ----
          "fixed z-50 inset-x-0 bottom-0 top-auto",
          "flex flex-col gap-0 p-0 overflow-hidden",
          "max-h-[90vh] w-full",
          "rounded-t-2xl rounded-b-none",
          "glass-strong bg-noise shadow-2xl shadow-brand/20 ring-1 ring-brand/10",
          // Mobile slide-up animation
          "data-[state=open]:animate-in data-[state=closed]:animate-out",
          "data-[state=open]:slide-in-from-bottom data-[state=closed]:slide-out-to-bottom",
          "data-[state=open]:duration-300 data-[state=closed]:duration-200",
          // ---- Desktop: centered modal ----
          "sm:inset-0 sm:bottom-auto sm:top-1/2 sm:left-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2",
          "sm:max-h-[85vh] sm:w-auto sm:rounded-2xl sm:rounded-b-2xl",
          // Override the slide animation on desktop — fade+zoom feels better for centered modals
          "sm:data-[state=open]:slide-in-from-bottom-0 sm:data-[state=closed]:slide-out-to-bottom-0",
          "sm:data-[state=open]:fade-in-0 sm:data-[state=closed]:fade-out-0",
          "sm:data-[state=open]:zoom-in-95 sm:data-[state=closed]:zoom-out-95",
          desktopMaxWidth,
          className,
        )}
        {...props}
      >
        {children}
        {showCloseButton && (
          <DialogPrimitive.Close
            className="absolute top-3 right-3 size-8 rounded-full inline-flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-accent/60 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring z-10"
            aria-label="Close"
          >
            <X className="size-4" />
          </DialogPrimitive.Close>
        )}
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  )
}

// Re-export Radix primitives so consumers don't need two import paths.
export {
  Dialog,
  DialogTrigger,
  DialogClose,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"

// Also export the original DialogContent for components that still want the
// centered-without-scroll behavior (e.g. short confirm dialogs).
export { DialogContent as CenteredDialogContent } from "@/components/ui/dialog"
