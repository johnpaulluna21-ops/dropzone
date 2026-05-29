import { CSSProperties, ReactNode } from "react";

interface CardProps {
  children: ReactNode;
  padding?: string | number;
  style?: CSSProperties;
}

export function Card({ children, padding = "1.5rem", style }: CardProps) {
  return (
    <div
      style={{
        background: "#1a1a1a",
        border: "0.5px solid rgba(255,255,255,0.08)",
        borderRadius: 20,
        padding,
        display: "flex",
        flexDirection: "column",
        ...style,
      }}
    >
      {children}
    </div>
  );
}