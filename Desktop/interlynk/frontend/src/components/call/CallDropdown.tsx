import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Phone, Video, PhoneCall, X, UsersRound, Search } from 'lucide-react';
import { ScrollArea } from '@/components/ui';
import { cn } from '@/lib/utils';

interface CallDropdownProps {
  onSelectIndividual: (member: any, type: 'voice' | 'video') => void;
  onSelectGroup: (type: 'voice' | 'video') => void;
  onClose: () => void;
  isLoading: boolean;
  members: any[];
  currentUser: any;
  channelName?: string;
}

export function CallDropdown({ 
  onSelectIndividual, 
  onSelectGroup, 
  onClose, 
  isLoading, 
  members, 
  currentUser,
  channelName
}: CallDropdownProps) {
  const [search, setSearch] = useState('');
  
  const filteredMembers = members.filter(m => 
    String(m.id) !== String(currentUser?.id) && 
    (m.displayName?.toLowerCase().includes(search.toLowerCase()) || 
     m.username?.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.92, y: -8 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.92, y: -8 }}
      transition={{ duration: 0.15, ease: 'easeOut' }}
      className="absolute top-full right-0 mt-2 w-80 z-[300] rounded-2xl border border-white/10 overflow-hidden flex flex-col max-h-[480px]"
      style={{
        background: 'linear-gradient(135deg, rgba(22,27,34,0.98) 0%, rgba(13,17,23,0.98) 100%)',
        backdropFilter: 'blur(24px)',
        boxShadow: '0 24px 48px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.05)',
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-4 pb-2 text-left">
        <div>
          <p className="text-xs font-semibold text-white/40 uppercase tracking-widest">Start a Call</p>
          {channelName && (
            <p className="text-sm font-medium text-white/70 truncate">#{channelName}</p>
          )}
        </div>
        <button
          onClick={onClose}
          className="w-6 h-6 rounded-full flex items-center justify-center hover:bg-white/10 transition-colors"
        >
          <X className="w-3.5 h-3.5 text-white/50" />
        </button>
      </div>

      <div className="p-3 space-y-3">
        {/* Group Call Section */}
        <div className="space-y-1.5">
          <p className="px-2 text-[10px] font-bold text-indigo-400 uppercase tracking-widest text-left">Channel Group Call</p>
          <div className="flex gap-2">
            <button
              onClick={() => onSelectGroup('voice')}
              disabled={isLoading}
              className="flex-1 flex flex-col items-center gap-1.5 p-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 transition-all group"
            >
              <UsersRound className="w-5 h-5 text-white/60 group-hover:text-white" />
              <span className="text-[10px] font-medium text-white/50 group-hover:text-white/80">Voice Group</span>
            </button>
            <button
              onClick={() => onSelectGroup('video')}
              disabled={isLoading}
              className="flex-1 flex flex-col items-center gap-1.5 p-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 transition-all group"
            >
              <PhoneCall className="w-5 h-5 text-white/60 group-hover:text-white" />
              <span className="text-[10px] font-medium text-white/50 group-hover:text-white/80">Video Meeting</span>
            </button>
          </div>
        </div>

        {/* Divider */}
        <div className="h-px bg-white/5 mx-2" />

        {/* Individual Call Section */}
        <div className="flex flex-col flex-1 min-h-0">
          <p className="px-2 pb-2 text-[10px] font-bold text-emerald-400 uppercase tracking-widest text-left">Call a Person</p>
          
          {/* Search Bar */}
          <div className="relative mx-2 mb-2">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/30" />
            <input 
              type="text"
              placeholder="Search members..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-lg py-1.5 pl-8 pr-3 text-xs text-white placeholder:text-white/20 focus:outline-none focus:border-white/20 transition-all"
            />
          </div>

          <ScrollArea className="flex-1 px-1">
            <div className="space-y-1 py-1">
              {filteredMembers.length > 0 ? (
                filteredMembers.map((member) => (
                  <div 
                    key={member.id}
                    className="flex items-center justify-between p-2 rounded-xl hover:bg-white/5 transition-all group"
                  >
                    <div className="flex items-center gap-3 overflow-hidden">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500/20 to-purple-500/20 flex items-center justify-center border border-white/10 flex-shrink-0">
                        {member.avatarUrl ? (
                          <img src={member.avatarUrl} alt="" className="w-full h-full rounded-full object-cover" />
                        ) : (
                          <span className="text-xs font-bold text-white/60">
                            {member.displayName?.charAt(0).toUpperCase() || member.username?.charAt(0).toUpperCase()}
                          </span>
                        )}
                      </div>
                      <div className="flex flex-col min-w-0 text-left">
                        <span className="text-sm font-medium text-white/90 truncate">{member.displayName || member.username}</span>
                        <span className="text-[10px] text-white/30 truncate">@{member.username}</span>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-1 opacity-40 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => onSelectIndividual(member, 'voice')}
                        disabled={isLoading}
                        className="p-2 rounded-lg hover:bg-emerald-500/20 hover:text-emerald-400 text-white/40 transition-all"
                      >
                        <Phone className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => onSelectIndividual(member, 'video')}
                        disabled={isLoading}
                        className="p-2 rounded-lg hover:bg-indigo-500/20 hover:text-indigo-400 text-white/40 transition-all"
                      >
                        <Video className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))
              ) : (
                <div className="p-8 text-center">
                  <p className="text-xs text-white/20 italic">No members found</p>
                </div>
              )}
            </div>
          </ScrollArea>
        </div>
      </div>

      {/* Loading indicator */}
      {isLoading && (
        <div className="px-4 pb-4 pt-1 flex items-center justify-center gap-2 text-[10px] text-white/40 border-t border-white/5 bg-black/20">
          <div className="w-3 h-3 border border-white/30 border-t-white/70 rounded-full animate-spin" />
          Setting up call connection…
        </div>
      )}
    </motion.div>
  );
}
