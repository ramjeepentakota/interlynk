import React, { useState, useEffect } from 'react';
import { X, UserPlus, UserMinus, Search, Users, Shield } from 'lucide-react';
import { Button, Input, Avatar } from '@/components/ui';
import { channelApi, authApi } from '@/api/client';
import { useChannelStore, useAuthStore } from '@/store/useAppStore';
import type { ChannelMember, User } from '@/types';

interface ChannelMembersModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ChannelMembersModal({ isOpen, onClose }: ChannelMembersModalProps) {
  const { currentChannel, updateChannel } = useChannelStore();
  const { user } = useAuthStore();
  const [members, setMembers] = useState<ChannelMember[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<User[]>([]);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Check if current user can manage members (creator or admin)
  const canManageMembers = currentChannel?.createdByUsername === user?.username || user?.role === 'ADMIN';

  useEffect(() => {
    if (isOpen && currentChannel?.id) {
      fetchChannelMembers();
    }
  }, [isOpen, currentChannel?.id]);

  const fetchChannelMembers = async () => {
    if (!currentChannel?.id) return;
    
    setLoading(true);
    try {
      const response = await channelApi.getChannel(currentChannel.id);
      const channelData = response.data;
      if (channelData.members) {
        setMembers(channelData.members.map((m: any) => ({
          id: String(m.id),
          username: m.username,
          displayName: m.displayName || m.username,
          avatarUrl: m.avatarUrl,
          role: m.role || 'MEMBER',
          joinedAt: m.joinedAt || new Date().toISOString(),
        })));
      }
    } catch (err) {
      console.error('Failed to fetch channel members:', err);
      setError('Failed to load channel members');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async (query: string) => {
    setSearchQuery(query);
    if (query.length < 2) {
      setSearchResults([]);
      return;
    }
    
    setSearching(true);
    try {
      const response = await authApi.searchUsers(query);
      // Filter out users who are already members
      const existingMemberIds = members.map(m => m.username);
      const filtered = (response.data || []).filter(
        (u: any) => !existingMemberIds.includes(u.username)
      );
      setSearchResults(filtered);
    } catch (err) {
      console.error('Failed to search users:', err);
    } finally {
      setSearching(false);
    }
  };

  const handleAddMember = async (username: string) => {
    if (!currentChannel?.id) return;
    
    try {
      const response = await channelApi.addMember(currentChannel.id, username);
      // Update channel in store with new member count and members
      updateChannel(currentChannel.id, {
        memberCount: response.data.memberCount,
        members: response.data.members?.map((m: any) => ({
          id: String(m.id),
          username: m.username,
          displayName: m.displayName || m.username,
          avatarUrl: m.avatarUrl,
          role: m.role || 'MEMBER',
          joinedAt: m.joinedAt,
        })),
      });
      // Refresh members list
      await fetchChannelMembers();
      setSearchQuery('');
      setSearchResults([]);
    } catch (err: any) {
      console.error('Failed to add member:', err);
      setError(err.response?.data?.message || 'Failed to add member');
    }
  };

  const handleRemoveMember = async (username: string) => {
    if (!currentChannel?.id) return;
    
    try {
      await channelApi.removeMember(currentChannel.id, username);
      // Remove from local state
      setMembers(members.filter(m => m.username !== username));
    } catch (err: any) {
      console.error('Failed to remove member:', err);
      setError(err.response?.data?.message || 'Failed to remove member');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-surface-elevated rounded-lg shadow-xl w-full max-w-md mx-4 max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-text-secondary" />
            <h2 className="text-lg font-semibold text-text-primary">
              Manage Members - #{currentChannel?.name}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-background-hover rounded transition-colors"
          >
            <X className="w-5 h-5 text-text-secondary" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
              {error}
            </div>
          )}

          {/* Add Member Section - Only for creators/admins */}
          {canManageMembers && (
            <div className="space-y-2">
              <label className="text-sm font-medium text-text-secondary">
                Add New Members
              </label>
              <div className="relative">
                <Input
                  type="text"
                  placeholder="Search users to add..."
                  value={searchQuery}
                  onChange={(e) => handleSearch(e.target.value)}
                  className="pr-10"
                />
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
              </div>
              
              {/* Search Results */}
              {searchResults.length > 0 && (
                <div className="bg-background border border-border rounded-lg overflow-hidden">
                  {searchResults.map((result: any) => (
                    <div
                      key={result.username}
                      className="flex items-center justify-between p-3 hover:bg-background-hover transition-colors border-b border-border last:border-b-0"
                    >
                      <div className="flex items-center gap-3">
                        <Avatar
                          src={result.avatar || result.avatarUrl}
                          fallback={result.displayName || result.username}
                          size="sm"
                        />
                        <div>
                          <p className="text-sm font-medium text-text-primary">
                            {result.displayName || result.username}
                          </p>
                          <p className="text-xs text-text-muted">@{result.username}</p>
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleAddMember(result.username)}
                        className="text-primary hover:text-primary/80"
                      >
                        <UserPlus className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Members List */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-text-secondary">
              Current Members ({members.length})
            </label>
            
            {loading ? (
              <div className="text-center py-4 text-text-muted">Loading...</div>
            ) : members.length === 0 ? (
              <div className="text-center py-4 text-text-muted">No members found</div>
            ) : (
              <div className="bg-background border border-border rounded-lg overflow-hidden">
                {members.map((member) => (
                  <div
                    key={member.id}
                    className="flex items-center justify-between p-3 hover:bg-background-hover transition-colors border-b border-border last:border-b-0"
                  >
                    <div className="flex items-center gap-3">
                      <Avatar
                        src={member.avatarUrl}
                        fallback={member.displayName || member.username}
                        size="sm"
                      />
                      <div>
                        <p className="text-sm font-medium text-text-primary">
                          {member.displayName || member.username}
                          {member.username === currentChannel?.createdByUsername && (
                            <span className="ml-2 text-xs text-primary">(Owner)</span>
                          )}
                          {member.username === user?.username && (
                            <span className="ml-2 text-xs text-text-muted">(You)</span>
                          )}
                        </p>
                        <p className="text-xs text-text-muted">@{member.username}</p>
                      </div>
                    </div>
                    
                    {/* Remove Button - Only for creators/admins, and not for owner or self */}
                    {canManageMembers && 
                     member.username !== currentChannel?.createdByUsername && 
                     member.username !== user?.username && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleRemoveMember(member.username)}
                        className="text-red-400 hover:text-red-300"
                      >
                        <UserMinus className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-border">
          <Button onClick={onClose} className="w-full">
            Done
          </Button>
        </div>
      </div>
    </div>
  );
}

export default ChannelMembersModal;
