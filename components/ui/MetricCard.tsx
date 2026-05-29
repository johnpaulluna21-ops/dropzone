import { CSSProperties } from "react";

interface MetricCardProps {
  label: string;
  value: string | number;
  icon?: string;
  iconColor?: string;
  style?: CSSProperties;
}

export function MetricCard({ label, value, icon, iconColor = "#a5b4fc", style }: MetricCardProps) {
  return (
    <div
      style={{
        background: "#1a1a1a",
        border: "0.5px solid rgba(255,255,255,0.08)",
        borderRadius: 16,
        padding: "1rem 1.25rem",
        display: "flex",
        alignItems: "center",
        gap: 12,
        ...style,
      }}
    >
      {icon && (
        <div
          style={{
            width: 36,
            height: 36,
            background: "rgba(99,102,241,0.1)",
            border: "0.5px solid rgba(99,102,241,0.2)",
            borderRadius: 10,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          <i className={`ti ${icon}`} style={{ fontSize: 16, color: iconColor }} />
        </div>
      )}
      <div>
        <p style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", fontWeight: 500, letterSpacing: "0.04em", textTransform: "uppercase" }}>{label}</p>
        <p style={{ fontSize: 20, fontWeight: 700, color: "#fff", marginTop: 2, letterSpacing: "-0.5px" }}>{value}</p>
      </div>
    </div>
  );
}