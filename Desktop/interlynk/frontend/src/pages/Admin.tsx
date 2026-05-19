import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Users,
  UserPlus,
  Settings,
  Shield,
  Trash2,
  Edit,
  Search,
  ChevronRight,
  X,
  Check,
  Key,
  MessageSquare,
  Phone,
  Lock,
  Unlock,
  Activity,
  Save,
  RefreshCw,
  UserCog,
  Hash,
  Volume2,
  RefreshCw as SyncIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button, Input, Card, Badge, Avatar, Modal } from '@/components/ui';
import { adminApi } from '@/api/client';
import { useAuthStore } from '@/store/useAppStore';

// Types
interface User {
  id: string;
  username: string;
  email: string;
  displayName: string;
  status: string;
  presence?: string;
  roles: string[];
  createdAt: string;
}

interface Channel {
  id: string;
  name: string;
  description: string;
  type: string;
  category: string;
  isActive: boolean;
  isLocked: boolean;
  maxParticipants: number;
  memberCount: number;
  members: ChannelMember[];
  createdAt: string;
}

interface ChannelMember {
  id: string;
  username: string;
  displayName: string;
  email?: string;
  presence?: string;
}

interface VoiceChannel {
  id: string;
  name: string;
  description: string;
  isActive: boolean;
  isLocked: boolean;
  maxParticipants: number;
  memberCount: number;
  members: ChannelMember[];
}

interface SystemSetting {
  id: string;
  key: string;
  value: string;
  description: string;
  category?: string;
  updatedAt: string;
}

interface Role {
  id: string;
  name: string;
  description: string;
  permissions: string;
}

type TabType = 'users' | 'registration' | 'channels' | 'voice' | 'settings' | 'roles';

