import type { HealthStatus } from "@/lib/dashboard";

const CONFIG: Record<
  HealthStatus,
  { dot: string; label: string; text: string }
> = {
  green: {
    dot: "bg-emerald-500",
    label: "Healthy",
    text: "text-emerald-400",
  },
  yellow: {
    dot: "bg-amber-400",
    label: "Watch",
    text: "text-amber-400",
  },
  red: {
    dot: "bg-red-500",
    label: "Flag",
    text: "text-red-400",
  },
  unscored: {
    dot: "bg-slate-600",
    label: "Unscored",
    text: "text-slate-500",
  },
};

interface Props {
  status: HealthStatus;
  showLabel?: boolean;
}

export default function TrafficLight({ status, showLabel = true }: Props) {
  const c = CONFIG[status];
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`inline-block w-2 h-2 rounded-full ${c.dot}`} />
      {showLabel && (
        <span className={`text-xs font-medium ${c.text}`}>{c.label}</span>
      )}
    </span>
  );
}
