import type { ButtonHTMLAttributes, HTMLAttributes } from "react";
import { classNames } from "../../controllers/format.ts";

export function Tabs({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={classNames("ui-tabs", className)} {...props} />;
}

export function TabsList({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={classNames("ui-tabs-list", className)} {...props} />;
}

export function TabsTrigger({ className, active, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { active?: boolean }) {
  return <button className={classNames("ui-tabs-trigger", active && "active", className)} type="button" {...props} />;
}

export function TabsContent({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={classNames("ui-tabs-content", className)} {...props} />;
}
