import React from 'react';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';
import { RightSidebar } from './RightSidebar';
import { useWebSocket } from '@/hooks/useWebSocket';
import { useCallStore } from '@/store/useAppStore';
import { CallPanel } from '@/components/call/CallPanel';
import { IncomingCallOverlay } from '@/components/call/IncomingCallOverlay';

interface MainLayoutProps {
  children: React.ReactNode;
}

export function MainLayout({ children }: MainLayoutProps) {
  // Initialize WebSocket connection for real-time messaging + call signals
  useWebSocket();

  const { isInCall } = useCallStore();

  return (
    <div className="h-screen w-screen flex overflow-hidden bg-background-primary">
      {/* Left Sidebar */}
      <Sidebar />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Bar */}
        <TopBar />

        {/* Content Area */}
        <main className="flex-1 flex overflow-hidden">
          {/* Center Content — replaced by CallPanel when in a call */}
          <div className="flex-1 min-w-0 overflow-hidden">
            {isInCall ? <CallPanel /> : children}
          </div>

          {/* Right Sidebar */}
          {!isInCall && <RightSidebar />}
        </main>
      </div>

      {/* Global Incoming Call Overlay — visible regardless of current page */}
      <IncomingCallOverlay />
    </div>
  );
}

export default MainLayout;
