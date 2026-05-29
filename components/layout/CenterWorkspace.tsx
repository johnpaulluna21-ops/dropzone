'use client';

import React from 'react';

interface CenterWorkspaceProps {
  toolbar?: React.ReactNode;
  children: React.ReactNode;
}

export function CenterWorkspace({ toolbar, children }: CenterWorkspaceProps) {
  return (
    <div style={styles.container}>
      {/* Toolbar / top bar */}
      {toolbar && (
        <div style={styles.toolbar}>
          {toolbar}
        </div>
      )}

      {/* Scrollable content body */}
      <div style={styles.body}>
        {children}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Sub-components for workspace sections
// ─────────────────────────────────────────────

interface WorkspaceSectionProps {
  title?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  noPadding?: boolean;
}

export function WorkspaceSection({
  title,
  action,
  children,
  noPadding = false,
}: WorkspaceSectionProps) {
  return (
    <div style={sectionStyles.container}>
      {(title || action) && (
        <div style={sectionStyles.header}>
          {title && <h3 style={sectionStyles.title}>{title}</h3>}
          {action && <div>{action}</div>}
        </div>
      )}
      <div style={noPadding ? {} : sectionStyles.body}>
        {children}
      </div>
    </div>
  );
}

interface WorkspaceToolbarProps {
  left?: React.ReactNode;
  center?: React.ReactNode;
  right?: React.ReactNode;
}

export function WorkspaceToolbar({ left, center, right }: WorkspaceToolbarProps) {
  return (
    <div style={toolbarStyles.bar}>
      <div style={toolbarStyles.left}>{left}</div>
      <div style={toolbarStyles.center}>{center}</div>
      <div style={toolbarStyles.right}>{right}</div>
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
    minHeight: 0, // critical: lets flex child shrink below content size
  },
  toolbar: {
    flexShrink: 0,
    borderBottom: '1px solid #1e1e2e',
  },
  body: {
    flex: 1,
    minHeight: 0, // critical: without this, overflowY auto expands instead of scrolling
    overflowY: 'auto',
    padding: '24px',
    display: 'flex',
    flexDirection: 'column',
    gap: '24px',
  },
};

const sectionStyles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  header: {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    margin: 0,
    fontSize: '12px',
    fontWeight: 600,
    letterSpacing: '0.06em',
    textTransform: 'uppercase',
    color: '#44445a',
  },
  body: {},
};

const toolbarStyles: Record<string, React.CSSProperties> = {
  bar: {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '12px 24px',
    minHeight: '52px',
    gap: '16px',
  },
  left: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    flex: 1,
  },
  center: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  right: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    justifyContent: 'flex-end',
    flex: 1,
  },
};
