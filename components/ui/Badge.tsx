import { CSSProperties } from "react";

type BadgeVariant = "success" | "warning" | "danger" | "info" | "neutral";

interface BadgeProps {
  label: string;
  variant?: BadgeVariant;
  style?: CSSProperties;
}

const VARIANTS: Record<BadgeVariant, CSSProperties> = {
  success: {
    background: "rgba(16,185,129,0.15)",
    border: "0.5px solid rgba(16,185,129,0.25)",
    color: "#6ee7b7",
  },
  warning: {
    background: "rgba(245,158,11,0.15)",
    border: "0.5px solid rgba(245,158,11,0.25)",
    color: "#fcd34d",
  },
  danger: {
    background: "rgba(239,68,68,0.15)",
    border: "0.5px solid rgba(239,68,68,0.25)",
    color: "#fca5a5",
  },
  info: {
    background: "rgba(99,102,241,0.15)",
    border: "0.5px solid rgba(99,102,241,0.25)",
    color: "#a5b4fc",
  },
  neutral: {
    background: "rgba(255,255,255,0.06)",
    border: "0.5px solid rgba(255,255,255,0.1)",
    color: "rgba(255,255,255,0.4)",
  },
};

export function Badge({ label, variant = "neutral", style }: BadgeProps) {
  return (
    <span
      style={{
        padding: "4px 10px",
        borderRadius: 20,
        fontSize: 11,
        fontWeight: 600,
        letterSpacing: "0.01em",
        ...VARIANTS[variant],
        ...style,
      }}
    >
      {label}
    </span>
  );
}