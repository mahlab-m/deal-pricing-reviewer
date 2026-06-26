import type { HealthStatus } from "@/lib/dashboard";

const CONFIG: Record<HealthStatus, { dot: string; label: string; text: string }> = {
  green:   { dot: "bg-emerald-500", label: "Healthy",  text: "text-emerald-600" },
  yellow:  { dot: "bg-amber-400",   label: "Watch",    text: "text-amber-600"   },
  red:     { dot: "bg-red-500",     label: "Flag",     text: "text-red-600"     },
  unscored:{ dot: "bg-gray-300",    label: "Unscored", text: "text-gray-400"    },
};

interface Props {
  status: HealthStatus;
  showLabel?: boolean;
}

export default function TrafficLight({ status, showLabel = true }: Props) {
  const c = CONFIG[status];
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`inline-block w-3 h-3 rounded-full ${c.dot}`} />
      {showLabel && (
        <span className={`text-xs font-medium ${c.text}`}>{c.label}</span>
      )}
    </span>
  );
}
