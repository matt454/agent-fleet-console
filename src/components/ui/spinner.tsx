import { Loader2 } from "lucide-react";
import type { SVGProps } from "react";
import { classNames } from "../../controllers/format.ts";

export function Spinner({ className, ...props }: SVGProps<SVGSVGElement>) {
  return <Loader2 className={classNames("ui-spinner", className)} aria-hidden="true" {...props} />;
}
