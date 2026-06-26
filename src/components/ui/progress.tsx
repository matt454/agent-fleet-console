import type { HTMLAttributes } from "react";
import { classNames } from "../../controllers/format.ts";

export function Progress({ className, value = 0, ...props }: HTMLAttributes<HTMLDivElement> & { value?: number }) {
  const progress = Math.min(Math.max(Number(value || 0), 0), 100);
  return (
    <div className={classNames("ui-progress", className)} {...props}>
      <span style={{ width: `${progress}%` }} />
    </div>
  );
}
