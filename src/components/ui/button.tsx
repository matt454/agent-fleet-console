import { cloneElement, isValidElement, type ButtonHTMLAttributes, type ReactElement, type ReactNode } from "react";
import { classNames } from "../../controllers/format.ts";

type ButtonVariant = "default" | "outline" | "destructive" | "ghost";
type ButtonSize = "default" | "sm" | "icon";
type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  asChild?: boolean;
  variant?: ButtonVariant;
  size?: ButtonSize;
  children?: ReactNode;
};

export function Button({
  asChild = false,
  className,
  children,
  variant = "default",
  size = "default",
  ...props
}: ButtonProps) {
  const classes = classNames("ui-button", `ui-button-${variant}`, `ui-button-${size}`, className);
  if (asChild && isValidElement(children)) {
    const child = children as ReactElement<{ className?: string }>;
    return cloneElement(child, { ...props, className: classNames(classes, child.props.className) });
  }
  return <button className={classes} {...props}>{children}</button>;
}
