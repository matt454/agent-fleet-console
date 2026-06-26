import type { FormHTMLAttributes, HTMLAttributes } from "react";
import { classNames } from "../../controllers/format.ts";

type CardProps = HTMLAttributes<HTMLElement> & { as?: "aside" | "div" | "section" };

export function Card({ as: Element = "div", className, ...props }: CardProps) {
  return <Element className={classNames("ui-card", className)} {...props} />;
}

export function CardForm({ className, ...props }: FormHTMLAttributes<HTMLFormElement>) {
  return <form className={classNames("ui-card", className)} {...props} />;
}

export function CardHeader({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={classNames("ui-card-header", className)} {...props} />;
}

export function CardTitle({ className, ...props }: HTMLAttributes<HTMLHeadingElement>) {
  return <h3 className={classNames("ui-card-title", className)} {...props} />;
}

export function CardDescription({ className, ...props }: HTMLAttributes<HTMLParagraphElement>) {
  return <p className={classNames("ui-card-description", className)} {...props} />;
}

export function CardContent({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={classNames("ui-card-content", className)} {...props} />;
}

export function CardFooter({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={classNames("ui-card-footer", className)} {...props} />;
}
