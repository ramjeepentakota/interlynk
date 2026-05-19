import React, { useRef, useEffect, useState } from 'react';
import {
  Search,
  Bell,
  Settings,
  Menu,
  Command,
  Moon,
  Sun,
  Users,
  Phone,
  HelpCircle,
  User,
  LogOut,
  Key,
  X,
  Shield,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { Button, Badge, Avatar, Tooltip, Input } from '@/components/ui';
import { useUIStore, useAuthStore, useNotificationStore, useChannelStore, useCallStore } from '@/store/useAppStore';
import { callApi, channelApi } from '@/api/client';
import { CallDropdown } from '../call/CallDropdown';

export function TopBar() {
  const { sidebarOpen, toggleSidebar, theme, setTheme, searchOpen, toggleSearch, settingsOpen, toggleSettings } = useUIStore();
  const { user } = useAuthStore();
  const { notifications, unreadCount } = useNotificationStore();
  const { currentChannel, updateChannel } = useChannelStore();
  const { setCurrentCall, setInCall, setRemoteUser } = useCallStore();
  const [showNotifications, setShowNotifications] = useState(false);
  const [isStartingCall, setIsStartingCall] = useState(false);
  const [showCallDropdown, setShowCallDropdown] = useState(false);
  const callDropdownRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  const isAdmin = user?.roles?.includes('ADMIN') || user?.role === 'ADMIN';

  // Close dropdown when clicking outside
  useEffect(() => {
    if (!showCallDropdown) return;
    const handler = (e: MouseEvent) => {
      if (callDropdownRef.current && !callDropdownRef.current.contains(e.target as Node)) {
        setShowCallDropdown(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showCallDropdown]);

  // Fetch channel members if they're not loaded (to support the dropdown)
  useEffect(() => {
    if (!currentChannel?.id || currentChannel.members || !showCallDropdown) return;
    const fetchChannelDetails = async () => {
      try {
        const response = await channelApi.getChannel(currentChannel.id);
        if (response.data) {
          updateChannel(currentChannel.id, { members: response.data.members });
        }
      } catch (error) {
        console.error('TopBar: Failed to fetch channel details:', error);
      }
    };
    fetchChannelDetails();
  }, [currentChannel?.id, currentChannel?.members, showCallDropdown, updateChannel]);

  const handleSelectIndividual = async (member: any, type: 'voice' | 'video') => {
    if (!currentChannel || isStartingCall) return;
    setShowCallDropdown(false);
    setIsStartingCall(true);
    try {
      // Store who we are calling so CallPanel can show their info
      setRemoteUser({
        id: String(member.id),
        displayName: member.displayName || member.username || 'Unknown',
        username: member.username || '',
        avatarUrl: member.avatarUrl,
      });

      const res = await callApi.createDirectCall(Number(member.id), type);
      if (res.data) {
        // Initiator must join their own call
        await callApi.joinCall(String(res.data.id));
        const room = { ...res.data, callType: type };
        setCurrentCall(room);
        setInCall(true);
      }

    } catch (e) {
      console.error('Failed to start individual call:', e);
      alert('Failed to start call. Please try again.');
      setRemoteUser(null);
    } finally {
      setIsStartingCall(false);
    }
  };

  const handleSelectGroup = async (type: 'voice' | 'video') => {
    if (!currentChannel || isStartingCall) return;
    setShowCallDropdown(false);
    setIsStartingCall(true);
    try {
      setRemoteUser(null);
      const roomName = `${currentChannel.name} — ${type === 'video' ? 'Video Meeting' : 'Voice Call'}`;
      const res = await callApi.createCall({ name: roomName, type: 'GROUP' });
      if (res.data) {
        await callApi.joinCall(String(res.data.id));
        setCurrentCall({ ...res.data, callType: type });
        setInCall(true);
      }
    } catch (e) {
      console.error('Failed to start group call:', e);
      alert('Failed to start group call. Please try again.');
    } finally {
      setIsStartingCall(false);
    }
  };

  const handleLogout = () => {
    useAuthStore.getState().logout();
    window.location.href = '/login';
  };

  return (
    <>
      <header className="h-14 bg-background-secondary border-b border-border flex items-center justify-between px-4 gap-4">
        {/* Left Section - Menu Toggle & Channel Info */}
        <div className="flex items-center gap-3">
          {!sidebarOpen && (
            <Button variant="ghost" size="icon" onClick={toggleSidebar}>
              <Menu className="w-5 h-5" />
            </Button>
          )}
          
          {currentChannel && (
            <div className="flex items-center gap-2">
              <h2 className="text-text-primary font-semibold">
                # {currentChannel.name}
              </h2>
              <div className="h-4 w-px bg-border" />
              <span className="text-text-muted text-sm hidden sm:inline">
                Welcome to #{currentChannel.name}!
              </span>
            </div>
          )}
        </div>

        {/* Center Section - Search */}
        <div className="flex-1 max-w-xl hidden md:block">
          <button
            onClick={toggleSearch}
            className="w-full flex items-center gap-2 px-3 py-2 bg-surface-elevated border border-border rounded-lg text-text-muted hover:border-border-highlight transition-colors"
          >
            <Search className="w-4 h-4" />
            <span className="text-sm">Search Interlynk...</span>
            <div className="ml-auto flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 text-xs bg-background-hover rounded border border-border">
                <Command className="w-3 h-3 inline" />
              </kbd>
              <kbd className="px-1.5 py-0.5 text-xs bg-background-hover rounded border border-border">
                K
              </kbd>
            </div>
          </button>
        </div>

        {/* Right Section - Actions */}
        <div className="flex items-center gap-2">
          {/* Quick Actions — Call Dropdown */}
          <div className="flex items-center gap-1 mr-2">
            <div className="relative" ref={callDropdownRef}>
              <Tooltip content="Start a Call">
                <Button
                  id="topbar-call-btn"
                  variant="ghost"
                  size="icon"
                  className={cn(
                    'w-9 h-9 transition-all duration-200',
                    showCallDropdown && 'text-primary bg-primary/10'
                  )}
                  onClick={() => setShowCallDropdown((prev) => !prev)}
                  disabled={isStartingCall || !currentChannel}
                >
                  {isStartingCall ? (
                    <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <Phone className="w-4 h-4" />
                  )}
                </Button>
              </Tooltip>

              <AnimatePresence>
                {showCallDropdown && (
                  <CallDropdown
                    onSelectIndividual={handleSelectIndividual}
                    onSelectGroup={handleSelectGroup}
                    onClose={() => setShowCallDropdown(false)}
                    isLoading={isStartingCall}
                    members={currentChannel?.members || []}
                    currentUser={user}
                    channelName={currentChannel?.name}
                  />
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* Theme Toggle */}
          <Tooltip content={theme === 'dark' ? 'Light Mode' : 'Dark Mode'}>
            <Button variant="ghost" size="icon" className="hidden sm:flex" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>
              {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </Button>
          </Tooltip>

          {/* Notifications */}
          <div className="relative">
            <Tooltip content="Notifications">
              <Button variant="ghost" size="icon" className="w-9 h-9" onClick={() => setShowNotifications(!showNotifications)}>
                <Bell className="w-4 h-4" />
                {unreadCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-error text-white text-xs rounded-full flex items-center justify-center">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </Button>
            </Tooltip>

            {showNotifications && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="absolute right-0 top-full mt-2 w-80 bg-surface-elevated border border-border rounded-xl shadow-2xl overflow-hidden z-50"
              >
                <div className="p-3 border-b border-border flex items-center justify-between">
                  <h3 className="font-semibold text-text-primary">Notifications</h3>
                  {unreadCount > 0 && (
                    <Button variant="ghost" size="sm" className="text-xs">
                      Mark all read
                    </Button>
                  )}
                </div>
                <div className="max-h-80 overflow-y-auto">
                  {notifications.length === 0 ? (
                    <div className="p-4 text-center text-text-muted text-sm">
                      No notifications yet
                    </div>
                  ) : (
                    notifications.map((notification) => (
                      <div
                        key={notification.id}
                        className={cn(
                          'p-3 border-b border-border last:border-0 hover:bg-background-hover cursor-pointer',
                          !notification.isRead && 'bg-primary/5'
                        )}
                      >
                        <p className="text-sm text-text-primary">{notification.title}</p>
                        <p className="text-xs text-text-muted mt-1">{notification.message}</p>
                      </div>
                    ))
                  )}
                </div>
              </motion.div>
            )}
          </div>

          {/* User Profile */}
          <div className="relative">
            <button 
              onClick={toggleSettings}
              className="flex items-center gap-2 p-1 pl-2 hover:bg-background-hover rounded-full transition-colors"
            >
              <div className="flex flex-col items-end hidden lg:flex">
                <span className="text-sm font-medium text-text-primary truncate max-w-[100px]">
                  {user?.displayName || 'User'}
                </span>
                <span className="text-[10px] text-text-muted">Online</span>
              </div>
              <Avatar
                src={user?.avatar}
                fallback={user?.displayName || 'U'}
                size="sm"
                status="online"
              />
            </button>
          </div>
        </div>
      </header>

      {/* Settings Modal */}
      <AnimatePresence>
        {settingsOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center"
            onClick={toggleSettings}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-surface-elevated border border-border rounded-xl shadow-2xl w-full max-w-md mx-4 overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between p-4 border-b border-border">
                <h2 className="text-lg font-semibold text-text-primary">Settings</h2>
                <Button variant="ghost" size="icon" onClick={toggleSettings}>
                  <X className="w-5 h-5" />
                </Button>
              </div>

              <div className="p-4 space-y-4 max-h-[60vh] overflow-y-auto">
                <div className="flex items-center gap-4 p-3 bg-background-hover rounded-lg">
                  <Avatar
                    src={user?.avatar}
                    fallback={user?.displayName || 'User'}
                    size="lg"
                    status="online"
                  />
                  <div className="flex-1">
                    <p className="font-medium text-text-primary">{user?.displayName || 'User'}</p>
                    <p className="text-sm text-text-muted">@{user?.username || 'user'}</p>
                  </div>
                </div>

                <div className="space-y-2">
                  <button className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-background-hover transition-colors text-left group">
                    <User className="w-5 h-5 text-text-muted group-hover:text-primary transition-colors" />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-text-primary">Edit Profile</p>
                      <p className="text-xs text-text-muted">Change your name and avatar</p>
                    </div>
                  </button>

                  {isAdmin && (
                    <button 
                      className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-background-hover transition-colors text-left group"
                      onClick={() => {
                        toggleSettings();
                        navigate('/admin');
                      }}
                    >
                      <Shield className="w-5 h-5 text-primary" />
                      <div className="flex-1">
                        <p className="text-sm font-medium text-text-primary">Admin Panel</p>
                        <p className="text-xs text-text-muted">Manage system settings</p>
                      </div>
                    </button>
                  )}
                </div>

                <div className="pt-4 border-t border-border">
                  <Button 
                    variant="danger" 
                    className="w-full"
                    onClick={handleLogout}
                  >
                    <LogOut className="w-4 h-4 mr-2" />
                    Log Out
                  </Button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

export default TopBar;
