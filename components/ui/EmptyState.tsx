import { CSSProperties, ReactNode } from "react";

interface EmptyStateProps {
  icon?: string;
  title: string;
  description?: string;
  action?: ReactNode;
  style?: CSSProperties;
}

export function EmptyState({ icon = "ti-file-search", title, description, action, style }: EmptyStateProps) {
  return (
    <div
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 12,
        padding: "2rem",
        ...style,
      }}
    >
      <div
        style={{
          width: 52,
          height: 52,
          background: "rgba(255,255,255,0.04)",
          border: "0.5px solid rgba(255,255,255,0.08)",
          borderRadius: 14,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <i className={`ti ${icon}`} style={{ fontSize: 24, color: "rgba(255,255,255,0.2)" }} />
      </div>
      <div style={{ textAlign: "center" }}>
        <p style={{ fontSize: 13, fontWeight: 500, color: "rgba(255,255,255,0.4)" }}>{title}</p>
        {description && (
          <p style={{ fontSize: 12, color: "rgba(255,255,255,0.2)", marginTop: 4 }}>{description}</p>
        )}
      </div>
      {action && <div style={{ marginTop: 4 }}>{action}</div>}
    </div>
  );
}