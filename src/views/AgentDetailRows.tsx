import type { LucideIcon } from "lucide-react";
import { Badge } from "../components/ui/badge.tsx";

export type DetailBadgeVariant = "default" | "secondary" | "outline" | "success" | "warning";

export function DetailRow({
  icon: Icon,
  label,
  value,
  badgeVariant,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  badgeVariant?: DetailBadgeVariant;
}) {
  return (
    <div className="details-row">
      <span className="detail-row-label"><Icon />{label}</span>
      {badgeVariant ? <Badge variant={badgeVariant}>{value}</Badge> : <span className="details-row-value">{value}</span>}
    </div>
  );
}
