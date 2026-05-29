'use client';

import React from 'react';

interface WorkspaceShellProps {
  leftSidebar: React.ReactNode;
  centerWorkspace: React.ReactNode;
  rightPanel?: React.ReactNode;
  rightPanelOpen?: boolean;
}

export function WorkspaceShell({
  leftSidebar,
  centerWorkspace,
  rightPanel,
  rightPanelOpen = false,
}: WorkspaceShellProps) {
  return (
    <div style={styles.shell}>
      {/* Left Sidebar */}
      <aside style={styles.left}>
        {leftSidebar}
      </aside>

      {/* Center Workspace */}
      <main style={styles.center}>
        {centerWorkspace}
      </main>

      {/* Right Context Panel — only renders if content is provided and open */}
      {rightPanel && rightPanelOpen && (
        <aside style={styles.right}>
          {rightPanel}
        </aside>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  shell: {
    display: 'flex',
    flexDirection: 'row',
    width: '100%',
    height: '100vh',
    overflow: 'hidden',
    backgroundColor: '#0d0d14',
    color: '#e2e2ee',
    fontFamily: "'Inter', 'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif",
  },
  left: {
    width: '260px',
    minWidth: '260px',
    maxWidth: '260px',
    height: '100vh',
    overflowY: 'auto',
    overflowX: 'hidden',
    backgroundColor: '#111118',
    borderRight: '1px solid #1e1e2e',
    display: 'flex',
    flexDirection: 'column',
    flexShrink: 0,
  },
  center: {
    flex: 1,
    height: '100vh',
    overflowY: 'auto',
    overflowX: 'hidden',
    backgroundColor: '#0d0d14',
    display: 'flex',
    flexDirection: 'column',
    minWidth: 0,
  },
  right: {
    width: '340px',
    minWidth: '340px',
    maxWidth: '340px',
    height: '100vh',
    overflowY: 'auto',
    overflowX: 'hidden',
    backgroundColor: '#111118',
    borderLeft: '1px solid #1e1e2e',
    display: 'flex',
    flexDirection: 'column',
    flexShrink: 0,
  },
};
