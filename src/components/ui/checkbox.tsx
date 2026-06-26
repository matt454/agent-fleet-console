import type { InputHTMLAttributes, Ref } from "react";
import { classNames } from "../../controllers/format.ts";

export function Checkbox({ className, type: _type, ref, ...props }: InputHTMLAttributes<HTMLInputElement> & { ref?: Ref<HTMLInputElement> }) {
  return <input ref={ref} className={classNames("ui-checkbox", className)} type="checkbox" {...props} />;
}
