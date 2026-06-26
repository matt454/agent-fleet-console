import type { HTMLAttributes } from "react";
import { classNames } from "../../controllers/format.ts";

export function DialogOverlay({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={classNames("ui-dialog-overlay", className)} {...props} />;
}

export function DialogContent({ className, ...props }: HTMLAttributes<HTMLElement>) {
  return <section className={classNames("ui-dialog-content", className)} {...props} />;
}

export function DialogHeader({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={classNames("ui-dialog-header", className)} {...props} />;
}

export function DialogTitle({ className, ...props }: HTMLAttributes<HTMLHeadingElement>) {
  return <h2 className={classNames("ui-dialog-title", className)} {...props} />;
}

export function DialogDescription({ className, ...props }: HTMLAttributes<HTMLSpanElement>) {
  return <span className={classNames("ui-dialog-description", className)} {...props} />;
}
