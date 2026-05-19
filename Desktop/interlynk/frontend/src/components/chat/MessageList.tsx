import React from 'react';
import { motion } from 'framer-motion';
import {
  MessageCircle,
  Reply,
  MoreHorizontal,
  Smile,
  Paperclip,
  Edit,
  Trash2,
  Flag,
  Copy,
} from 'lucide-react';
import { cn, formatRelativeTime } from '@/lib/utils';
import { Avatar, Button, Badge, Tooltip } from '@/components/ui';
import { useMessageStore, useAuthStore, useChannelStore } from '@/store/useAppStore';
import { messageApi } from '@/api/client';
import type { Message } from '@/types';

const commonEmojis = ['👍', '❤️', '😂', '🎉', '🔥', '👀', '🤔', '😢', '😮', '👏'];

export function MessageList() {
  const { messages, setMessages, deleteMessage } = useMessageStore();
  const { user } = useAuthStore();
  const { currentChannel } = useChannelStore();
  const messagesEndRef = React.useRef<HTMLDivElement>(null);
  const [showReactions, setShowReactions] = React.useState<string | null>(null);
  const [isLoading, setIsLoading] = React.useState(false);
  const [hasLoadedBefore, setHasLoadedBefore] = React.useState(false);
  const [isHydrated, setIsHydrated] = React.useState(false);

  // Handle hydration from localStorage
  React.useEffect(() => {
    // Mark as hydrated after first render
    const timer = setTimeout(() => setIsHydrated(true), 100);
    return () => clearTimeout(timer);
  }, []);

  // Get auth token to ensure API calls have authentication
  const { token } = useAuthStore();
  
  // Fetch messages from API when channel changes - Discord-style: just show selected channel's messages
  React.useEffect(() => {
    let isMounted = true;
    let previousChannelId: string | null = null;
    
    const fetchMessages = async () => {
      console.log('Fetching messages for channel:', currentChannel?.id);
      
      if (!currentChannel?.id) {
        console.log('No channel selected, skipping message fetch');
        return;
      }
      
      // If we're switching to a different channel, clear old messages first
      // This prevents showing messages from the previous channel
      if (previousChannelId && previousChannelId !== String(currentChannel.id)) {
        console.log('Switching channels, clearing old messages');
        setMessages([]);
      }
      previousChannelId = String(currentChannel.id);
      
      // Wait for auth to be ready before making API call
      if (!token || token === 'demo-token') {
        console.log('Auth not ready, waiting...');
        return;
      }
      
      setIsLoading(true);
      try {
        // Always fetch from the database API for the selected channel
        // Fetch more messages (100) to ensure we have history
        console.log('Calling message API for channel:', currentChannel.id);
        const response = await messageApi.getMessages(currentChannel.id, 0, 100);
        console.log('Message API response:', response.data);
        if (response.data && response.data.messages) {
          // Transform backend messages to frontend format
          const transformedMessages: Message[] = response.data.messages.map((msg: any) => ({
            id: String(msg.id),
            content: msg.content,
            channelId: String(msg.channelId),
            senderId: String(msg.sender?.id || ''),
            sender: msg.sender ? {
              id: String(msg.sender.id),
              email: msg.sender.email || '',
              username: msg.sender.username || '',
              displayName: msg.sender.displayName || msg.sender.username || 'Unknown',
              avatar: msg.sender.avatarUrl,
              status: msg.sender.status || 'offline',
              role: msg.sender.role || 'USER',
              createdAt: msg.sender.createdAt || '',
              updatedAt: msg.sender.updatedAt || '',
            } : { id: '1', email: '', username: 'unknown', displayName: 'Unknown', status: 'offline', role: 'USER', createdAt: '', updatedAt: '' },
            attachments: (msg.attachments || []).map((att: any) => ({
              id: String(att.id),
              filename: att.fileName || '',
              url: att.fileUrl || '',
              size: att.fileSize || 0,
              fileType: att.fileType || '',
            })),
            reactions: (msg.reactions || []).map((r: any) => ({
              id: String(r.id || Math.random()),
              emoji: r.emoji,
              userId: String(r.userId || r.user?.id || ''),
              user: r.user ? {
                id: String(r.user.id),
                email: r.user.email || '',
                username: r.user.username || '',
                displayName: r.user.displayName || r.user.username || 'Unknown',
                status: r.user.status || 'offline',
                role: r.user.role || 'USER',
                createdAt: r.user.createdAt || '',
                updatedAt: r.user.updatedAt || '',
              } : { id: '1', email: '', username: 'unknown', displayName: 'Unknown', status: 'offline', role: 'USER', createdAt: '', updatedAt: '' },
              messageId: String(msg.id),
              count: r.count || 1,
              hasReacted: r.hasReacted || false,
            })),
            threadCount: msg.replyCount || 0,
            isEdited: msg.isEdited || false,
            isPinned: msg.isPinned || false,
            createdAt: msg.createdAt,
            updatedAt: msg.updatedAt || '',
            parentId: msg.parentId ? String(msg.parentId) : undefined,
          }));
          
          // Sort messages by creation time (oldest first for display)
          transformedMessages.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
          
          setMessages(transformedMessages);
          setHasLoadedBefore(true);
        } else {
          setMessages([]);
        }
      } catch (error) {
        console.error('Failed to fetch messages:', error);
        // Don't clear messages on error - keep showing current state
        console.log('Error fetching messages, keeping current state');
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    fetchMessages();
    
    return () => {
      isMounted = false;
    };
  }, [currentChannel?.id, token, setMessages]);

  // Handle delete message
  const handleDeleteMessage = async (messageId: string) => {
    try {
      await messageApi.deleteMessage(messageId);
      deleteMessage(messageId);
    } catch (error) {
      console.error('Failed to delete message:', error);
    }
  };

  // Filter messages to show ONLY the current channel's messages - this is critical for channel isolation
  const displayMessages = messages.filter(msg => 
    String(msg.channelId) === String(currentChannel?.id)
  );

  React.useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [displayMessages]);

  const groupedMessages = React.useMemo(() => {
    const groups: { date: string; messages: Message[] }[] = [];
    let currentDate = '';

    displayMessages.forEach((message) => {
      const messageDate = new Date(message.createdAt).toDateString();
      if (messageDate !== currentDate) {
        currentDate = messageDate;
        groups.push({ date: messageDate, messages: [message] });
      } else {
        groups[groups.length - 1].messages.push(message);
      }
    });

    return groups;
  }, [displayMessages]);

  return (
    <div className="p-4 space-y-4">
      {/* Welcome Message - only show when there are no messages and not loading */}
      {displayMessages.length === 0 && !isLoading && (
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-primary to-purple-500 flex items-center justify-center mb-4">
            <span className="text-2xl">👋</span>
          </div>
          <h2 className="text-xl font-bold text-text-primary mb-2">Welcome to #{currentChannel?.name || 'general'}!</h2>
          <p className="text-text-secondary max-w-md">
            This is the start of the #{currentChannel?.name || 'general'} channel. Send a message to get the conversation started!
          </p>
        </div>
      )}

      {/* Loading indicator */}
      {isLoading && (
        <div className="flex items-center justify-center py-4">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      )}

      {/* Messages */}
      {groupedMessages.map((group) => (
        <div key={group.date}>
          {/* Date Divider */}
          <div className="flex items-center gap-4 my-4">
            <div className="flex-1 h-px bg-border" />
            <span className="text-xs text-text-muted font-medium">
              {new Date(group.date).toLocaleDateString('en-US', { 
                weekday: 'long', 
                month: 'long', 
                day: 'numeric' 
              })}
            </span>
            <div className="flex-1 h-px bg-border" />
          </div>

          {/* Messages for this date */}
          {group.messages.map((message, index) => (
            <MessageItem
              key={message.id}
              message={message}
              isOwn={message.senderId === user?.id}
              showAvatar={
                index === 0 ||
                group.messages[index - 1].senderId !== message.senderId
              }
              showTimestamp={
                index === group.messages.length - 1 ||
                group.messages[index + 1].senderId !== message.senderId
              }
              showReactions={showReactions === message.id}
              setShowReactions={setShowReactions}
            />
          ))}
        </div>
      ))}
      <div ref={messagesEndRef} />
    </div>
  );
}

interface MessageItemProps {
  message: Message;
  isOwn: boolean;
  showAvatar: boolean;
  showTimestamp: boolean;
  showReactions: boolean;
  setShowReactions: (id: string | null) => void;
}

function MessageItem({
  message,
  isOwn,
  showAvatar,
  showTimestamp,
  showReactions,
  setShowReactions,
}: MessageItemProps) {
  const [showActions, setShowActions] = React.useState(false);
  const [isReacting, setIsReacting] = React.useState(false);
  const { updateMessage } = useMessageStore();
  const { user } = useAuthStore();
  const { currentChannel } = useChannelStore();
  
  // Frontend security check: determine if user can modify this message
  const userRole = user?.role as string | undefined;
  const canModify = isOwn || userRole === 'ADMIN' || userRole === 'MANAGER';
  // Frontend security check: determine if user can see action buttons
  const canSeeActions = currentChannel?.createdByUsername === user?.username || userRole === 'ADMIN';

  const handleAddReaction = async (emoji: string) => {
    try {
      await messageApi.reactToMessage(message.id, emoji);
      setShowReactions(null);
      setIsReacting(false);

      // Optimistically update the message store so the emoji badge renders
      // immediately without waiting for a WebSocket round-trip.
      const existingReaction = message.reactions.find((r) => r.emoji === emoji);
      if (existingReaction) {
        // Toggle off if current user already reacted, otherwise increment
        updateMessage(message.id, {
          reactions: message.reactions.map((r) =>
            r.emoji === emoji
              ? { ...r, count: r.hasReacted ? Math.max(0, r.count - 1) : r.count + 1, hasReacted: !r.hasReacted }
              : r
          ),
        });
      } else {
        // New emoji — add a new reaction entry
        updateMessage(message.id, {
          reactions: [
            ...message.reactions,
            {
              id: `${message.id}-${emoji}-${Date.now()}`,
              emoji,
              userId: '',   // filled in by WS update if available
              user: { id: '', email: '', username: '', displayName: '', status: 'online' as const, role: 'USER' as const, createdAt: '', updatedAt: '' },
              messageId: message.id,
              count: 1,
              hasReacted: true,
            },
          ],
        });
      }
    } catch (error) {
      console.error('Failed to add reaction:', error);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'group flex gap-4 px-4 hover:bg-background-hover/50 -mx-4 py-1 transition-colors relative',
        showAvatar ? 'mt-4' : 'mt-0.5'
      )}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
    >
      {/* Avatar */}
      {showAvatar ? (
        <Avatar
          src={message.sender.avatar}
          fallback={message.sender.displayName}
          size="md"
          className="flex-shrink-0"
        />
      ) : (
        <div className="w-10 flex-shrink-0" />
      )}

      {/* Content */}
      <div className="flex-1 min-w-0">
        {showAvatar && (
          <div className="flex items-baseline gap-2 mb-1">
            <span className="font-semibold text-text-primary hover:underline cursor-pointer">
              {message.sender.displayName}
            </span>
            <span className="text-xs text-text-muted">
              {formatRelativeTime(message.createdAt)}
            </span>
            {message.isEdited && (
              <span className="text-xs text-text-muted">(edited)</span>
            )}
          </div>
        )}

        {/* Message Content */}
        <div className={cn('text-text-primary break-words', !showAvatar && 'text-sm')}>
          {message.content}
        </div>

        {/* Image Attachments */}
        {message.attachments.filter(att => 
          att.fileType?.startsWith('image/') || /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(att.filename || '')
        ).map((attachment) => (
          <img
            key={attachment.id}
            src={attachment.url}
            alt={attachment.filename}
            className="max-w-xs max-h-48 rounded-lg mt-2"
            loading="lazy"
          />
        ))}

        {/* Non-image Attachments */}
        {message.attachments.filter(att => 
          !att.fileType?.startsWith('image/') && !/\.(jpg|jpeg|png|gif|webp|svg)$/i.test(att.filename || '')
        ).length > 0 && (
          <div className="mt-2 flex flex-wrap gap-2">
            {message.attachments
              .filter(att => 
                !att.fileType?.startsWith('image/') && !/\.(jpg|jpeg|png|gif|webp|svg)$/i.test(att.filename || '')
              )
              .map((attachment) => (
                <a
                  key={attachment.id}
                  href={attachment.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="max-w-xs p-2 bg-surface-elevated border border-border rounded-lg hover:bg-background-hover transition-colors"
                >
                  <p className="text-sm text-text-primary truncate">{attachment.filename}</p>
                  <p className="text-xs text-text-muted">
                    {attachment.size ? (attachment.size / 1024).toFixed(1) + ' KB' : 'File'}
                  </p>
                </a>
              ))}
          </div>
        )}

        {/* Reactions */}
        <div className="flex flex-wrap gap-1 mt-2 items-center">
          {message.reactions.length > 0 && (
            <>
              {message.reactions.map((reaction) => (
                <button
                  key={reaction.id}
                  className={cn(
                    'flex items-center gap-1 px-2 py-0.5 rounded-full text-sm border transition-colors',
                    reaction.hasReacted
                      ? 'bg-primary/20 border-primary/30 text-primary'
                      : 'bg-surface-elevated border-border text-text-secondary hover:border-border-highlight'
                  )}
                  onClick={() => handleAddReaction(reaction.emoji)}
                >
                  <span>{reaction.emoji}</span>
                  <span className="text-xs">{reaction.count}</span>
                </button>
              ))}
            </>
          )}
          
          {/* Add Reaction Button */}
          <button
            className="flex items-center gap-1 px-2 py-0.5 rounded-full text-sm border border-dashed border-border text-text-muted hover:border-border-highlight hover:text-text-secondary transition-colors"
            onClick={() => setIsReacting(!isReacting)}
          >
            <Smile className="w-3.5 h-3.5" />
            <span>+</span>
          </button>
          
          {/* Emoji Picker for Reactions */}
          {isReacting && (
            <div className="flex flex-wrap gap-1 p-2 bg-surface-elevated border border-border rounded-lg shadow-lg">
              {commonEmojis.map((emoji) => (
                <button
                  key={emoji}
                  className="w-8 h-8 flex items-center justify-center hover:bg-background-hover rounded-lg text-lg transition-colors"
                  onClick={() => handleAddReaction(emoji)}
                >
                  {emoji}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Thread preview */}
        {message.threadCount > 0 && (
          <button className="flex items-center gap-2 mt-2 text-sm text-primary hover:underline">
            <MessageCircle className="w-4 h-4" />
            {message.threadCount} {message.threadCount === 1 ? 'reply' : 'replies'}
          </button>
        )}
      </div>

      {/* Action Buttons */}
      {showActions && (
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="absolute -top-3 right-4 flex items-center gap-0.5 p-1 bg-surface-elevated border border-border rounded-lg shadow-lg"
        >
          <Tooltip content="Add reaction">
            <button
              className="p-1.5 hover:bg-background-hover rounded transition-colors"
              onClick={() => setShowReactions(showReactions ? null : message.id)}
            >
              <Smile className="w-4 h-4 text-text-secondary" />
            </button>
          </Tooltip>
          <Tooltip content="Reply in thread">
            <button className="p-1.5 hover:bg-background-hover rounded transition-colors">
              <Reply className="w-4 h-4 text-text-secondary" />
            </button>
          </Tooltip>
          <Tooltip content="More">
            <button className="p-1.5 hover:bg-background-hover rounded transition-colors">
              <MoreHorizontal className="w-4 h-4 text-text-secondary" />
            </button>
          </Tooltip>
        </motion.div>
      )}
    </motion.div>
  );
}

export default MessageList;
