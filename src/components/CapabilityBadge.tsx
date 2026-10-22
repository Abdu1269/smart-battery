import { Badge } from "@/components/ui/badge";
import type { CapabilityStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

const labels: Record<CapabilityStatus, string> = {
  supported: "Verified",
  unsupported: "Unsupported",
  permissionRequired: "Permission needed",
  notDetected: "Not detected",
  readOnly: "Read only",
  error: "Unavailable",
};

const variants: Record<CapabilityStatus, "success" | "neutral" | "warning" | "danger"> =
  {
    supported: "success",
    unsupported: "neutral",
    permissionRequired: "warning",
    notDetected: "neutral",
    readOnly: "warning",
    error: "danger",
  };

export function CapabilityBadge({
  status,
  className,
}: {
  status: CapabilityStatus;
  className?: string;
}) {
  return (
    <Badge variant={variants[status]} className={cn("normal-case", className)}>
      <span
        className={cn(
          "size-1.5 rounded-full",
          status === "supported"
            ? "bg-primary"
            : status === "permissionRequired" || status === "readOnly"
              ? "bg-warning-strong"
              : status === "error"
                ? "bg-destructive"
                : "bg-muted-foreground",
        )}
        aria-hidden="true"
      />
      {labels[status]}
    </Badge>
  );
}
