import type { HTMLAttributes } from "react";
import { classNames } from "../../controllers/format.ts";

export function Alert({ className, variant = "default", ...props }: HTMLAttributes<HTMLDivElement> & { variant?: "default" | "warning" | "destructive" }) {
  return <div className={classNames("ui-alert", `ui-alert-${variant}`, className)} {...props} />;
}
