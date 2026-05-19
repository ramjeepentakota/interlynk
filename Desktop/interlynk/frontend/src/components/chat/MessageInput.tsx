import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Send,
  Paperclip,
  Smile,
  AtSign,
  X,
  Search,
  Image,
  FileText,
  File,
  Upload,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button, Tooltip } from '@/components/ui';
import { useMessageStore, useAuthStore, useTypingStore, useChannelStore } from '@/store/useAppStore';
import { messageApi, authApi } from '@/api/client';
import type { Message, User } from '@/types';

const commonEmojis = ['👍', '❤️', '😂', '🎉', '🔥', '👀', '🤔', '😢'];

export function MessageInput() {
  const [message, setMessage] = React.useState('');
  const [showEmojiPicker, setShowEmojiPicker] = React.useState(false);
  const [showMentionPicker, setShowMentionPicker] = React.useState(false);
  const [mentionQuery, setMentionQuery] = React.useState('');
  const [mentionUsers, setMentionUsers] = React.useState<User[]>([]);
  const [selectedMentionIndex, setSelectedMentionIndex] = React.useState(0);
  const [error, setError] = React.useState<string | null>(null);
  const [selectedFile, setSelectedFile] = React.useState<File | null>(null);
  const [isUploading, setIsUploading] = React.useState(false);
  const [showFileTypePicker, setShowFileTypePicker] = React.useState(false);
  const fileTypePickerRef = React.useRef<HTMLDivElement>(null);
  const { isSending, setSending } = useMessageStore();
  const { user } = useAuthStore();
  const { typingUsers } = useTypingStore();
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const mentionDropdownRef = React.useRef<HTMLDivElement>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((!message.trim() && !selectedFile) || isSending) return;
    
    const { currentChannel } = useChannelStore.getState();
    const { user } = useAuthStore.getState();
    const { addMessage } = useMessageStore.getState();

    if (!currentChannel?.id) {
      setError('Please select a channel first');
      return;
    }

    setSending(true);
    setError(null);
    
    try {
      let attachmentUrl = '';
      let attachmentName = '';
      
      // Upload file first if selected
      if (selectedFile) {
        const formData = new FormData();
        formData.append('file', selectedFile);
        
        try {
          const uploadResponse = await messageApi.uploadAttachment(currentChannel.id, formData);
          const attachment = uploadResponse.data;
          attachmentUrl = attachment.fileUrl;
          attachmentName = attachment.fileName;
        } catch (uploadErr: any) {
          console.error('Failed to upload file:', uploadErr);
          setError(uploadErr.response?.data?.message || 'Failed to upload file');
          setSending(false);
          return;
        }
      }
      
      // Build message content — keep plain text only.
      // Do NOT append a markdown link for the attachment; it renders as an
      // image/file widget via the attachments array, not as inline text.
      const messageContent = message.trim() || (selectedFile ? ' ' : '');
      const attachments: Array<{ filename: string; url: string; size: number; fileType: string }> =
        attachmentUrl && selectedFile
          ? [{ filename: attachmentName, url: attachmentUrl, size: selectedFile.size, fileType: selectedFile.type }]
          : [];
      
      // Send to backend — get the server-assigned ID back so we can add it
      // to the store optimistically. addMessage() is IDEMPOTENT (deduplicates
      // by ID), so the WebSocket broadcast arriving shortly after is a no-op.
      const response = await messageApi.sendMessage(currentChannel.id, messageContent, undefined, attachments);
      const backendMessage = response.data;

      const newMessage: Message = {
        id: String(backendMessage.id),
        content: backendMessage.content,
        channelId: String(backendMessage.channelId),
        senderId: String(backendMessage.sender?.id || user?.id),
        sender: user || { id: '1', email: 'user@example.com', username: 'user', displayName: 'User', status: 'online', role: 'USER', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
        attachments: (backendMessage.attachments || []).map((att: any) => ({
          id: String(att.id),
          filename: att.fileName || '',
          url: att.fileUrl || '',
          size: att.fileSize || 0,
          fileType: att.fileType || '',   // ← correct key matching Attachment interface
        })),
        reactions: [],
        threadCount: 0,
        isEdited: false,
        createdAt: backendMessage.createdAt || new Date().toISOString(),
        updatedAt: backendMessage.updatedAt || new Date().toISOString(),
      };
      addMessage(newMessage);  // safe to call — store deduplicates by ID
      
    } catch (err: any) {
      console.error('Failed to send message:', err);
      setError(err.response?.data?.message || 'Failed to send message');
    } finally {
      setSending(false);
      setMessage('');
      // Clear selected file and reset file input
      setSelectedFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      // Use setTimeout to ensure focus is applied after DOM updates and scroll animation completes
      setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.style.height = 'auto';
          textareaRef.current.focus();
        }
      }, 100);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setMessage(e.target.value);
    setError(null); // Clear error when user starts typing
    // Auto-resize textarea
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 150)}px`;
    }
  };

  const addEmoji = (emoji: string) => {
    setMessage((prev) => prev + emoji);
    setShowEmojiPicker(false);
    textareaRef.current?.focus();
  };

  // File upload handlers
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setError(null);
    }
  };

  const handleFileUpload = async () => {
    if (!selectedFile || !selectedFile.name) return;
    
    const { currentChannel } = useChannelStore.getState();
    if (!currentChannel?.id) {
      setError('Please select a channel first');
      return;
    }

    setIsUploading(true);
    setError(null);
    
    try {
      const formData = new FormData();
      formData.append('file', selectedFile);
      
      const response = await messageApi.uploadAttachment(currentChannel.id, formData);
      const attachment = response.data;
      
      // Add attachment info to message
      const attachmentText = `[${attachment.fileName}](${attachment.fileUrl})`;
      setMessage((prev) => prev + (prev ? ' ' : '') + attachmentText);
      setSelectedFile(null);
      
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (err: any) {
      console.error('Failed to upload file:', err);
      setError(err.response?.data?.message || 'Failed to upload file');
    } finally {
      setIsUploading(false);
    }
  };

  const handleRemoveFile = () => {
    setSelectedFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Mention handlers
  const searchUsers = async (query: string) => {
    try {
      const response = await authApi.searchUsers(query);
      setMentionUsers(response.data || []);
    } catch (err) {
      console.error('Failed to search users:', err);
      setMentionUsers([]);
    }
  };

  const handleMentionClick = async () => {
    setShowMentionPicker(true);
    setMentionQuery('');
    setSelectedMentionIndex(0);
    await searchUsers('');
  };

  const handleMentionSelect = (selectedUser: User) => {
    const mentionText = `@${selectedUser.username} `;
    setMessage((prev) => prev + mentionText);
    setShowMentionPicker(false);
    setMentionUsers([]);
    textareaRef.current?.focus();
  };

  const handleMentionInputChange = async (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setMessage(value);
    
    // Check if user is typing a mention
    const cursorPos = e.target.selectionStart;
    const textBeforeCursor = value.slice(0, cursorPos);
    const mentionMatch = textBeforeCursor.match(/@(\w*)$/);
    
    if (mentionMatch) {
      const query = mentionMatch[1];
      if (query !== mentionQuery) {
        setMentionQuery(query);
        await searchUsers(query);
      }
      setShowMentionPicker(true);
      setSelectedMentionIndex(0);
    } else {
      setShowMentionPicker(false);
    }
    
    setError(null);
    // Auto-resize textarea
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 150)}px`;
    }
  };

  const handleMentionKeyDown = (e: React.KeyboardEvent) => {
    if (showMentionPicker && mentionUsers.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedMentionIndex((prev) => (prev + 1) % mentionUsers.length);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedMentionIndex((prev) => (prev - 1 + mentionUsers.length) % mentionUsers.length);
      } else if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        if (mentionUsers[selectedMentionIndex]) {
          handleMentionSelect(mentionUsers[selectedMentionIndex]);
        }
      } else if (e.key === 'Escape') {
        setShowMentionPicker(false);
      }
    }
  };

  // Close mention dropdown when clicking outside
  React.useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (mentionDropdownRef.current && !mentionDropdownRef.current.contains(e.target as Node)) {
        setShowMentionPicker(false);
      }
      if (fileTypePickerRef.current && !fileTypePickerRef.current.contains(e.target as Node)) {
        setShowFileTypePicker(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // File type selection handler
  const handleFileTypeSelect = (type: string) => {
    if (fileInputRef.current) {
      if (type === 'image') {
        fileInputRef.current.accept = 'image/*';
      } else if (type === 'document') {
        fileInputRef.current.accept = '.pdf,.doc,.docx,.txt,.xls,.xlsx,.ppt,.pptx';
      } else {
        fileInputRef.current.accept = '*/*';
      }
      fileInputRef.current.click();
    }
    setShowFileTypePicker(false);
  };

  // Get current channel name for placeholder
  const { currentChannel } = useChannelStore();
  const channelName = currentChannel?.name || 'general';

  return (
    <div className="px-4 pb-4 relative">
      {/* Error Message */}
      {error && (
        <div className="mb-2 bg-red-500/20 border border-red-500/30 rounded-lg px-3 py-2 text-sm text-red-400">
          {error}
        </div>
      )}
      
      {/* Typing Indicator */}
      <AnimatePresence>
        {typingUsers.length > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex items-center gap-1.5 text-xs text-text-muted mb-2"
          >
            <div className="flex gap-0.5">
              <span className="typing-dot" />
              <span className="typing-dot" />
              <span className="typing-dot" />
            </div>
            <span>
              {typingUsers.map((u) => u.user.displayName).join(', ')}{' '}
              {typingUsers.length === 1 ? 'is' : 'are'} typing...
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Emoji Picker */}
      {showEmojiPicker && (
        <div
          className="absolute bottom-full left-4 mb-2 p-3 bg-surface-elevated border border-border rounded-lg shadow-xl z-50"
          style={{ position: 'absolute', left: '16px', bottom: '100%', visibility: 'visible', opacity: 1 }}
        >
          <div className="flex flex-wrap gap-1 w-48">
            {commonEmojis.map((emoji) => (
              <button
                key={emoji}
                type="button"
                onClick={() => addEmoji(emoji)}
                className="w-8 h-8 flex items-center justify-center hover:bg-background-hover rounded-lg text-lg transition-colors cursor-pointer text-2xl"
              >
                {emoji}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Message Input Area */}
      <form
        onSubmit={handleSubmit}
        className="flex items-end gap-2 bg-background-hover rounded-xl p-2"
      >
        {/* Attachment Button */}
        <div className="relative" ref={fileTypePickerRef}>
          <Tooltip content={selectedFile ? 'Remove file' : 'Attach file'}>
            <button
              type="button"
              onClick={() => {
                if (selectedFile) {
                  handleRemoveFile();
                } else {
                  setShowFileTypePicker(!showFileTypePicker);
                }
              }}
              className={cn(
                'p-2.5 rounded-lg transition-colors shrink-0',
                selectedFile
                  ? 'bg-red-500/20 text-red-400'
                  : 'text-text-secondary hover:text-text-primary hover:bg-background-secondary'
              )}
              disabled={isUploading}
            >
              {isUploading ? (
                <svg className="animate-spin w-5 h-5" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              ) : (
                selectedFile ? <X className="w-5 h-5" /> : <Paperclip className="w-5 h-5" />
              )}
            </button>
          </Tooltip>

          {/* File Type Picker Dropdown */}
          {showFileTypePicker && !selectedFile && (
            <div
              className="absolute bottom-full left-0 mb-2 w-48 bg-surface-elevated border border-border rounded-lg shadow-xl z-50 overflow-hidden"
            >
              <div className="p-2 border-b border-border">
                <span className="text-xs font-medium text-text-muted">Select file type</span>
              </div>
              <div className="p-1">
                <button
                  type="button"
                  onClick={() => handleFileTypeSelect('image')}
                  className="w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-background-hover rounded-lg transition-colors"
                >
                  <Image className="w-4 h-4 text-primary" />
                  <span className="text-sm text-text-primary">Images</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleFileTypeSelect('document')}
                  className="w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-background-hover rounded-lg transition-colors"
                >
                  <FileText className="w-4 h-4 text-blue-400" />
                  <span className="text-sm text-text-primary">Documents</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleFileTypeSelect('all')}
                  className="w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-background-hover rounded-lg transition-colors"
                >
                  <File className="w-4 h-4 text-text-muted" />
                  <span className="text-sm text-text-primary">All Files</span>
                </button>
              </div>
            </div>
          )}
        </div>
        
        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          onChange={handleFileSelect}
          accept="*/*"
        />

        {/* Upload Button - shown when file is selected */}
        {selectedFile && !isUploading && (
          <Tooltip content="Upload file">
            <button
              type="button"
              onClick={handleFileUpload}
              className="p-2.5 rounded-lg bg-primary/20 text-primary hover:bg-primary/30 transition-colors shrink-0"
            >
              <Upload className="w-5 h-5" />
            </button>
          </Tooltip>
        )}

        {/* Selected File Preview */}
        {selectedFile && (
          <div className="flex items-center gap-2 px-3 py-2 bg-background-hover rounded-lg">
            <Paperclip className="w-4 h-4 text-text-muted" />
            <span className="text-sm text-text-primary truncate max-w-[150px]">
              {selectedFile.name}
            </span>
            <button
              type="button"
              onClick={handleRemoveFile}
              className="p-1 hover:bg-background-secondary rounded"
            >
              <X className="w-4 h-4 text-text-muted" />
            </button>
          </div>
        )}
        
        {/* Text Input Area */}
        <textarea
          ref={textareaRef}
          value={message}
          onChange={handleMentionInputChange}
          onKeyDown={(e) => {
            handleKeyDown(e);
            handleMentionKeyDown(e);
          }}
          placeholder={`Message #${channelName}`}
          rows={1}
          className="flex-1 bg-transparent text-text-primary placeholder:text-text-muted resize-none focus:outline-none text-sm py-2.5 min-h-[44px] max-h-[150px]"
          disabled={isSending || isUploading}
        />

        {/* Action Buttons */}
        <div className="flex items-center gap-1 shrink-0">
          {/* Mention Dropdown */}
          {showMentionPicker && (
            <div
              ref={mentionDropdownRef}
              className="absolute bottom-full left-12 mb-2 w-64 bg-surface-elevated border border-border rounded-lg shadow-xl z-50 overflow-hidden"
              style={{ position: 'absolute', left: '48px', bottom: '100%', visibility: 'visible', opacity: 1 }}
            >
              <div className="p-2 border-b border-border">
                <div className="flex items-center gap-2 text-text-muted text-sm">
                  <Search className="w-4 h-4" />
                  <span>Mention user</span>
                </div>
              </div>
              <div className="max-h-48 overflow-y-auto">
                {mentionUsers.length > 0 ? (
                  mentionUsers.map((mentionUser, index) => (
                    <button
                      key={mentionUser.id}
                      type="button"
                      onClick={() => handleMentionSelect(mentionUser)}
                      className={cn(
                        'w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-background-hover transition-colors',
                        index === selectedMentionIndex && 'bg-primary/20'
                      )}
                    >
                      <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary text-sm font-medium">
                        {mentionUser.displayName?.[0]?.toUpperCase() || mentionUser.username[0].toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-text-primary truncate">
                          {mentionUser.displayName || mentionUser.username}
                        </p>
                        <p className="text-xs text-text-muted truncate">
                          @{mentionUser.username}
                        </p>
                      </div>
                    </button>
                  ))
                ) : (
                  <div className="p-3 text-sm text-text-muted text-center">
                    No users found
                  </div>
                )}
              </div>
            </div>
          )}

          <Tooltip content="Mention">
            <button
              type="button"
              onClick={handleMentionClick}
              className={cn(
                'p-2.5 rounded-lg transition-colors',
                showMentionPicker
                  ? 'bg-primary/20 text-primary'
                  : 'text-text-secondary hover:text-text-primary hover:bg-background-secondary'
              )}
            >
              <AtSign className="w-5 h-5" />
            </button>
          </Tooltip>

          <Tooltip content="Add emoji">
            <button
              type="button"
              onClick={() => setShowEmojiPicker(!showEmojiPicker)}
              className={cn(
                'p-2.5 rounded-lg transition-colors',
                showEmojiPicker
                  ? 'bg-primary/20 text-primary'
                  : 'text-text-secondary hover:text-text-primary hover:bg-background-secondary'
              )}
            >
              <Smile className="w-5 h-5" />
            </button>
          </Tooltip>

          {/* Send Button */}
          <Tooltip content={selectedFile ? 'Send with file' : 'Send message'}>
            <Button
              type="submit"
              variant={(message.trim() || selectedFile) ? 'primary' : 'ghost'}
              size="icon"
              disabled={(!message.trim() && !selectedFile) || isSending}
              className="w-10 h-10"
            >
              {isSending ? (
                <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              ) : (
                <Send className="w-4 h-4" />
              )}
            </Button>
          </Tooltip>
        </div>
      </form>

      {/* Help Text */}
      <p className="text-xs text-text-muted mt-2 text-center">
        Press <kbd className="px-1.5 py-0.5 bg-background-hover rounded border border-border text-xs">Enter</kbd> to send, <kbd className="px-1.5 py-0.5 bg-background-hover rounded border border-border text-xs">Shift + Enter</kbd> for new line
      </p>
    </div>
  );
}

export default MessageInput;
