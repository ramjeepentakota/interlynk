import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Hash,
  Volume2,
  Video,
  MessageSquare,
  Users,
  Settings,
  ChevronDown,
  Plus,
  Search,
  Bell,
  Phone,
  HelpCircle,
  Sparkles,
  Command,
  Code,
  Database,
  Folder,
  GitBranch,
  Terminal,
  X,
  Pencil,
  Trash2,
  MoreVertical,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Avatar, Badge, ScrollArea, Tooltip, Button, Input } from '@/components/ui';
import { useUIStore, useAuthStore, useWorkspaceStore, useChannelStore, useVoiceStore } from '@/store/useAppStore';
import { channelApi, callApi } from '@/api/client';
import type { Channel, ChannelType, CallRoom, CallParticipant } from '@/types';

export function Sidebar() {
  const { sidebarOpen, toggleSidebar } = useUIStore();
  const { currentWorkspace } = useWorkspaceStore();
  const { currentChannel, setCurrentChannel, channels, setChannels } = useChannelStore();
  const { user, isAuthenticated, token } = useAuthStore();
  const { currentVoiceChannel, setCurrentVoiceChannel, isInVoiceChannel, setInVoiceChannel } = useVoiceStore();
  const [channelsExpanded, setChannelsExpanded] = React.useState(true);
  const [voiceExpanded, setVoiceExpanded] = React.useState(true);
  const [membersExpanded, setMembersExpanded] = React.useState(true);
  const [showCreateChannel, setShowCreateChannel] = React.useState(false);
  const [newChannelName, setNewChannelName] = React.useState('');
  const [newChannelType, setNewChannelType] = React.useState<ChannelType>('TEXT');
  const [voiceChannels, setVoiceChannels] = React.useState<CallRoom[]>([]);
  const [isLoadingChannels, setIsLoadingChannels] = React.useState(false);
  const [isLoadingVoice, setIsLoadingVoice] = React.useState(false);

  // Fetch channels from API on mount
  React.useEffect(() => {
    // Only fetch if user is authenticated
    if (!isAuthenticated || !token) {
      return;
    }
    
    const fetchChannels = async () => {
      setIsLoadingChannels(true);
      try {
        const response = await channelApi.getChannels();
        if (response.data && Array.isArray(response.data)) {
          // Transform API response to Channel type
          const transformedChannels: Channel[] = response.data.map((ch: any) => ({
            id: String(ch.id),
            name: ch.name,
            type: ch.type as ChannelType,
            workspaceId: '1',
            isPrivate: ch.type === 'PRIVATE',
            position: 0,
            unreadCount: 0,
            createdAt: ch.createdAt,
            updatedAt: ch.createdAt,
            description: ch.description,
          }));
          setChannels(transformedChannels);
          
          // Only set first channel as default if NO channel is currently selected
          // This avoids overwriting the persisted channel during hydration on refresh
          const { currentChannel: existingChannel } = useChannelStore.getState();
          if (transformedChannels.length > 0 && !existingChannel) {
            setCurrentChannel(transformedChannels[0]);
          }
        }
      } catch (error) {
        console.error('Failed to fetch channels:', error);
      } finally {
        setIsLoadingChannels(false);
      }
    };

    fetchChannels();
  }, [isAuthenticated, token]);

  // Fetch voice channels (active call rooms)
  React.useEffect(() => {
    // Only fetch if user is authenticated
    if (!isAuthenticated || !token) {
      return;
    }
    
    const fetchVoiceChannels = async () => {
      setIsLoadingVoice(true);
      try {
        const response = await callApi.getActiveCalls();
        if (response.data && Array.isArray(response.data)) {
          // Filter only voice channel type (VOICE_CHANNEL or GROUP types from backend)
          const voiceRooms = response.data.filter((room: any) => 
            room.type === 'VOICE_CHANNEL' || room.type === 'GROUP'
          );
          setVoiceChannels(voiceRooms);
        }
      } catch (error) {
        console.error('Failed to fetch voice channels:', error);
      } finally {
        setIsLoadingVoice(false);
      }
    };

    fetchVoiceChannels();
    
    // Refresh voice channels every 10 seconds
    const interval = setInterval(fetchVoiceChannels, 10000);
    return () => clearInterval(interval);
  }, [isAuthenticated, token]);

  const handleCreateChannel = async () => {
    if (!newChannelName.trim()) return;
    
    try {
      const response = await channelApi.createChannel({
        name: newChannelName.trim(),
        type: 'PUBLIC', // Use PUBLIC instead of newChannelType to match backend enum
        description: '',
      });
      
      if (response.data) {
        const newChannel: Channel = {
          id: String(response.data.id),
          name: response.data.name,
          type: (response.data.type || 'PUBLIC') as ChannelType,
          workspaceId: '1',
          isPrivate: response.data.type === 'PRIVATE',
          position: channels.length,
          unreadCount: 0,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        setChannels([...channels, newChannel]);
        setShowCreateChannel(false);
        setNewChannelName('');
      }
    } catch (error: any) {
      console.error('Failed to create channel:', error);
      alert(error.response?.data?.message || 'Failed to create channel');
    }
  };

  const handleDeleteChannel = async (channelId: string) => {
    try {
      await channelApi.deleteChannel(channelId);
      // Remove the deleted channel from the list
      const updatedChannels = channels.filter((ch) => ch.id !== channelId);
      setChannels(updatedChannels);
      // If the deleted channel was current, select another one
      if (currentChannel?.id === channelId && updatedChannels.length > 0) {
        setCurrentChannel(updatedChannels[0]);
      }
    } catch (error: any) {
      console.error('Failed to delete channel:', error);
      alert(error.response?.data?.message || 'Failed to delete channel');
    }
  };

  return (
    <AnimatePresence mode="wait">
      {sidebarOpen && (
        <motion.aside
          initial={{ width: 0, opacity: 0 }}
          animate={{ width: 260, opacity: 1 }}
          exit={{ width: 0, opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="h-screen bg-background-secondary border-r border-border flex flex-col overflow-hidden"
        >
          {/* Workspace Header */}
          <div className="h-14 px-4 flex items-center justify-between border-b border-border flex-shrink-0">
            <button className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-background-hover transition-colors w-full">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-purple-500 flex items-center justify-center">
                <span className="text-white font-bold text-sm">I</span>
              </div>
              <div className="flex-1 text-left">
                <h1 className="font-semibold text-text-primary text-sm">Interlynk</h1>
                <p className="text-xs text-text-muted">Free Plan</p>
              </div>
              <ChevronDown className="w-4 h-4 text-text-secondary" />
            </button>
          </div>

          <ScrollArea className="flex-1">
            <div className="p-2 space-y-4">
              {/* Text Channels */}
              <div>
                <div
                  role="button"
                  onClick={() => setChannelsExpanded(!channelsExpanded)}
                  className="flex items-center justify-between w-full px-2 py-1 text-xs font-medium text-text-secondary hover:text-text-primary transition-colors cursor-pointer"
                >
                  <span className="flex items-center gap-1">
                    <ChevronDown className={cn('w-3 h-3 transition-transform', !channelsExpanded && '-rotate-90')} />
                    TEXT CHANNELS
                  </span>
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowCreateChannel(true);
                    }}
                    className="hover:text-text-primary"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
                
                {/* Create Channel Form */}
                {showCreateChannel && (
                  <div className="mt-2 mb-2 p-2 bg-background-hover rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <Input
                        placeholder="channel-name"
                        value={newChannelName}
                        onChange={(e) => setNewChannelName(e.target.value.toLowerCase().replace(/\s+/g, '-'))}
                        className="h-8 text-sm"
                      />
                      <button 
                        onClick={() => setShowCreateChannel(false)}
                        className="p-1 hover:bg-background-secondary rounded"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="flex gap-2">
                      <select
                        value={newChannelType}
                        onChange={(e) => setNewChannelType(e.target.value as ChannelType)}
                        className="flex-1 h-8 text-xs bg-background-secondary border border-border rounded px-2 text-text-primary"
                      >
                        <option value="TEXT">Text</option>
                        <option value="ANNOUNCEMENT">Announcement</option>
                      </select>
                      <Button size="sm" onClick={handleCreateChannel} className="h-8">
                        Create
                      </Button>
                    </div>
                  </div>
                )}
                
                {channelsExpanded && (
                  <div className="mt-1 space-y-0.5">
                    {isLoadingChannels ? (
                      <div className="px-2 py-1.5 text-xs text-text-muted">Loading...</div>
                    ) : channels.length === 0 ? (
                      <div className="px-2 py-1.5 text-xs text-text-muted">No channels yet</div>
                    ) : (
                      channels.map((channel) => (
                        <ChannelItem
                          key={channel.id}
                          channel={channel}
                          isActive={currentChannel?.id === channel.id}
                          onClick={() => setCurrentChannel(channel)}
                          onDelete={handleDeleteChannel}
                        />
                      ))
                    )}
                  </div>
                )}
              </div>

              {/* Voice Channels */}
              <div>
                <div
                  role="button"
                  onClick={() => setVoiceExpanded(!voiceExpanded)}
                  className="flex items-center justify-between w-full px-2 py-1 text-xs font-medium text-text-secondary hover:text-text-primary transition-colors cursor-pointer"
                >
                  <span className="flex items-center gap-1">
                    <ChevronDown className={cn('w-3 h-3 transition-transform', !voiceExpanded && '-rotate-90')} />
                    VOICE CHANNELS
                  </span>
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      handleCreateVoiceChannel();
                    }}
                    className="hover:text-text-primary"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
                {voiceExpanded && (
                  <div className="mt-1 space-y-0.5">
                    {isLoadingVoice ? (
                      <div className="px-2 py-1.5 text-xs text-text-muted">Loading...</div>
                    ) : voiceChannels.length === 0 ? (
                      <div className="px-2 py-1.5 text-xs text-text-muted">No voice channels active</div>
                    ) : (
                      voiceChannels.map((room) => (
                        <VoiceChannelItem
                          key={room.id}
                          room={room}
                          isActive={currentVoiceChannel?.id === String(room.id)}
                          onJoin={() => handleJoinVoiceChannel(room)}
                          onLeave={() => handleLeaveVoiceChannel(room)}
                        />
                      ))
                    )}
                  </div>
                )}
              </div>

              {/* Code Repositories */}
              <div>
                <button className="flex items-center justify-between w-full px-2 py-1 text-xs font-medium text-text-secondary hover:text-text-primary transition-colors">
                  <span className="flex items-center gap-1">
                    <Code className="w-3 h-3" />
                    CODE
                  </span>
                  <Plus className="w-4 h-4 hover:text-text-primary" />
                </button>
              </div>
            </div>
          </ScrollArea>

          {/* User Panel */}
          <div className="h-16 px-2 flex items-center gap-2 border-t border-border bg-background-primary flex-shrink-0">
            <div className="relative">
              <Avatar
                src={user?.avatar}
                fallback={user?.displayName || 'User'}
                size="sm"
                status="online"
              />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-text-primary truncate">
                {user?.displayName || 'User'}
              </p>
              <p className="text-xs text-text-muted truncate">#{user?.username || 'user'}</p>
            </div>
            <div className="flex items-center gap-1">
              <Tooltip content="Mute">
                <Button variant="ghost" size="icon" className="w-8 h-8">
                  <Volume2 className="w-4 h-4" />
                </Button>
              </Tooltip>
              <Tooltip content="Settings">
                <Button variant="ghost" size="icon" className="w-8 h-8">
                  <Settings className="w-4 h-4" />
                </Button>
              </Tooltip>
            </div>
          </div>
        </motion.aside>
      )}
    </AnimatePresence>
  );

  async function handleJoinVoiceChannel(room: CallRoom) {
    try {
      await callApi.joinCall(String(room.id));
      // Transform CallParticipant to VoiceParticipant
      const voiceParticipants = (room.participants || []).map((p: any) => ({
        userId: p.userId,
        user: p.user,
        channelId: String(room.id),
        isMuted: p.isMuted || false,
        isDeafened: false,
        isSpeaking: false,
        joinedAt: p.joinedAt || new Date().toISOString(),
      }));
      
      const voiceChannel = {
        id: String(room.id),
        channelId: String(room.id),
        channel: {
          id: String(room.id),
          name: room.name || 'Voice Channel',
          type: 'VOICE' as ChannelType,
          workspaceId: '1',
          isPrivate: false,
          position: 0,
          unreadCount: 0,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        participants: voiceParticipants,
      };
      setCurrentVoiceChannel(voiceChannel);
      setInVoiceChannel(true);
    } catch (error) {
      console.error('Failed to join voice channel:', error);
    }
  }

  async function handleCreateVoiceChannel() {
    const channelName = prompt('Enter voice channel name:');
    if (!channelName || !channelName.trim()) return;
    
    try {
      const response = await callApi.createCall({
        name: channelName.trim(),
        type: 'VOICE_CHANNEL',
      });
      
      if (response.data) {
        setVoiceChannels([...voiceChannels, response.data]);
      }
    } catch (error) {
      console.error('Failed to create voice channel:', error);
    }
  }

  async function handleLeaveVoiceChannel(room: CallRoom) {
    try {
      await callApi.leaveCall(String(room.id));
      setInVoiceChannel(false);
      setCurrentVoiceChannel(null);
    } catch (error) {
      console.error('Failed to leave voice channel:', error);
    }
  }
}

