import { CSSProperties, ReactNode } from "react";

type ButtonVariant = "primary" | "secondary" | "danger" | "warning" | "ghost";
type ButtonSize = "sm" | "md";

interface ButtonProps {
  children: ReactNode;
  variant?: ButtonVariant;
  size?: ButtonSize;
  disabled?: boolean;
  loading?: boolean;
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void;
  style?: CSSProperties;
  type?: "button" | "submit";
}

const VARIANTS: Record<ButtonVariant, CSSProperties> = {
  primary: {
    background: "rgba(99,102,241,0.15)",
    border: "0.5px solid rgba(99,102,241,0.3)",
    color: "#a5b4fc",
  },
  secondary: {
    background: "rgba(255,255,255,0.06)",
    border: "0.5px solid rgba(255,255,255,0.1)",
    color: "rgba(255,255,255,0.5)",
  },
  danger: {
    background: "rgba(239,68,68,0.12)",
    border: "0.5px solid rgba(239,68,68,0.25)",
    color: "#fca5a5",
  },
  warning: {
    background: "rgba(245,158,11,0.15)",
    border: "0.5px solid rgba(245,158,11,0.3)",
    color: "#fcd34d",
  },
  ghost: {
    background: "none",
    border: "none",
    color: "rgba(255,255,255,0.3)",
  },
};

const SIZES: Record<ButtonSize, CSSProperties> = {
  sm: { padding: "5px 12px", fontSize: 12, borderRadius: 8 },
  md: { padding: "8px 14px", fontSize: 13, borderRadius: 10 },
};

export function Button({
  children,
  variant = "primary",
  size = "md",
  disabled,
  loading,
  onClick,
  style,
  type = "button",
}: ButtonProps) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 6,
        fontFamily: "inherit",
        fontWeight: 500,
        cursor: disabled || loading ? "not-allowed" : "pointer",
        opacity: disabled || loading ? 0.5 : 1,
        transition: "opacity 0.15s",
        ...VARIANTS[variant],
        ...SIZES[size],
        ...style,
      }}
    >
      {loading && (
        <i
          className="ti ti-loader-2"
          style={{ fontSize: 13, animation: "spin 0.8s linear infinite" }}
        />
      )}
      {children}
    </button>
  );
}