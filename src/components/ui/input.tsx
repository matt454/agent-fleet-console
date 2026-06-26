import { forwardRef, type InputHTMLAttributes, type TextareaHTMLAttributes } from "react";
import { classNames } from "../../controllers/format.ts";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input({ className, ...props }, ref) {
  return <input ref={ref} className={classNames("ui-input", className)} {...props} />;
});

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(function Textarea({ className, ...props }, ref) {
  return <textarea ref={ref} className={classNames("ui-textarea", className)} {...props} />;
});