interface ChannelItemProps {
  channel: Channel;
  isActive: boolean;
  onClick: () => void;
  onDelete?: (channelId: string) => void;
}

function ChannelItem({ channel, isActive, onClick, onDelete }: ChannelItemProps & { onDelete?: (channelId: string) => void }) {
  const [showMenu, setShowMenu] = React.useState(false);
  
  const getIcon = () => {
    switch (channel.type) {
      case 'TEXT':
        return <Hash className="w-4 h-4" />;
      case 'VOICE':
        return <Volume2 className="w-4 h-4" />;
      case 'VIDEO':
        return <Video className="w-4 h-4" />;
      default:
        return <Hash className="w-4 h-4" />;
    }
  };

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onDelete && confirm(`Are you sure you want to delete "${channel.name}" channel?`)) {
      onDelete(channel.id);
    }
    setShowMenu(false);
  };

  return (
    <div className="relative group">
      <div
        role="button"
        tabIndex={0}
        onClick={onClick}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onClick(); }}
        className={cn(
          'w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-sm transition-all duration-150 cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-primary',
          isActive
            ? 'bg-primary/10 text-primary'
            : 'text-text-secondary hover:bg-background-hover hover:text-text-primary'
        )}
      >
        {getIcon()}
        <span className="flex-1 text-left truncate">{channel.name}</span>
        {channel.unreadCount > 0 && (
          <Badge variant="primary" size="sm">
            {channel.unreadCount}
          </Badge>
        )}
        <button
          onClick={(e) => {
            e.stopPropagation();
            setShowMenu(!showMenu);
          }}
          className="opacity-0 group-hover:opacity-100 p-0.5 hover:bg-background-secondary rounded transition-opacity"
        >
          <MoreVertical className="w-3 h-3" />
        </button>
      </div>
      
      {/* Dropdown menu */}
      {showMenu && (
        <div className="absolute right-1 top-full mt-1 w-36 bg-background-secondary border border-border rounded-lg shadow-lg py-1 z-50">
          <button
            onClick={handleDeleteClick}
            className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-red-400 hover:bg-background-hover transition-colors"
          >
            <Trash2 className="w-4 h-4" />
            Delete Channel
          </button>
        </div>
      )}
    </div>
  );
}

interface VoiceChannelItemProps {
  room: CallRoom;
  isActive: boolean;
  onJoin: () => void;
  onLeave: () => void;
}

function VoiceChannelItem({ room, isActive, onJoin, onLeave }: VoiceChannelItemProps) {
  const { isInVoiceChannel } = useVoiceStore();
  const participantCount = room.participants?.length || 0;

  const handleClick = () => {
    if (isActive && isInVoiceChannel) {
      onLeave();
    } else {
      onJoin();
    }
  };

  return (
    <button 
      onClick={handleClick}
      className={cn(
        'w-full flex items-center gap-2 px-2 py-2 rounded-lg text-sm transition-all duration-150',
        isActive && isInVoiceChannel
          ? 'bg-success/20 text-success' 
          : 'text-text-secondary hover:bg-background-hover hover:text-text-primary'
      )}
    >
      <Volume2 className="w-4 h-4" />
      <span className="flex-1 text-left truncate">{room.name || 'Voice Channel'}</span>
      {participantCount > 0 && (
        <span className="text-xs flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-success animate-pulse" />
          {participantCount}
        </span>
      )}
    </button>
  );
}

export default Sidebar;
