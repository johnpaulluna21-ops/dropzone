'use client';

import React from 'react';

interface WorkspaceShellProps {
  leftSidebar: React.ReactNode;
  centerWorkspace: React.ReactNode;
  rightPanel?: React.ReactNode;
  rightPanelOpen?: boolean;
  leftSidebarCollapsed?: boolean;
}

export function WorkspaceShell({
  leftSidebar,
  centerWorkspace,
  rightPanel,
  rightPanelOpen = false,
  leftSidebarCollapsed = false,
}: WorkspaceShellProps) {
  return (
    <div style={styles.shell}>
      {/* Left Sidebar — sticky, scrolls internally */}
      <aside style={{
        ...styles.left,
        width: leftSidebarCollapsed ? 0 : '200px',
        minWidth: leftSidebarCollapsed ? 0 : '200px',
        borderRight: leftSidebarCollapsed ? 'none' : '1px solid #1e1e2e',
        transition: 'width 0.2s ease, min-width 0.2s ease',
      }}>
        {leftSidebar}
      </aside>

      {/* Center — natural height, page scrolls */}
      <main style={styles.center}>
        {centerWorkspace}
      </main>

      {/* Right Panel — sticky, scrolls internally */}
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
    minHeight: '100vh',
    backgroundColor: '#0d0d14',
    color: '#e2e2ee',
    fontFamily: "'Inter', 'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif",
    alignItems: 'flex-start',
  },
  left: {
    width: '200px',
    minWidth: '200px',
    maxWidth: '200px',
    height: '100vh',
    position: 'sticky',
    top: 0,
    overflowY: 'auto',
    overflowX: 'hidden',
    backgroundColor: '#111118',
    borderRight: '1px solid #1e1e2e',
    display: 'flex',
    flexDirection: 'column',
    flexShrink: 0,
    zIndex: 10,
  },
  center: {
    flex: 1,
    minWidth: 0,
    backgroundColor: '#0d0d14',
    display: 'flex',
    flexDirection: 'column',
  },
  right: {
    width: '300px',
    minWidth: '300px',
    maxWidth: '300px',
    height: '100vh',
    position: 'sticky',
    top: 0,
    overflowY: 'auto',
    overflowX: 'hidden',
    backgroundColor: '#111118',
    borderLeft: '1px solid #1e1e2e',
    display: 'flex',
    flexDirection: 'column',
    flexShrink: 0,
    zIndex: 10,
  },
};


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
    width: '200px',
    minWidth: '200px',
    maxWidth: '200px',
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
    overflow: 'hidden',
    backgroundColor: '#0d0d14',
    display: 'flex',
    flexDirection: 'column',
    minWidth: 0,
  },
  right: {
    width: '300px',
    minWidth: '300px',
    maxWidth: '300px',
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
