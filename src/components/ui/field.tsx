import type { HTMLAttributes, LabelHTMLAttributes } from "react";
import { classNames } from "../../controllers/format.ts";

export function Field({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={classNames("ui-field", className)} {...props} />;
}

export function FieldGroup({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={classNames("ui-field-group", className)} {...props} />;
}

export function FieldLabel({ className, ...props }: LabelHTMLAttributes<HTMLLabelElement>) {
  return <label className={classNames("ui-field-label", className)} {...props} />;
}

export function FieldDescription({ className, ...props }: HTMLAttributes<HTMLElement>) {
  return <small className={classNames("ui-field-description", className)} {...props} />;
}
