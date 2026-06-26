import type { HTMLAttributes } from "react";
import { classNames } from "../../controllers/format.ts";

export function Skeleton({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={classNames("ui-skeleton", className)} aria-hidden="true" {...props} />;
}
