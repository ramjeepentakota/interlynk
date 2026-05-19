import React, { useState, useEffect, useRef } from 'react';
import { AnimatePresence } from 'framer-motion';
import { MessageList } from './MessageList';
import { MessageInput } from './MessageInput';
import { ChannelMembersModal } from './ChannelMembersModal';
import { ScrollArea, Button } from '@/components/ui';
import { Hash, Users, Phone } from 'lucide-react';
import { useChannelStore, useCallStore, useAuthStore } from '@/store/useAppStore';
import { callApi, channelApi } from '@/api/client';
import { cn } from '@/lib/utils';
import { CallDropdown } from '../call/CallDropdown';

export function ChatPanel() {
  const { currentChannel, channels, updateChannel } = useChannelStore();
  const { setInCall, setCurrentCall, setRemoteUser } = useCallStore();
  const { user: currentUser } = useAuthStore();
  const [showMembersModal, setShowMembersModal] = useState(false);
  const [showCallDropdown, setShowCallDropdown] = useState(false);
  const [isInitiatingCall, setIsInitiatingCall] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    if (!showCallDropdown) return;
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowCallDropdown(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showCallDropdown]);

  // Fetch full channel details (including members) when channel changes
  useEffect(() => {
    if (!currentChannel?.id || currentChannel.members) return;
    const fetchChannelDetails = async () => {
      try {
        const response = await channelApi.getChannel(currentChannel.id);
        if (response.data) {
          updateChannel(currentChannel.id, { members: response.data.members });
        }
      } catch (error) {
        console.error('Failed to fetch channel details:', error);
      }
    };
    fetchChannelDetails();
  }, [currentChannel?.id, currentChannel?.members, updateChannel]);

  const handleSelectIndividual = async (member: any, type: 'voice' | 'video') => {
    if (!currentChannel || !currentUser) return;
    setShowCallDropdown(false);
    setIsInitiatingCall(true);

    try {
      // Set remote user for the "Calling..." screen
      setRemoteUser({
        id: String(member.id),
        displayName: member.displayName || member.username || 'Unknown',
        username: member.username || '',
        avatarUrl: member.avatarUrl,
      });

      const response = await callApi.createDirectCall(Number(member.id), type);
      if (response.data) {
        // Initiator must join their own call
        await callApi.joinCall(String(response.data.id));
        setCurrentCall(response.data);
        setInCall(true);
      }

    } catch (error) {
      console.error('Failed to initiate call:', error);
      alert('Failed to start call. Please try again.');
      setRemoteUser(null);
    } finally {
      setIsInitiatingCall(false);
    }
  };

  const handleSelectGroup = async (type: 'voice' | 'video') => {
    if (!currentChannel || !currentUser) return;
    setShowCallDropdown(false);
    setIsInitiatingCall(true);

    try {
      setRemoteUser(null);
      const roomName = `${currentChannel.name} — ${type === 'video' ? 'Video Meeting' : 'Voice Call'}`;
      const response = await callApi.createCall({
        name: roomName,
        type: 'GROUP',
      });
      if (response.data) {
        await callApi.joinCall(String(response.data.id));
        setCurrentCall(response.data);
        setInCall(true);
      }
    } catch (error) {
      console.error('Failed to initiate call:', error);
      alert('Failed to start call. Please try again.');
    } finally {
      setIsInitiatingCall(false);
    }
  };

  // ── Empty states ──────────────────────────────────────────────────────────
  if (!currentChannel && channels.length === 0) {
    return (
      <div className="flex-1 flex flex-col h-full items-center justify-center bg-background-primary">
        <div className="text-center p-8">
          <div className="w-20 h-20 rounded-full bg-surface-elevated flex items-center justify-center mx-auto mb-6">
            <Hash className="w-10 h-10 text-text-muted" />
          </div>
          <h2 className="text-xl font-bold text-text-primary mb-2">Welcome to Interlynk</h2>
          <p className="text-text-secondary max-w-md">
            No channels yet. Create a channel to start chatting with your team!
          </p>
        </div>
      </div>
    );
  }

  if (!currentChannel && channels.length > 0) {
    return (
      <div className="flex-1 flex flex-col h-full items-center justify-center bg-background-primary">
        <div className="text-center p-8">
          <h2 className="text-xl font-bold text-text-primary mb-2">Select a channel</h2>
          <p className="text-text-secondary">
            Choose a channel from the sidebar to view messages.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full">
      {/* Channel Header */}
      <div className="flex-shrink-0 px-4 py-3 border-b border-border bg-surface-elevated">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Hash className="w-5 h-5 text-text-muted" />
            <h2 className="text-lg font-semibold text-text-primary">
              {currentChannel?.name}
            </h2>
            {currentChannel?.description && (
              <span className="text-sm text-text-muted ml-2">
                {currentChannel.description}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {/* Call Button with Dropdown */}
            <div className="relative" ref={dropdownRef}>
              <Button
                id="start-call-btn"
                variant="ghost"
                size="sm"
                onClick={() => setShowCallDropdown((prev) => !prev)}
                disabled={isInitiatingCall}
                className={cn(
                  'text-text-secondary hover:text-primary hover:bg-primary/10 transition-all duration-200',
                  showCallDropdown && 'text-primary bg-primary/10'
                )}
              >
                {isInitiatingCall ? (
                  <div className="w-4 h-4 border border-current border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Phone className="w-4 h-4" />
                )}
              </Button>

              <AnimatePresence>
                {showCallDropdown && (
                  <CallDropdown
                    onSelectIndividual={handleSelectIndividual}
                    onSelectGroup={handleSelectGroup}
                    onClose={() => setShowCallDropdown(false)}
                    isLoading={isInitiatingCall}
                    members={currentChannel?.members || []}
                    currentUser={currentUser}
                    channelName={currentChannel?.name}
                  />
                )}
              </AnimatePresence>
            </div>

            <div className="w-px h-4 bg-border mx-1" />

            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowMembersModal(true)}
              className="text-text-secondary hover:text-text-primary"
            >
              <Users className="w-4 h-4 mr-1" />
              <span className="text-xs">Members</span>
            </Button>
          </div>
        </div>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-hidden">
        <ScrollArea className="h-full">
          <MessageList />
        </ScrollArea>
      </div>

      {/* Message Input */}
      <div className="flex-shrink-0 p-4">
        <MessageInput />
      </div>

      {/* Channel Members Modal */}
      <ChannelMembersModal
        isOpen={showMembersModal}
        onClose={() => setShowMembersModal(false)}
      />
    </div>
  );
}

export default ChatPanel;
