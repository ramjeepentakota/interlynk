import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  Users,
  Info,
  MessageSquare,
  AtSign,
  Pin,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Avatar, Badge, Button, ScrollArea, Tooltip } from '@/components/ui';
import { useUIStore, useChannelStore } from '@/store/useAppStore';
import { channelApi } from '@/api/client';
import type { Channel } from '@/types';

interface Member {
  id: string;
  displayName: string;
  role: string;
  avatar?: string;
  status: 'online' | 'away' | 'busy' | 'offline';
}

export function RightSidebar() {
  const { rightSidebarOpen, toggleRightSidebar } = useUIStore();
  const { currentChannel } = useChannelStore();
  const [activeTab, setActiveTab] = React.useState<'members' | 'info'>('members');
  const [members, setMembers] = React.useState<Member[]>([]);
  const [isLoadingMembers, setIsLoadingMembers] = React.useState(false);

  // Fetch channel members when channel changes
  React.useEffect(() => {
    const fetchMembers = async () => {
      if (!currentChannel?.id) {
        setMembers([]);
        return;
      }

      setIsLoadingMembers(true);
      try {
        // Get channel details which includes members
        const response = await channelApi.getChannel(currentChannel.id);
        if (response.data && response.data.members) {
          const transformedMembers: Member[] = response.data.members.map((user: any) => ({
            id: String(user.id),
            displayName: user.displayName || user.username || 'Unknown',
            role: user.role || 'USER',
            avatar: user.avatarUrl,
            status: user.presence || 'offline',
          }));
          setMembers(transformedMembers);
        } else {
          setMembers([]);
        }
      } catch (error) {
        console.error('Failed to fetch members:', error);
        setMembers([]);
      } finally {
        setIsLoadingMembers(false);
      }
    };

    fetchMembers();
  }, [currentChannel?.id]);

  // Handle real-time presence updates
  React.useEffect(() => {
    const handlePresenceUpdate = (event: any) => {
      const { username, userId, status } = event.detail;
      setMembers(prev => prev.map(member =>
        (member.id === userId || member.id === username || member.displayName === username)
          ? { ...member, status: status as any }
          : member
      ));
    };

    window.addEventListener('user-presence-update', handlePresenceUpdate);
    return () => window.removeEventListener('user-presence-update', handlePresenceUpdate);
  }, []);

  return (
    <AnimatePresence mode="wait">
      {rightSidebarOpen && (
        <motion.aside
          initial={{ width: 0, opacity: 0 }}
          animate={{ width: 260, opacity: 1 }}
          exit={{ width: 0, opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="h-screen bg-background-secondary border-l border-border flex flex-col overflow-hidden"
        >
          {/* Header */}
          <div className="h-12 px-4 flex items-center justify-between border-b border-border flex-shrink-0">
            <div className="flex gap-1">
              <button
                onClick={() => setActiveTab('members')}
                className={cn(
                  'px-3 py-1.5 text-sm font-medium rounded-lg transition-colors',
                  activeTab === 'members'
                    ? 'bg-primary/10 text-primary'
                    : 'text-text-secondary hover:text-text-primary hover:bg-background-hover'
                )}
              >
                Members
              </button>
              <button
                onClick={() => setActiveTab('info')}
                className={cn(
                  'px-3 py-1.5 text-sm font-medium rounded-lg transition-colors',
                  activeTab === 'info'
                    ? 'bg-primary/10 text-primary'
                    : 'text-text-secondary hover:text-text-primary hover:bg-background-hover'
                )}
              >
                Info
              </button>
            </div>
            <Button variant="ghost" size="icon" className="w-8 h-8" onClick={toggleRightSidebar}>
              <X className="w-4 h-4" />
            </Button>
          </div>

          <ScrollArea className="flex-1">
            {activeTab === 'members' ? (
              isLoadingMembers ? (
                <div className="p-4 text-center text-text-muted">Loading members...</div>
              ) : members.length > 0 ? (
                <MembersList members={members} />
              ) : (
                <div className="p-4 text-center text-text-muted">
                  No members in this channel.\nInvite members to get started.
                </div>
              )
            ) : (
              <ChannelInfo channel={currentChannel} />
            )}
          </ScrollArea>
        </motion.aside>
      )}
    </AnimatePresence>
  );
}

interface Member {
  id: string;
  displayName: string;
  role: string;
  avatar?: string;
  status: 'online' | 'away' | 'busy' | 'offline';
}

function MembersList({ members }: { members: Member[] }) {
  const onlineMembers = members.filter(m => m.status === 'online');
  const offlineMembers = members.filter(m => m.status !== 'online');

  return (
    <div className="p-2">
      {/* Online Section */}
      <div className="mb-4">
        <h3 className="px-2 py-1 text-xs font-semibold text-text-muted uppercase tracking-wider">
          Online — {onlineMembers.length}
        </h3>
        <div className="mt-1 space-y-0.5">
          {onlineMembers.map((member) => (
            <MemberItem key={member.id} member={member} /> // Fixed: Added closing parenthesis
          ))}
        </div>
      </div>

      {/* Offline Section */}
      <div>
        <h3 className="px-2 py-1 text-xs font-semibold text-text-muted uppercase tracking-wider">
          Offline — {offlineMembers.length}
        </h3>
        <div className="mt-1 space-y-0.5">
          {offlineMembers.map((member) => (
            <MemberItem key={member.id} member={member} />
          ))}
        </div>
      </div>
    </div>
  );
}

function MemberItem({ member }: { member: Member }) {
  const [showTooltip, setShowTooltip] = React.useState(false);

  return (
    <div
      className="relative flex items-center gap-3 px-2 py-1.5 rounded-lg hover:bg-background-hover cursor-pointer group"
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
    >
      <div className="relative">
        <Avatar src={member.avatar} fallback={member.displayName} size="sm" status={member.status} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-text-primary truncate">
          {member.displayName}
        </p>
        <p className="text-xs text-text-muted truncate">
          {member.role}
        </p>
      </div>

      {/* Context Menu Trigger */}
      <button className="opacity-0 group-hover:opacity-100 p-1 hover:bg-background-tertiary rounded transition-opacity">
        <AtSign className="w-3 h-3 text-text-muted" />
      </button>

      {/* Hover Card */}
      {showTooltip && (
        <div className="absolute left-full top-0 ml-2 w-48 bg-surface-overlay border border-border rounded-lg shadow-xl p-3 z-50">
          <div className="flex items-center gap-2 mb-2">
            <Avatar src={member.avatar} fallback={member.displayName} size="md" status={member.status} />
            <div>
              <p className="font-medium text-text-primary">{member.displayName}</p>
              <p className="text-xs text-text-muted">{member.role}</p>
            </div>
          </div>
          <div className="flex gap-1">
            <Button variant="secondary" size="sm" className="flex-1">
              <MessageSquare className="w-3 h-3" />
              Message
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function ChannelInfo({ channel }: { channel: Channel | null }) {
  return (
    <div className="p-4 space-y-6">
      {/* Description */}
      <div>
        <h3 className="text-sm font-semibold text-text-primary mb-2">About</h3>
        <p className="text-sm text-text-secondary">
          {channel?.description || 'No description available.'}
        </p>
      </div>

      {/* Channel Details */}
      <div>
        <h3 className="text-sm font-semibold text-text-primary mb-2">Details</h3>
        <div className="space-y-1 text-sm text-text-secondary">
          <div className="flex justify-between">
            <span>Name</span>
            <span>#{channel?.name || 'unknown'}</span>
          </div>
          <div className="flex justify-between">
            <span>Type</span>
            <span>{channel?.type || 'TEXT'}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default RightSidebar;