export function AdminPage() {
  const { user } = useAuthStore();
  const [activeTab, setActiveTab] = React.useState<TabType>('users');
  const [users, setUsers] = React.useState<User[]>([]);
  const [channels, setChannels] = React.useState<Channel[]>([]);
  const [voiceChannels, setVoiceChannels] = React.useState<VoiceChannel[]>([]);
  const [settings, setSettings] = React.useState<SystemSetting[]>([]);
  const [roles, setRoles] = React.useState<Role[]>([]);
  const [isLoading, setIsLoading] = React.useState(false);
  const [showCreateUser, setShowCreateUser] = React.useState(false);
  const [showEditUser, setShowEditUser] = React.useState(false);
  const [showChannelMembers, setShowChannelMembers] = React.useState(false);
  const [selectedChannel, setSelectedChannel] = React.useState<Channel | null>(null);
  const [selectedUser, setSelectedUser] = React.useState<User | null>(null);
  const [searchQuery, setSearchQuery] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState<string | null>(null);

  // New user form state
  const [newUser, setNewUser] = React.useState({
    username: '',
    email: '',
    password: '',
    displayName: '',
    role: 'EMPLOYEE',
    sendInvite: true,
  });

  // Edit user state
  const [editUser, setEditUser] = React.useState({
    id: '',
    username: '',
    email: '',
    displayName: '',
    status: 'ACTIVE',
    roles: [] as string[],
  });

  // Channel edit state
  const [editChannel, setEditChannel] = React.useState({
    id: '',
    name: '',
    description: '',
    category: '',
    isActive: true,
    isLocked: false,
    maxParticipants: 25,
  });

  // Settings state
  const [editSettings, setEditSettings] = React.useState<Record<string, string>>({});

  // Check if user is admin
  const isAdmin = user?.roles?.includes('ADMIN') || user?.role === 'ADMIN';

  React.useEffect(() => {
    if (isAdmin) {
      fetchData();
    }
  }, [isAdmin, activeTab]);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      switch (activeTab) {
        case 'users':
        case 'registration':
          await fetchUsers();
          break;
        case 'channels':
          await fetchChannels();
          break;
        case 'voice':
          await fetchVoiceChannels();
          break;
        case 'settings':
          await fetchSettings();
          break;
        case 'roles':
          await fetchRoles();
          break;
      }
    } catch (err) {
      console.error('Failed to fetch data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchUsers = async () => {
    const response = await adminApi.getUsers();
    if (response.data && Array.isArray(response.data)) {
      setUsers(response.data);
    }
  };

  const fetchChannels = async () => {
    const response = await adminApi.getChannels();
    if (response.data && Array.isArray(response.data)) {
      setChannels(response.data);
    }
  };

  const fetchVoiceChannels = async () => {
    const response = await adminApi.getVoiceChannels();
    if (response.data && Array.isArray(response.data)) {
      setVoiceChannels(response.data);
    }
  };

  const fetchSettings = async () => {
    const response = await adminApi.getSystemSettings();
    if (response.data && Array.isArray(response.data)) {
      setSettings(response.data);
      const settingsMap: Record<string, string> = {};
      response.data.forEach((s: SystemSetting) => {
        settingsMap[s.key] = s.value;
      });
      setEditSettings(settingsMap);
    }
  };

  const fetchRoles = async () => {
    const response = await adminApi.getRoles();
    if (response.data && Array.isArray(response.data)) {
      setRoles(response.data);
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    try {
      const response = await adminApi.createUser({
        username: newUser.username,
        email: newUser.email,
        password: newUser.password,
        displayName: newUser.displayName || newUser.username,
        role: newUser.role,
      });

      if (response.data) {
        setSuccess('User created successfully!' + (newUser.sendInvite ? ' Invitation sent.' : ''));
        setShowCreateUser(false);
        setNewUser({
          username: '',
          email: '',
          password: '',
          displayName: '',
          role: 'EMPLOYEE',
          sendInvite: true,
        });
        fetchUsers();
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to create user');
    }
  };

  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    try {
      await adminApi.updateUserRoles(editUser.id, editUser.roles);
      await adminApi.updateUserStatus(editUser.id, editUser.status);
      
      setSuccess('User updated successfully!');
      setShowEditUser(false);
      fetchUsers();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to update user');
    }
  };

  const handleDeleteUser = async (userId: string) => {
    if (!confirm('Are you sure you want to delete this user? This action cannot be undone.')) return;

    try {
      await adminApi.deleteUser(userId);
      setUsers(users.filter(u => u.id !== userId));
      setSuccess('User deleted successfully!');
    } catch (error) {
      setError('Failed to delete user');
    }
  };

  const handleUpdateChannel = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    try {
      await adminApi.updateChannel(editChannel.id, {
        name: editChannel.name,
        description: editChannel.description,
        category: editChannel.category,
        isActive: editChannel.isActive,
        isLocked: editChannel.isLocked,
        maxParticipants: editChannel.maxParticipants,
      });

      setSuccess('Channel updated successfully!');
      setSelectedChannel(null);
      setShowChannelMembers(false);
      fetchChannels();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to update channel');
    }
  };

  const handleRemoveChannelMember = async (channelId: string, userId: string) => {
    try {
      await adminApi.removeChannelMember(channelId, userId);
      setSuccess('Member removed successfully!');
      // Refresh channel data
      const response = await adminApi.getChannel(channelId);
      if (response.data) {
        setSelectedChannel(response.data);
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to remove member');
    }
  };

  const handleUpdateVoiceChannel = async (channelId: string, data: { maxParticipants?: number; isLocked?: boolean; isActive?: boolean }) => {
    try {
      await adminApi.updateVoiceChannelSettings(channelId, data);
      setSuccess('Voice channel settings updated!');
      fetchVoiceChannels();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to update voice channel');
    }
  };

  const handleSaveSettings = async () => {
    setError(null);
    setSuccess(null);

    try {
      await adminApi.updateSystemSettings(editSettings);
      setSuccess('Settings saved successfully!');
      fetchSettings();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to save settings');
    }
  };

  const openEditUser = (user: User) => {
    setEditUser({
      id: user.id,
      username: user.username,
      email: user.email,
      displayName: user.displayName || '',
      status: user.status,
      roles: user.roles || [],
    });
    setShowEditUser(true);
  };

  const openChannelMembers = async (channel: Channel) => {
    try {
      const response = await adminApi.getChannel(channel.id);
      if (response.data) {
        setSelectedChannel(response.data);
        setEditChannel({
          id: response.data.id,
          name: response.data.name,
          description: response.data.description || '',
          category: response.data.category || '',
          isActive: response.data.isActive,
          isLocked: response.data.isLocked,
          maxParticipants: response.data.maxParticipants,
        });
        setShowChannelMembers(true);
      }
    } catch (err) {
      console.error('Failed to fetch channel details:', err);
    }
  };

  const filteredUsers = users.filter(u => 
    u.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
    u.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
    u.displayName?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredChannels = channels.filter(c =>
    c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.category?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center h-screen bg-background-primary">
        <div className="text-center">
          <Shield className="w-16 h-16 text-error mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-text-primary mb-2">Access Denied</h1>
          <p className="text-text-muted">You don't have permission to access this page.</p>
        </div>
      </div>
    );
  }

  const tabs = [
    { id: 'users' as TabType, label: 'Users', icon: Users },
    { id: 'registration' as TabType, label: 'User Registration', icon: UserPlus },
    { id: 'channels' as TabType, label: 'Channel Access', icon: MessageSquare },
    { id: 'voice' as TabType, label: 'Voice Channels', icon: Volume2 },
    { id: 'settings' as TabType, label: 'Settings', icon: Settings },
    { id: 'roles' as TabType, label: 'Roles & Permissions', icon: Key },
  ];

  return (
    <div className="min-h-screen bg-background-primary p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-text-primary">Admin Dashboard</h1>
          <p className="text-text-muted mt-2">Manage users, channels, access permissions, and system settings</p>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'flex items-center gap-2 px-4 py-2 rounded-lg transition-colors whitespace-nowrap',
                activeTab === tab.id
                  ? 'bg-primary text-white'
                  : 'bg-background-hover text-text-secondary hover:text-text-primary'
              )}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Error/Success Messages */}
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="mb-4 p-3 bg-error/10 border border-error/20 rounded-lg text-error text-sm"
            >
              {error}
            </motion.div>
          )}
          {success && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="mb-4 p-3 bg-success/10 border border-success/20 rounded-lg text-success text-sm"
            >
              {success}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Users Tab */}
        {activeTab === 'users' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-4"
          >
            {/* Actions Bar */}
            <div className="flex items-center justify-between gap-4">
              <div className="flex-1 max-w-md">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
                  <Input
                    placeholder="Search users..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
              <Button onClick={() => setShowCreateUser(true)}>
                <UserPlus className="w-4 h-4 mr-2" />
                Add User
              </Button>
            </div>

            {/* Users Table */}
            <Card className="overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-background-hover">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-text-muted uppercase tracking-wider">
                        User
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-text-muted uppercase tracking-wider">
                        Email
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-text-muted uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-text-muted uppercase tracking-wider">
                        Roles
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-text-muted uppercase tracking-wider">
                        Created
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-text-muted uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {isLoading ? (
                      <tr>
                        <td colSpan={6} className="px-4 py-8 text-center text-text-muted">
                          Loading users...
                        </td>
                      </tr>
                    ) : filteredUsers.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-4 py-8 text-center text-text-muted">
                          {searchQuery ? 'No users found matching your search' : 'No users yet'}
                        </td>
                      </tr>
                    ) : (
                      filteredUsers.map((user) => (
                        <tr key={user.id} className="hover:bg-background-hover">
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-3">
                              <Avatar fallback={user.displayName || user.username} size="sm" />
                              <div>
                                <p className="font-medium text-text-primary">
                                  {user.displayName || user.username}
                                </p>
                                <p className="text-xs text-text-muted">@{user.username}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-sm text-text-secondary">
                            {user.email}
                          </td>
                          <td className="px-4 py-3">
                            <Badge
                              variant={user.status === 'ACTIVE' ? 'success' : 'secondary'}
                            >
                              {user.status}
                            </Badge>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex gap-1 flex-wrap">
                              {user.roles?.map((role) => (
                                <Badge key={role} variant="info" size="sm">
                                  {role}
                                </Badge>
                              ))}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-sm text-text-muted">
                            {user.createdAt ? new Date(user.createdAt).toLocaleDateString() : '-'}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => openEditUser(user)}
                                className="w-8 h-8 text-text-muted hover:text-primary"
                              >
                                <UserCog className="w-4 h-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleDeleteUser(user.id)}
                                className="w-8 h-8 text-text-muted hover:text-error"
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </Card>
          </motion.div>
        )}

        {/* User Registration Tab */}
        {activeTab === 'registration' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            <Card className="p-6">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-3 bg-primary/10 rounded-lg">
                  <UserPlus className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <h2 className="text-xl font-semibold text-text-primary">User Registration</h2>
                  <p className="text-sm text-text-muted">Create new user accounts and manage invitations</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <h3 className="font-medium text-text-primary">Quick Stats</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 bg-background-hover rounded-lg">
                      <p className="text-2xl font-bold text-text-primary">{users.length}</p>
                      <p className="text-sm text-text-muted">Total Users</p>
                    </div>
                    <div className="p-4 bg-background-hover rounded-lg">
                      <p className="text-2xl font-bold text-success">{users.filter(u => u.status === 'ACTIVE').length}</p>
                      <p className="text-sm text-text-muted">Active Users</p>
                    </div>
                    <div className="p-4 bg-background-hover rounded-lg">
                      <p className="text-2xl font-bold text-warning">{users.filter(u => u.status === 'INACTIVE').length}</p>
                      <p className="text-sm text-text-muted">Inactive Users</p>
                    </div>
                    <div className="p-4 bg-background-hover rounded-lg">
                      <p className="text-2xl font-bold text-error">{users.filter(u => u.status === 'SUSPENDED').length}</p>
                      <p className="text-sm text-text-muted">Suspended Users</p>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="font-medium text-text-primary">Quick Actions</h3>
                  <div className="space-y-2">
                    <Button 
                      className="w-full justify-start"
                      onClick={() => setShowCreateUser(true)}
                    >
                      <UserPlus className="w-4 h-4 mr-2" />
                      Create New User
                    </Button>
                    <Button 
                      variant="secondary"
                      className="w-full justify-start"
                      onClick={() => setActiveTab('users')}
                    >
                      <Users className="w-4 h-4 mr-2" />
                      View All Users
                    </Button>
                    <Button 
                      variant="secondary"
                      className="w-full justify-start"
                      onClick={() => setActiveTab('roles')}
                    >
                      <Key className="w-4 h-4 mr-2" />
                      Manage Roles
                    </Button>
                  </div>
                </div>
              </div>
            </Card>

            {/* Recent Registrations */}
            <Card className="p-6">
              <h3 className="font-medium text-text-primary mb-4">Recent User Registrations</h3>
              <div className="space-y-2">
                {users.slice(0, 5).map((user) => (
                  <div key={user.id} className="flex items-center justify-between p-3 bg-background-hover rounded-lg">
                    <div className="flex items-center gap-3">
                      <Avatar fallback={user.displayName || user.username} size="sm" />
                      <div>
                        <p className="font-medium text-text-primary">{user.displayName || user.username}</p>
                        <p className="text-xs text-text-muted">{user.email}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={user.status === 'ACTIVE' ? 'success' : 'secondary'} size="sm">
                        {user.status}
                      </Badge>
                      <span className="text-xs text-text-muted">
                        {user.createdAt ? new Date(user.createdAt).toLocaleDateString() : '-'}
                      </span>
                    </div>
                  </div>
                ))}
                {users.length === 0 && (
                  <p className="text-center text-text-muted py-4">No users registered yet</p>
                )}
              </div>
            </Card>
          </motion.div>
        )}

        {/* Channel Access Tab */}
        {activeTab === 'channels' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-4"
          >
            {/* Actions Bar */}
            <div className="flex items-center justify-between gap-4">
              <div className="flex-1 max-w-md">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
                  <Input
                    placeholder="Search channels..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
              <Button variant="secondary" onClick={fetchChannels}>
                <RefreshCw className="w-4 h-4 mr-2" />
                Refresh
              </Button>
            </div>

            {/* Channels Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {isLoading ? (
                <div className="col-span-full text-center py-8 text-text-muted">
                  Loading channels...
                </div>
              ) : filteredChannels.length === 0 ? (
                <div className="col-span-full text-center py-8 text-text-muted">
                  {searchQuery ? 'No channels found' : 'No channels yet'}
                </div>
              ) : (
                filteredChannels.map((channel) => (
                  <Card key={channel.id} className="p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-2">
                        {channel.type === 'VOICE' ? (
                          <Volume2 className="w-5 h-5 text-primary" />
                        ) : (
                          <Hash className="w-5 h-5 text-text-muted" />
                        )}
                        <h3 className="font-medium text-text-primary">{channel.name}</h3>
                      </div>
                      <div className="flex items-center gap-1">
                        {channel.isLocked ? (
                          <Lock className="w-4 h-4 text-warning" />
                        ) : (
                          <Unlock className="w-4 h-4 text-success" />
                        )}
                      </div>
                    </div>
                    
                    {channel.category && (
                      <Badge variant="secondary" size="sm" className="mb-2">
                        {channel.category}
                      </Badge>
                    )}
                    
                    <p className="text-sm text-text-muted mb-3">
                      {channel.description || 'No description'}
                    </p>
                    
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-text-muted">
                        <Users className="w-4 h-4 inline mr-1" />
                        {channel.memberCount} members
                      </span>
                      <Badge 
                        variant={channel.isActive ? 'success' : 'secondary'}
                        size="sm"
                      >
                        {channel.isActive ? 'Active' : 'Inactive'}
                      </Badge>
                    </div>
                    
                    <Button 
                      variant="secondary" 
                      size="sm" 
                      className="w-full mt-3"
                      onClick={() => openChannelMembers(channel)}
                    >
                      <Settings className="w-4 h-4 mr-2" />
                      Manage Access
                    </Button>
                  </Card>
                ))
              )}
            </div>
          </motion.div>
        )}

        {/* Voice Channels Tab */}
        {activeTab === 'voice' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-4"
          >
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold text-text-primary">Voice Channel Management</h2>
              <Button variant="secondary" onClick={fetchVoiceChannels}>
                <RefreshCw className="w-4 h-4 mr-2" />
                Refresh
              </Button>
            </div>

            {isLoading ? (
              <div className="text-center py-8 text-text-muted">Loading voice channels...</div>
            ) : voiceChannels.length === 0 ? (
              <Card className="p-8 text-center">
                <Volume2 className="w-12 h-12 text-text-muted mx-auto mb-4" />
                <h3 className="text-lg font-medium text-text-primary mb-2">No Voice Channels</h3>
                <p className="text-text-muted">Voice channels will appear here when created.</p>
              </Card>
            ) : (
              <div className="space-y-4">
                {voiceChannels.map((channel) => (
                  <Card key={channel.id} className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="p-3 bg-primary/10 rounded-lg">
                          <Volume2 className="w-6 h-6 text-primary" />
                        </div>
                        <div>
                          <h3 className="font-medium text-text-primary">{channel.name}</h3>
                          <p className="text-sm text-text-muted">
                            {channel.memberCount}/{channel.maxParticipants} participants
                          </p>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-text-muted">Max:</span>
                          <Input
                            type="number"
                            className="w-20 h-8"
                            value={channel.maxParticipants}
                            onChange={(e) => {
                              const val = parseInt(e.target.value);
                              if (val > 0) {
                                handleUpdateVoiceChannel(channel.id, { maxParticipants: val });
                              }
                            }}
                          />
                        </div>
                        
                        <Button
                          variant={channel.isLocked ? 'secondary' : 'ghost'}
                          size="icon"
                          onClick={() => handleUpdateVoiceChannel(channel.id, { isLocked: !channel.isLocked })}
                        >
                          {channel.isLocked ? <Lock className="w-4 h-4 text-warning" /> : <Unlock className="w-4 h-4 text-success" />}
                        </Button>
                        
                        <Button
                          variant={channel.isActive ? 'secondary' : 'ghost'}
                          size="icon"
                          onClick={() => handleUpdateVoiceChannel(channel.id, { isActive: !channel.isActive })}
                        >
                          {channel.isActive ? (
                            <Activity className="w-4 h-4 text-success" />
                          ) : (
                            <X className="w-4 h-4 text-error" />
                          )}
                        </Button>
                      </div>
                    </div>
                    
                    {/* Current participants */}
                    {channel.members && channel.members.length > 0 && (
                      <div className="mt-4 pt-4 border-t border-border">
                        <p className="text-sm text-text-muted mb-2">Current participants:</p>
                        <div className="flex flex-wrap gap-2">
                          {channel.members.map((member) => (
                            <Badge key={member.id} variant="info">
                              {member.displayName || member.username}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                  </Card>
                ))}
              </div>
            )}
          </motion.div>
        )}

        {/* Settings Tab */}
        {activeTab === 'settings' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-4"
          >
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold text-text-primary">System Settings</h2>
              <Button onClick={handleSaveSettings}>
                <Save className="w-4 h-4 mr-2" />
                Save Changes
              </Button>
            </div>

            {isLoading ? (
              <div className="text-center py-8 text-text-muted">Loading settings...</div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {settings.map((setting) => (
                  <Card key={setting.id} className="p-4">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <h3 className="font-medium text-text-primary">{setting.key}</h3>
                        <p className="text-sm text-text-muted">{setting.description}</p>
                      </div>
                    </div>
                    <Input
                      value={editSettings[setting.key] || ''}
                      onChange={(e) => setEditSettings({ ...editSettings, [setting.key]: e.target.value })}
                      className="mt-2"
                    />
                    {setting.updatedAt && (
                      <p className="text-xs text-text-muted mt-2">
                        Last updated: {new Date(setting.updatedAt).toLocaleString()}
                      </p>
                    )}
                  </Card>
                ))}
                
                {settings.length === 0 && (
                  <div className="col-span-full">
                    <Card className="p-8 text-center">
                      <Settings className="w-12 h-12 text-text-muted mx-auto mb-4" />
                      <h3 className="text-lg font-medium text-text-primary mb-2">No Settings</h3>
                      <p className="text-text-muted">System settings will appear here.</p>
                    </Card>
                  </div>
                )}
              </div>
            )}
          </motion.div>
        )}

        {/* Roles Tab */}
        {activeTab === 'roles' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-4"
          >
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold text-text-primary">Roles & Permissions</h2>
              <Button variant="secondary" onClick={fetchRoles}>
                <RefreshCw className="w-4 h-4 mr-2" />
                Refresh
              </Button>
            </div>

            {isLoading ? (
              <div className="text-center py-8 text-text-muted">Loading roles...</div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {roles.map((role) => (
                  <Card key={role.id} className="p-4">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="p-2 bg-primary/10 rounded-lg">
                        <Key className="w-5 h-5 text-primary" />
                      </div>
                      <div>
                        <h3 className="font-medium text-text-primary">{role.name}</h3>
                      </div>
                    </div>
                    <p className="text-sm text-text-muted mb-3">
                      {role.description || 'No description'}
                    </p>
                    {role.permissions && (
                      <div className="flex flex-wrap gap-1">
                        {role.permissions.split(',').map((perm, idx) => (
                          <Badge key={idx} variant="secondary" size="sm">
                            {perm.trim()}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </Card>
                ))}
                
                {roles.length === 0 && (
                  <div className="col-span-full">
                    <Card className="p-8 text-center">
                      <Key className="w-12 h-12 text-text-muted mx-auto mb-4" />
                      <h3 className="text-lg font-medium text-text-primary mb-2">No Custom Roles</h3>
                      <p className="text-text-muted">Only default roles are available.</p>
                    </Card>
                  </div>
                )}
              </div>
            )}
          </motion.div>
        )}
      </div>

      {/* Create User Modal */}
      <Modal
        isOpen={showCreateUser}
        onClose={() => setShowCreateUser(false)}
        title="Create New User"
      >
        <form onSubmit={handleCreateUser} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-text-primary mb-1">
              Username *
            </label>
            <Input
              required
              value={newUser.username}
              onChange={(e) => setNewUser({ ...newUser, username: e.target.value })}
              placeholder="Enter username"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-text-primary mb-1">
              Display Name
            </label>
            <Input
              value={newUser.displayName}
              onChange={(e) => setNewUser({ ...newUser, displayName: e.target.value })}
              placeholder="Enter display name (optional)"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-text-primary mb-1">
              Email *
            </label>
            <Input
              required
              type="email"
              value={newUser.email}
              onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
              placeholder="Enter email address"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-text-primary mb-1">
              Password *
            </label>
            <Input
              required
              type="password"
              value={newUser.password}
              onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
              placeholder="Enter password (min 8 characters)"
            />
            <p className="text-xs text-text-muted mt-1">
              Password must be at least 8 characters
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-text-primary mb-1">
              Role *
            </label>
            <select
              value={newUser.role}
              onChange={(e) => setNewUser({ ...newUser, role: e.target.value })}
              className="w-full h-10 px-3 bg-background-secondary border border-border rounded-lg text-text-primary"
            >
              <option value="EMPLOYEE">Employee</option>
              <option value="MANAGER">Manager</option>
              <option value="ADMIN">Admin</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="sendInvite"
              checked={newUser.sendInvite}
              onChange={(e) => setNewUser({ ...newUser, sendInvite: e.target.checked })}
              className="w-4 h-4 rounded border-border"
            />
            <label htmlFor="sendInvite" className="text-sm text-text-secondary">
              Send invitation email to user
            </label>
          </div>

          {error && (
            <div className="p-3 bg-error/10 border border-error/20 rounded-lg text-error text-sm">
              {error}
            </div>
          )}

          <div className="flex gap-3 pt-4">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setShowCreateUser(false)}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button type="submit" className="flex-1">
              <Check className="w-4 h-4 mr-2" />
              Create User
            </Button>
          </div>
        </form>
      </Modal>

      {/* Edit User Modal */}
      <Modal
        isOpen={showEditUser}
        onClose={() => setShowEditUser(false)}
        title="Edit User"
      >
        <form onSubmit={handleUpdateUser} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-text-primary mb-1">
              Username
            </label>
            <Input
              value={editUser.username}
              disabled
              className="bg-background-hover"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-text-primary mb-1">
              Email
            </label>
            <Input
              value={editUser.email}
              disabled
              className="bg-background-hover"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-text-primary mb-1">
              Display Name
            </label>
            <Input
              value={editUser.displayName}
              onChange={(e) => setEditUser({ ...editUser, displayName: e.target.value })}
              placeholder="Enter display name"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-text-primary mb-1">
              Status
            </label>
            <select
              value={editUser.status}
              onChange={(e) => setEditUser({ ...editUser, status: e.target.value })}
              className="w-full h-10 px-3 bg-background-secondary border border-border rounded-lg text-text-primary"
            >
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
              <option value="SUSPENDED">Suspended</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-text-primary mb-1">
              Roles
            </label>
            <div className="space-y-2">
              {['ADMIN', 'MANAGER', 'EMPLOYEE'].map((role) => (
                <label key={role} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={editUser.roles.includes(role)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setEditUser({ ...editUser, roles: [...editUser.roles, role] });
                      } else {
                        setEditUser({ ...editUser, roles: editUser.roles.filter(r => r !== role) });
                      }
                    }}
                    className="w-4 h-4 rounded border-border"
                  />
                  <span className="text-sm text-text-secondary">{role}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="flex gap-3 pt-4">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setShowEditUser(false)}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button type="submit" className="flex-1">
              <Save className="w-4 h-4 mr-2" />
              Save Changes
            </Button>
          </div>
        </form>
      </Modal>

      {/* Channel Members Modal */}
      <Modal
        isOpen={showChannelMembers}
        onClose={() => { setShowChannelMembers(false); setSelectedChannel(null); }}
        title={`Channel: ${selectedChannel?.name || ''}`}
        size="lg"
      >
        {selectedChannel && (
          <div className="space-y-4">
            {/* Channel Info */}
            <div className="grid grid-cols-2 gap-4 p-4 bg-background-hover rounded-lg">
              <div>
                <p className="text-xs text-text-muted">Type</p>
                <p className="text-sm font-medium text-text-primary">{selectedChannel.type}</p>
              </div>
              <div>
                <p className="text-xs text-text-muted">Category</p>
                <p className="text-sm font-medium text-text-primary">{selectedChannel.category || '-'}</p>
              </div>
              <div>
                <p className="text-xs text-text-muted">Members</p>
                <p className="text-sm font-medium text-text-primary">{selectedChannel.memberCount}</p>
              </div>
              <div>
                <p className="text-xs text-text-muted">Max Participants</p>
                <p className="text-sm font-medium text-text-primary">{selectedChannel.maxParticipants}</p>
              </div>
            </div>

            {/* Edit Channel Form */}
            <form onSubmit={handleUpdateChannel} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-text-muted mb-1">Name</label>
                  <Input
                    value={editChannel.name}
                    onChange={(e) => setEditChannel({ ...editChannel, name: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-xs text-text-muted mb-1">Category</label>
                  <Input
                    value={editChannel.category}
                    onChange={(e) => setEditChannel({ ...editChannel, category: e.target.value })}
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs text-text-muted mb-1">Description</label>
                <Input
                  value={editChannel.description}
                  onChange={(e) => setEditChannel({ ...editChannel, description: e.target.value })}
                />
              </div>
              <div className="flex gap-3">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={editChannel.isActive}
                    onChange={(e) => setEditChannel({ ...editChannel, isActive: e.target.checked })}
                    className="w-4 h-4 rounded border-border"
                  />
                  <span className="text-sm text-text-secondary">Active</span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={editChannel.isLocked}
                    onChange={(e) => setEditChannel({ ...editChannel, isLocked: e.target.checked })}
                    className="w-4 h-4 rounded border-border"
                  />
                  <span className="text-sm text-text-secondary">Locked</span>
                </label>
              </div>
              <Button type="submit" size="sm" className="w-full">
                <Save className="w-4 h-4 mr-2" />
                Update Channel
              </Button>
            </form>

            {/* Members List */}
            <div>
              <h4 className="text-sm font-medium text-text-primary mb-2">Channel Members</h4>
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {selectedChannel.members && selectedChannel.members.length > 0 ? (
                  selectedChannel.members.map((member) => (
                    <div key={member.id} className="flex items-center justify-between p-2 bg-background-hover rounded-lg">
                      <div className="flex items-center gap-2">
                        <Avatar fallback={member.displayName || member.username} size="sm" />
                        <div>
                          <p className="text-sm font-medium text-text-primary">
                            {member.displayName || member.username}
                          </p>
                          {member.email && (
                            <p className="text-xs text-text-muted">{member.email}</p>
                          )}
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleRemoveChannelMember(selectedChannel.id, member.id)}
                        className="w-8 h-8 text-text-muted hover:text-error"
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  ))
                ) : (
                  <p className="text-center text-text-muted py-4">No members in this channel</p>
                )}
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

export default AdminPage;
