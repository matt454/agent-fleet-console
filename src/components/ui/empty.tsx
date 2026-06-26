import type { HTMLAttributes } from "react";
import { classNames } from "../../controllers/format.ts";

export function Empty({ className, size = "default", ...props }: HTMLAttributes<HTMLDivElement> & { size?: "default" | "large" }) {
  return <div className={classNames("ui-empty", size === "large" && "ui-empty-large", className)} {...props} />;
}

export function EmptyHeader({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={classNames("ui-empty-header", className)} {...props} />;
}

export function EmptyMedia({ className, variant = "default", ...props }: HTMLAttributes<HTMLDivElement> & { variant?: "default" | "icon" }) {
  return <div className={classNames("ui-empty-media", variant === "icon" && "ui-empty-media-icon", className)} {...props} />;
}

export function EmptyTitle({ className, ...props }: HTMLAttributes<HTMLHeadingElement>) {
  return <h3 className={classNames("ui-empty-title", className)} {...props} />;
}

export function EmptyDescription({ className, ...props }: HTMLAttributes<HTMLParagraphElement>) {
  return <p className={classNames("ui-empty-description", className)} {...props} />;
}

export function EmptyContent({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={classNames("ui-empty-content", className)} {...props} />;
}
