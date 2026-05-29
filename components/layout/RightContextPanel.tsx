'use client';

import React from 'react';

interface RightContextPanelProps {
  title?: string;
  subtitle?: string;
  onClose?: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
}

export function RightContextPanel({
  title,
  subtitle,
  onClose,
  children,
  footer,
}: RightContextPanelProps) {
  return (
    <div style={styles.container}>
      {/* Panel header */}
      {(title || onClose) && (
        <div style={styles.header}>
          <div style={styles.headerText}>
            {title && <h2 style={styles.title}>{title}</h2>}
            {subtitle && <p style={styles.subtitle}>{subtitle}</p>}
          </div>
          {onClose && (
            <button style={styles.closeButton} onClick={onClose} aria-label="Close panel">
              ✕
            </button>
          )}
        </div>
      )}

      {/* Scrollable panel body */}
      <div style={styles.body}>
        {children}
      </div>

      {/* Panel footer (e.g. action buttons) */}
      {footer && (
        <div style={styles.footer}>
          {footer}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// Sub-components for panel sections
// ─────────────────────────────────────────────

interface PanelSectionProps {
  label?: string;
  children: React.ReactNode;
}

export function PanelSection({ label, children }: PanelSectionProps) {
  return (
    <div style={panelSectionStyles.container}>
      {label && <p style={panelSectionStyles.label}>{label}</p>}
      <div style={panelSectionStyles.content}>{children}</div>
    </div>
  );
}

interface PanelRowProps {
  label: string;
  value: React.ReactNode;
  dimLabel?: boolean;
}

export function PanelRow({ label, value, dimLabel = true }: PanelRowProps) {
  return (
    <div style={panelRowStyles.container}>
      <span style={dimLabel ? panelRowStyles.dimLabel : panelRowStyles.label}>
        {label}
      </span>
      <span style={panelRowStyles.value}>{value}</span>
    </div>
  );
}

// ─────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    flex: 1,
    minHeight: 0,
  },
  header: {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    padding: '16px 16px 12px 16px',
    borderBottom: '1px solid #1e1e2e',
    flexShrink: 0,
    gap: '8px',
  },
  headerText: {
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
    flex: 1,
    minWidth: 0,
  },
  title: {
    margin: 0,
    fontSize: '14px',
    fontWeight: 600,
    color: '#e2e2ee',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  subtitle: {
    margin: 0,
    fontSize: '11px',
    color: '#44445a',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  closeButton: {
    background: 'none',
    border: 'none',
    color: '#44445a',
    cursor: 'pointer',
    fontSize: '14px',
    padding: '2px 6px',
    flexShrink: 0,
    lineHeight: 1,
  },
  body: {
    flex: 1,
    minHeight: 0,
    overflowY: 'auto',
    padding: '16px',
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  footer: {
    padding: '12px 16px',
    borderTop: '1px solid #1e1e2e',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    flexShrink: 0,
  },
};

const panelSectionStyles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  label: {
    margin: 0,
    fontSize: '10px',
    fontWeight: 600,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    color: '#44445a',
  },
  content: {},
};

const panelRowStyles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    padding: '5px 0',
    borderBottom: '1px solid #1a1a28',
    gap: '12px',
  },
  label: {
    fontSize: '12px',
    color: '#e2e2ee',
    flexShrink: 0,
  },
  dimLabel: {
    fontSize: '12px',
    color: '#44445a',
    flexShrink: 0,
  },
  value: {
    fontSize: '12px',
    color: '#e2e2ee',
    textAlign: 'right',
    minWidth: 0,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
};
