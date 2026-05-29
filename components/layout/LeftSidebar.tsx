'use client';

import React from 'react';

interface LeftSidebarProps {
  header?: React.ReactNode;
  searchSlot?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
}

export function LeftSidebar({
  header,
  searchSlot,
  children,
  footer,
}: LeftSidebarProps) {
  return (
    <div style={styles.container}>
      {/* Sidebar Header */}
      {header && (
        <div style={styles.header}>
          {header}
        </div>
      )}

      {/* Search Slot */}
      {searchSlot && (
        <div style={styles.searchArea}>
          {searchSlot}
        </div>
      )}

      {/* Scrollable List */}
      <div style={styles.listArea}>
        {children}
      </div>

      {/* Footer (e.g. user info, settings link) */}
      {footer && (
        <div style={styles.footer}>
          {footer}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// Sub-components for sidebar items
// ─────────────────────────────────────────────

interface SidebarSectionProps {
  label: string;
  children: React.ReactNode;
}

export function SidebarSection({ label, children }: SidebarSectionProps) {
  return (
    <div style={sectionStyles.container}>
      <p style={sectionStyles.label}>{label}</p>
      {children}
    </div>
  );
}

interface SidebarItemProps {
  label: string;
  sublabel?: string;
  badge?: React.ReactNode;
  active?: boolean;
  onClick?: () => void;
}

export function SidebarItem({
  label,
  sublabel,
  badge,
  active = false,
  onClick,
}: SidebarItemProps) {
  return (
    <div
      style={{
        ...itemStyles.container,
        ...(active ? itemStyles.active : {}),
      }}
      onClick={onClick}
    >
      <div style={itemStyles.textBlock}>
        <span style={itemStyles.label}>{label}</span>
        {sublabel && (
          <span style={itemStyles.sublabel}>{sublabel}</span>
        )}
      </div>
      {badge && <div style={itemStyles.badgeSlot}>{badge}</div>}
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
    height: '100%',
  },
  header: {
    padding: '16px 16px 12px 16px',
    borderBottom: '1px solid #1e1e2e',
    flexShrink: 0,
  },
  searchArea: {
    padding: '10px 12px',
    borderBottom: '1px solid #1e1e2e',
    flexShrink: 0,
  },
  listArea: {
    flex: 1,
    overflowY: 'auto',
    overflowX: 'hidden',
    padding: '8px 0',
  },
  footer: {
    padding: '12px 16px',
    borderTop: '1px solid #1e1e2e',
    flexShrink: 0,
  },
};

const sectionStyles: Record<string, React.CSSProperties> = {
  container: {
    marginBottom: '4px',
  },
  label: {
    fontSize: '10px',
    fontWeight: 600,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    color: '#44445a',
    padding: '8px 16px 4px 16px',
    margin: 0,
  },
};

const itemStyles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '8px 16px',
    cursor: 'pointer',
    borderRadius: '0',
    transition: 'background 0.1s ease',
    gap: '8px',
    userSelect: 'none',
  },
  active: {
    backgroundColor: '#1a1a2e',
    borderLeft: '2px solid #6366f1',
  },
  textBlock: {
    display: 'flex',
    flexDirection: 'column',
    flex: 1,
    minWidth: 0,
  },
  label: {
    fontSize: '13px',
    fontWeight: 500,
    color: '#d4d4e8',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  sublabel: {
    fontSize: '11px',
    color: '#44445a',
    marginTop: '1px',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  badgeSlot: {
    flexShrink: 0,
  },
};
