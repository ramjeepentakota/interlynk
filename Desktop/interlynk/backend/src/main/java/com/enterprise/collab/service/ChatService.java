package com.enterprise.collab.service;

import com.enterprise.collab.dto.CallDto;
import com.enterprise.collab.dto.ChatDto;
import com.enterprise.collab.entity.*;
import com.enterprise.collab.exception.BadRequestException;
import com.enterprise.collab.exception.ConflictException;
import com.enterprise.collab.exception.ForbiddenException;
import com.enterprise.collab.exception.ResourceNotFoundException;
import com.enterprise.collab.repository.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class ChatService {
    
    private final ChannelRepository channelRepository;
    private final MessageRepository messageRepository;
    private final UserRepository userRepository;
    private final ReactionRepository reactionRepository;
    private final TeamRepository teamRepository;
    private final TeamMemberRepository teamMemberRepository;
    private final CallRoomRepository callRoomRepository;
    private final CallParticipantRepository callParticipantRepository;
    private final AttachmentRepository attachmentRepository;
    private final SimpMessagingTemplate messagingTemplate;
    private final AuditService auditService;
    private final MentionService mentionService;
    private final WebhookService webhookService;
    
    @Value("${app.storage.uploads-path:${app.storage.base-path:/opt/company-platform}/uploads}")
    private String uploadsPath;
    
    // ============ Channel CRUD Operations ============
    
    @Transactional
    public ChatDto.ChannelResponse createChannel(String name, String description, 
            Channel.ChannelType type, Long teamId, String username) {
        User creator = userRepository.findByUsername(username)
                .orElseThrow(() -> new ResourceNotFoundException("User", "username", username));
        
        Team team = null;
        if (teamId != null) {
            team = teamRepository.findById(teamId)
                    .orElseThrow(() -> new ResourceNotFoundException("Team", "id", teamId));
            
            // Check if channel name already exists in team
            if (channelRepository.existsByNameAndTeamId(name, teamId)) {
                throw new ConflictException("Channel with this name already exists in the team");
            }
        } else {
            // Check if channel name already exists without a team
            if (channelRepository.existsByNameAndNoTeam(name)) {
                throw new ConflictException("Channel with this name already exists");
            }
        }
        
        Channel channel = Channel.builder()
                .name(name)
                .description(description)
                .type(type)
                .team(team)
                .createdBy(creator)
                .isActive(true)
                .position(getNextChannelPosition(teamId))
                .maxParticipants(type == Channel.ChannelType.VOICE ? 25 : null)
                .isLocked(false)
                .build();
        
        // Add creator as member
        Set<User> members = new HashSet<>();
        members.add(creator);
        channel.setMembers(members);
        
        // If team is provided, add all team members to the channel
        if (team != null) {
            List<TeamMember> teamMembers = teamMemberRepository.findByTeamId(teamId);
            for (TeamMember tm : teamMembers) {
                channel.getMembers().add(tm.getUser());
            }
        }
        
        channel = channelRepository.save(channel);

        log.info("Channel created: {} by {}", name, username);
        auditService.record(username, "CHANNEL_CREATED", "Channel", channel.getId(), "name=" + name);
        webhookService.emit("channel.created", mapToChannelResponse(channel));

        // Broadcast channel creation
        messagingTemplate.convertAndSend("/topic/channels", mapToChannelListResponse(channel));

        return mapToChannelResponse(channel);
    }
    
    private int getNextChannelPosition(Long teamId) {
        List<Channel> channels;
        if (teamId != null) {
            channels = channelRepository.findByTeamIdOrderByPositionAsc(teamId);
        } else {
            channels = channelRepository.findAll();
        }
        return channels.isEmpty() ? 0 : channels.stream()
                .mapToInt(c -> c.getPosition() != null ? c.getPosition() : 0)
                .max()
                .orElse(0) + 1;
    }
    
    @Transactional
    public ChatDto.ChannelResponse updateChannel(Long channelId, ChatDto.UpdateChannelRequest request, String username) {
        User user = userRepository.findByUsername(username)
                .orElseThrow(() -> new ResourceNotFoundException("User", "username", username));
        
        Channel channel = channelRepository.findById(channelId)
                .orElseThrow(() -> new ResourceNotFoundException("Channel", "id", channelId));
        
        // Check permission - only creator or admin can update
        if (!channel.getCreatedBy().getId().equals(user.getId()) && !user.hasRole("ADMIN")) {
            throw new ForbiddenException("You don't have permission to update this channel");
        }
        
        if (request.getName() != null && !request.getName().trim().isEmpty()) {
            // Check if name already exists in team
            Long teamId = channel.getTeam() != null ? channel.getTeam().getId() : null;
            if (teamId != null && channelRepository.existsByNameAndTeamId(request.getName(), teamId)) {
                Optional<Channel> existingChannel = channelRepository.findByNameAndTeamId(request.getName(), teamId);
                if (existingChannel.isPresent() && !existingChannel.get().getId().equals(channelId)) {
                    throw new ConflictException("Channel with this name already exists in the team");
                }
            }
            channel.setName(request.getName());
        }
        
        if (request.getDescription() != null) {
            channel.setDescription(request.getDescription());
        }
        
        if (request.getType() != null) {
            try {
                channel.setType(Channel.ChannelType.valueOf(request.getType().toUpperCase()));
            } catch (IllegalArgumentException e) {
                throw new BadRequestException("Invalid channel type");
            }
        }
        
        if (request.getCategory() != null) {
            channel.setCategory(request.getCategory());
        }
        
        if (request.getPosition() != null) {
            channel.setPosition(request.getPosition());
        }
        
        if (request.getMaxParticipants() != null) {
            channel.setMaxParticipants(request.getMaxParticipants());
        }
        
        if (request.getIsLocked() != null) {
            channel.setIsLocked(request.getIsLocked());
        }
        
        if (request.getIsActive() != null) {
            channel.setIsActive(request.getIsActive());
        }
        
        channel = channelRepository.save(channel);
        
        log.info("Channel {} updated by {}", channelId, username);
        
        // Broadcast channel update
        Map<String, Object> updateMap = new HashMap<>();
        updateMap.put("type", "channel_updated");
        updateMap.put("channel", mapToChannelResponse(channel));
        messagingTemplate.convertAndSend("/topic/channel/" + channelId, updateMap);
        
        return mapToChannelResponse(channel);
    }
    
    @Transactional
    public void deleteChannel(Long channelId, String username) {
        User user = userRepository.findByUsername(username)
                .orElseThrow(() -> new ResourceNotFoundException("User", "username", username));
        
        Channel channel = channelRepository.findById(channelId)
                .orElseThrow(() -> new ResourceNotFoundException("Channel", "id", channelId));
        
        // Check permission - only creator or admin can delete
        if (!channel.getCreatedBy().getId().equals(user.getId()) && !user.hasRole("ADMIN")) {
            throw new ForbiddenException("You don't have permission to delete this channel");
        }
        
        // Delete all messages in the channel first
        List<Message> messages = messageRepository.findByChannelId(channelId, PageRequest.of(0, Integer.MAX_VALUE)).getContent();
        for (Message msg : messages) {
            reactionRepository.deleteAllByMessageId(msg.getId());
            msg.getAttachments().clear();
        }
        messageRepository.deleteAll(messages);
        
        // If there's a linked voice room, deactivate it
        if (channel.getVoiceRoom() != null) {
            CallRoom voiceRoom = channel.getVoiceRoom();
            voiceRoom.setIsActive(false);
            voiceRoom.setEndedAt(LocalDateTime.now());
            callRoomRepository.save(voiceRoom);
        }
        
        channelRepository.delete(channel);

        log.info("Channel {} deleted by {}", channelId, username);
        auditService.record(username, "CHANNEL_DELETED", "Channel", channelId);
        
        // Broadcast channel deletion
        Map<String, Object> deleteMap = new HashMap<>();
        deleteMap.put("type", "channel_deleted");
        deleteMap.put("channelId", channelId);
        messagingTemplate.convertAndSend("/topic/channels", deleteMap);
    }
    
    @Transactional(readOnly = true)
    public List<ChatDto.ChannelListResponse> getUserChannels(String username) {
        User user = userRepository.findByUsername(username)
                .orElseThrow(() -> new ResourceNotFoundException("User", "username", username));

        List<Channel> channels;

        // Admin users see all active channels, regular users only see their member channels
        // FIX: Use findChannelsForUser with userId for consistent DB-level security
        // Previously used findByMembersContaining which had issues with many-to-many relationships
        if (user.hasRole("ADMIN")) {
            channels = channelRepository.findAllActiveChannels();
        } else {
            channels = channelRepository.findChannelsForUser(user.getId());
        }

        return channels.stream()
                .map(this::mapToChannelListResponse)
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public ChatDto.ChannelResponse getChannel(Long channelId, String username) {
        User user = userRepository.findByUsername(username)
                .orElseThrow(() -> new ResourceNotFoundException("User", "username", username));
        
        // DB-LEVEL SECURITY: Use repository method to verify membership at database level
        boolean isMember = channelRepository.isUserMember(channelId, user.getId());
        if (!isMember && !user.hasRole("ADMIN")) {
            throw new ForbiddenException("You are not a member of this channel");
        }
        
        Channel channel = channelRepository.findById(channelId)
                .orElseThrow(() -> new ResourceNotFoundException("Channel", "id", channelId));
        
        return mapToChannelResponse(channel);
    }
    
    // ============ Team-Channel Management ============
    
    @Transactional
    public ChatDto.ChannelResponse addTeamToChannel(Long channelId, Long teamId, String username) {
        User user = userRepository.findByUsername(username)
                .orElseThrow(() -> new ResourceNotFoundException("User", "username", username));
        
        Channel channel = channelRepository.findById(channelId)
                .orElseThrow(() -> new ResourceNotFoundException("Channel", "id", channelId));
        
        Team team = teamRepository.findById(teamId)
                .orElseThrow(() -> new ResourceNotFoundException("Team", "id", teamId));
        
        // Check permission
        if (!channel.getCreatedBy().getId().equals(user.getId()) && !user.hasRole("ADMIN")) {
            throw new ForbiddenException("You don't have permission to add teams to this channel");
        }
        
        // Add team to channel
        channel.setTeam(team);
        
        // Add all team members to channel
        List<TeamMember> teamMembers = teamMemberRepository.findByTeamId(teamId);
        for (TeamMember tm : teamMembers) {
            channel.getMembers().add(tm.getUser());
        }
        
        channel = channelRepository.save(channel);
        
        log.info("Team {} added to channel {} by {}", teamId, channelId, username);
        
        // Notify channel members
        Map<String, Object> teamAddMap = new HashMap<>();
        teamAddMap.put("type", "team_added");
        teamAddMap.put("teamId", teamId);
        teamAddMap.put("teamName", team.getName());
        messagingTemplate.convertAndSend("/topic/channel/" + channelId, teamAddMap);
        
        return mapToChannelResponse(channel);
    }
    
    @Transactional
    public ChatDto.ChannelResponse removeTeamFromChannel(Long channelId, String username) {
        User user = userRepository.findByUsername(username)
                .orElseThrow(() -> new ResourceNotFoundException("User", "username", username));
        
        Channel channel = channelRepository.findById(channelId)
                .orElseThrow(() -> new ResourceNotFoundException("Channel", "id", channelId));
        
        // Check permission
        if (!channel.getCreatedBy().getId().equals(user.getId()) && !user.hasRole("ADMIN")) {
            throw new ForbiddenException("You don't have permission to remove teams from this channel");
        }
        
        if (channel.getTeam() == null) {
            throw new BadRequestException("No team is associated with this channel");
        }
        
        Long teamId = channel.getTeam().getId();
        String teamName = channel.getTeam().getName();
        
        // Remove all team members from channel
        List<TeamMember> teamMembers = teamMemberRepository.findByTeamId(teamId);
        for (TeamMember tm : teamMembers) {
            channel.getMembers().remove(tm.getUser());
        }
        
        channel.setTeam(null);
        channel = channelRepository.save(channel);
        
        log.info("Team {} removed from channel {} by {}", teamId, channelId, username);
        
        // Notify channel members
        Map<String, Object> teamRemoveMap = new HashMap<>();
        teamRemoveMap.put("type", "team_removed");
        teamRemoveMap.put("teamId", teamId);
        teamRemoveMap.put("teamName", teamName);
        messagingTemplate.convertAndSend("/topic/channel/" + channelId, teamRemoveMap);
        
        return mapToChannelResponse(channel);
    }
    
    public List<ChatDto.ChannelByTeamResponse> getChannelsByTeam(Long teamId) {
        teamRepository.findById(teamId)
                .orElseThrow(() -> new ResourceNotFoundException("Team", "id", teamId));
        
        List<Channel> channels = channelRepository.findByTeamIdOrderByPositionAsc(teamId);
        
        return channels.stream()
                .map(c -> ChatDto.ChannelByTeamResponse.builder()
                        .channelId(c.getId())
                        .channelName(c.getName())
                        .channelType(c.getType().name())
                        .category(c.getCategory())
                        .position(c.getPosition())
                        .isLocked(c.getIsLocked())
                        .memberCount(c.getMembers().size())
                        .build())
                .collect(Collectors.toList());
    }
    
    @Transactional(readOnly = true)
    public List<ChatDto.ChannelListResponse> getTextChannelsByTeam(Long teamId) {
        teamRepository.findById(teamId)
                .orElseThrow(() -> new ResourceNotFoundException("Team", "id", teamId));
        
        List<Channel> channels = channelRepository.findTextChannelsByTeamId(teamId);
        
        return channels.stream()
                .map(this::mapToChannelListResponse)
                .collect(Collectors.toList());
    }
    
    @Transactional(readOnly = true)
    public List<ChatDto.ChannelListResponse> getVoiceChannelsByTeam(Long teamId) {
        teamRepository.findById(teamId)
                .orElseThrow(() -> new ResourceNotFoundException("Team", "id", teamId));
        
        List<Channel> channels = channelRepository.findVoiceChannelsByTeamId(teamId);
        
        return channels.stream()
                .map(this::mapToChannelListResponse)
                .collect(Collectors.toList());
    }
    
    public List<String> getAllCategories() {
        return channelRepository.findAllCategories();
    }
    
    // ============ Voice Channel Operations ============
    
    @Transactional
    public CallDto.CallRoomResponse joinVoiceChannel(Long channelId, String username) {
        User user = userRepository.findByUsername(username)
                .orElseThrow(() -> new ResourceNotFoundException("User", "username", username));
        
        Channel channel = channelRepository.findById(channelId)
                .orElseThrow(() -> new ResourceNotFoundException("Channel", "id", channelId));
        
        // Verify this is a voice channel
        if (channel.getType() != Channel.ChannelType.VOICE) {
            throw new BadRequestException("This is not a voice channel");
        }
        
        // Check if channel is active
        if (channel.getIsActive() == null || !channel.getIsActive()) {
            throw new BadRequestException("This channel is no longer active");
        }
        
        // Check if channel is locked
        if (channel.getIsLocked() != null && channel.getIsLocked()) {
            throw new ForbiddenException("This voice channel is locked");
        }
        
        // Check max participants
        if (channel.getMaxParticipants() != null) {
            CallRoom existingRoom = channel.getVoiceRoom();
            if (existingRoom != null && existingRoom.getIsActive()) {
                long currentParticipants = existingRoom.getParticipants().stream()
                        .filter(p -> p.getLeftAt() == null)
                        .count();
                if (currentParticipants >= channel.getMaxParticipants()) {
                    throw new BadRequestException("Voice channel is full");
                }
            }
        }
        
        // Check if user is a member (admins may always join)
        if (!channel.getMembers().contains(user) && !user.hasRole("ADMIN")) {
            throw new ForbiddenException("You are not a member of this channel");
        }
        
        // Get or create voice room
        CallRoom voiceRoom = channel.getVoiceRoom();
        if (voiceRoom == null || !voiceRoom.getIsActive()) {
            voiceRoom = CallRoom.builder()
                    .name("Voice: " + channel.getName())
                    .type(CallRoom.CallRoomType.VOICE_CHANNEL)
                    .createdBy(user)
                    .isActive(true)
                    .build();
            voiceRoom = callRoomRepository.save(voiceRoom);
            
            // Link voice room to channel
            channel.setVoiceRoom(voiceRoom);
            channelRepository.save(channel);
        }
        
        // Add participant to voice room
        CallParticipant participant = CallParticipant.builder()
                .callRoom(voiceRoom)
                .user(user)
                .joinedAt(LocalDateTime.now())
                .isMuted(false)
                .isVideoEnabled(true)
                .isScreenSharing(false)
                .build();
        callParticipantRepository.save(participant);
        
        log.info("User {} joined voice channel {}", username, channelId);
        
        // Broadcast voice channel join
        Map<String, Object> voiceJoinMap = new HashMap<>();
        voiceJoinMap.put("type", "voice_join");
        voiceJoinMap.put("userId", user.getId());
        voiceJoinMap.put("username", username);
        messagingTemplate.convertAndSend("/topic/channel/" + channelId, voiceJoinMap);
        
        return mapToCallRoomResponse(voiceRoom);
    }
    
    @Transactional
    public void leaveVoiceChannel(Long channelId, String username) {
        User user = userRepository.findByUsername(username)
                .orElseThrow(() -> new ResourceNotFoundException("User", "username", username));
        
        Channel channel = channelRepository.findById(channelId)
                .orElseThrow(() -> new ResourceNotFoundException("Channel", "id", channelId));
        
        CallRoom voiceRoom = channel.getVoiceRoom();
        if (voiceRoom == null || !voiceRoom.getIsActive()) {
            throw new BadRequestException("No active voice session in this channel");
        }
        
        // Find and remove participant
        CallParticipant participant = callParticipantRepository
                .findByCallRoomIdAndUserId(voiceRoom.getId(), user.getId())
                .orElseThrow(() -> new ResourceNotFoundException("You are not in this voice channel"));
        
        participant.setLeftAt(LocalDateTime.now());
        callParticipantRepository.save(participant);
        
        log.info("User {} left voice channel {}", username, channelId);
        
        // Broadcast voice channel leave
        Map<String, Object> voiceLeaveMap = new HashMap<>();
        voiceLeaveMap.put("type", "voice_leave");
        voiceLeaveMap.put("userId", user.getId());
        voiceLeaveMap.put("username", username);
        messagingTemplate.convertAndSend("/topic/channel/" + channelId, voiceLeaveMap);
        
        // Check if room is empty, if so end the call
        List<CallParticipant> activeParticipants = callParticipantRepository
                .findByCallRoomIdAndLeftAtIsNull(voiceRoom.getId());
        
        if (activeParticipants.isEmpty()) {
            voiceRoom.setIsActive(false);
            voiceRoom.setEndedAt(LocalDateTime.now());
            callRoomRepository.save(voiceRoom);
            
            Map<String, Object> voiceEndedMap = new HashMap<>();
            voiceEndedMap.put("type", "voice_ended");
            messagingTemplate.convertAndSend("/topic/channel/" + channelId, voiceEndedMap);
        }
    }
    
    @Transactional(readOnly = true)
    public CallDto.CallRoomResponse getVoiceChannelStatus(Long channelId) {
        Channel channel = channelRepository.findById(channelId)
                .orElseThrow(() -> new ResourceNotFoundException("Channel", "id", channelId));
        
        CallRoom voiceRoom = channel.getVoiceRoom();
        if (voiceRoom == null) {
            return null;
        }
        
        return mapToCallRoomResponse(voiceRoom);
    }
    
    // ============ Channel Member Operations ============
    
    @Transactional
    public ChatDto.ChannelResponse addMemberToChannel(Long channelId, String targetUsername, String requestingUsername) {
        User targetUser = userRepository.findByUsername(targetUsername)
                .orElseThrow(() -> new ResourceNotFoundException("User", "username", targetUsername));
        
        User requestingUser = userRepository.findByUsername(requestingUsername)
                .orElseThrow(() -> new ResourceNotFoundException("User", "username", requestingUsername));
        
        Channel channel = channelRepository.findById(channelId)
                .orElseThrow(() -> new ResourceNotFoundException("Channel", "id", channelId));
        
        // Check permission - only creator or admin can add members
        if (!channel.getCreatedBy().getId().equals(requestingUser.getId()) && !requestingUser.hasRole("ADMIN")) {
            throw new ForbiddenException("You don't have permission to add members to this channel");
        }
        
        if (channel.getIsLocked() != null && channel.getIsLocked()) {
            throw new ForbiddenException("This channel is locked");
        }
        
        if (channel.getMembers().contains(targetUser)) {
            throw new BadRequestException("User is already a member of this channel");
        }
        
        channel.getMembers().add(targetUser);
        channel = channelRepository.save(channel);
        
        log.info("User {} added to channel {} by {}", targetUsername, channel.getName(), requestingUsername);
        
        // Notify the user and channel
        Map<String, Object> addMemberMap = new HashMap<>();
        addMemberMap.put("type", "added_to_channel");
        addMemberMap.put("channelId", channelId);
        addMemberMap.put("channelName", channel.getName());
        messagingTemplate.convertAndSend("/topic/user/" + targetUsername, addMemberMap);
        
        Map<String, Object> memberAddedMap = new HashMap<>();
        memberAddedMap.put("type", "member_added");
        memberAddedMap.put("username", targetUsername);
        messagingTemplate.convertAndSend("/topic/channel/" + channelId, memberAddedMap);
        
        return mapToChannelResponse(channel);
    }
    
    @Transactional
    public ChatDto.ChannelResponse removeMemberFromChannel(Long channelId, String targetUsername, String requestingUsername) {
        User targetUser = userRepository.findByUsername(targetUsername)
                .orElseThrow(() -> new ResourceNotFoundException("User", "username", targetUsername));
        
        User requestingUser = userRepository.findByUsername(requestingUsername)
                .orElseThrow(() -> new ResourceNotFoundException("User", "username", requestingUsername));
        
        Channel channel = channelRepository.findById(channelId)
                .orElseThrow(() -> new ResourceNotFoundException("Channel", "id", channelId));
        
        // Check permission - only creator or admin can remove members
        if (!channel.getCreatedBy().getId().equals(requestingUser.getId()) && !requestingUser.hasRole("ADMIN")) {
            throw new ForbiddenException("You don't have permission to remove members from this channel");
        }
        
        // Prevent removing the channel creator
        if (channel.getCreatedBy().getId().equals(targetUser.getId())) {
            throw new BadRequestException("Cannot remove the channel creator");
        }
        
        if (!channel.getMembers().contains(targetUser)) {
            throw new BadRequestException("User is not a member of this channel");
        }
        
        channel.getMembers().remove(targetUser);
        channel = channelRepository.save(channel);
        
        log.info("User {} removed from channel {} by {}", targetUsername, channel.getName(), requestingUsername);
        
        // Notify the user and channel
        Map<String, Object> removeMemberMap = new HashMap<>();
        removeMemberMap.put("type", "removed_from_channel");
        removeMemberMap.put("channelId", channelId);
        removeMemberMap.put("channelName", channel.getName());
        messagingTemplate.convertAndSend("/topic/user/" + targetUsername, removeMemberMap);
        
        Map<String, Object> memberRemovedMap = new HashMap<>();
        memberRemovedMap.put("type", "member_removed");
        memberRemovedMap.put("username", targetUsername);
        messagingTemplate.convertAndSend("/topic/channel/" + channelId, memberRemovedMap);
        
        return mapToChannelResponse(channel);
    }
    
    // ============ Message Operations ============
    
    @Transactional
    public ChatDto.MessageResponse sendMessage(Long channelId, String content, String username, List<ChatDto.AttachmentDto> attachments) {
        User sender = userRepository.findByUsername(username)
                .orElseThrow(() -> new ResourceNotFoundException("User", "username", username));
        
        Channel channel = channelRepository.findById(channelId)
                .orElseThrow(() -> new ResourceNotFoundException("Channel", "id", channelId));
        
        // Check if user is a member of the channel - CONFIDENTIALITY FIX
        if (!channel.getMembers().contains(sender)) {
            throw new ForbiddenException("You are not a member of this channel");
        }
        
        // Input validation - prevent abuse with excessively long messages
        if (content != null && content.length() > 10000) {
            throw new BadRequestException("Message content exceeds maximum length of 10000 characters");
        }
        
        Message message = Message.builder()
                .channel(channel)
                .sender(sender)
                .content(content)
                .messageType(Message.MessageType.TEXT)
                .build();
        
        message = messageRepository.save(message);
        
        // Save attachments if provided — must happen BEFORE broadcast so real-time
        // subscribers receive the complete message including attachments.
        if (attachments != null && !attachments.isEmpty()) {
            for (ChatDto.AttachmentDto att : attachments) {
                Attachment attachment = Attachment.builder()
                        .message(message)
                        .fileName(att.getFileName())
                        .filePath(att.getFileUrl())  // Store the relative web URL as filePath
                        .fileSize(att.getFileSize())
                        .mimeType(att.getFileType())
                        .build();
                attachmentRepository.save(attachment);
            }
        }
        
        // Broadcast AFTER attachments are persisted so the mapped response includes them
        ChatDto.MessageResponse response = mapToMessageResponse(message);
        messagingTemplate.convertAndSend("/topic/channel/" + channelId, response);

        // Fan out @mentions as personal notifications (async, never blocks send).
        mentionService.notifyMentions(message);

        // Outbound webhook event (no-op if no subscribers).
        webhookService.emit("message.created", response);

        log.debug("Message sent to channel {} by {}", channelId, username);

        return response;
    }
    
    @Transactional(readOnly = true)
    public ChatDto.MessageListResponse getChannelMessages(Long channelId, String username, int page, int size) {
        User user = userRepository.findByUsername(username)
                .orElseThrow(() -> new ResourceNotFoundException("User", "username", username));
        
        // DB-LEVEL SECURITY: Use repository method to verify membership at database level
        // This provides defense-in-depth beyond application-level checks
        boolean isMember = channelRepository.isUserMember(channelId, user.getId());
        if (!isMember && !user.hasRole("ADMIN")) {
            throw new ForbiddenException("You are not a member of this channel");
        }
        
        Channel channel = channelRepository.findById(channelId)
                .orElseThrow(() -> new ResourceNotFoundException("Channel", "id", channelId));
        
        Pageable pageable = PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "createdAt"));
        Page<Message> messagePage = messageRepository.findByChannelId(channelId, pageable);
        
        List<ChatDto.MessageResponse> messages = messagePage.getContent().stream()
                .map(this::mapToMessageResponse)
                .collect(Collectors.toList());
        
        List<ChatDto.MessageResponse> modifiableMessages = new java.util.ArrayList<>(messages);
        Collections.reverse(modifiableMessages);
        
        return ChatDto.MessageListResponse.builder()
                .messages(modifiableMessages)
                .page(page)
                .size(size)
                .totalElements(messagePage.getTotalElements())
                .totalPages(messagePage.getTotalPages())
                .hasNext(messagePage.hasNext())
                .hasPrevious(messagePage.hasPrevious())
                .build();
    }
    
    // ============ Thread Operations ============
    
    @Transactional
    public ChatDto.MessageResponse replyToMessage(Long messageId, String content, String username) {
        User sender = userRepository.findByUsername(username)
                .orElseThrow(() -> new ResourceNotFoundException("User", "username", username));
        
        Message parentMessage = messageRepository.findById(messageId)
                .orElseThrow(() -> new ResourceNotFoundException("Message", "id", messageId));
        
        Channel channel = parentMessage.getChannel();
        
        // Check if user is a member of the channel - CONFIDENTIALITY FIX
        if (!channel.getMembers().contains(sender) && !sender.hasRole("ADMIN")) {
            throw new ForbiddenException("You are not a member of this channel");
        }
        
        Message reply = Message.builder()
                .channel(channel)
                .sender(sender)
                .parent(parentMessage)
                .content(content)
                .messageType(Message.MessageType.TEXT)
                .build();
        
        reply = messageRepository.save(reply);
        
        // Broadcast to channel topic
        ChatDto.MessageResponse response = mapToMessageResponse(reply);
        messagingTemplate.convertAndSend("/topic/channel/" + parentMessage.getChannel().getId(), response);

        // Thread replies also fan-out @mentions, and notify the parent author.
        mentionService.notifyMentions(reply);
        mentionService.notifyThreadReply(reply);

        return response;
    }
    
    @Transactional(readOnly = true)
    public ChatDto.ThreadResponse getThread(Long messageId, String username) {
        User user = userRepository.findByUsername(username)
                .orElseThrow(() -> new ResourceNotFoundException("User", "username", username));
        
        Message parentMessage = messageRepository.findById(messageId)
                .orElseThrow(() -> new ResourceNotFoundException("Message", "id", messageId));
        
        Channel channel = parentMessage.getChannel();
        
        // Check if user is a member of the channel - CONFIDENTIALITY FIX
        if (!channel.getMembers().contains(user) && !user.hasRole("ADMIN")) {
            throw new ForbiddenException("You are not a member of this channel");
        }
        
        List<Message> replies = messageRepository.findByParentIdOrderByCreatedAtAsc(messageId);
        
        return ChatDto.ThreadResponse.builder()
                .parentMessage(mapToMessageResponse(parentMessage))
                .replies(replies.stream().map(this::mapToMessageResponse).collect(Collectors.toList()))
                .totalReplies(replies.size())
                .build();
    }
    
    // ============ Reaction Operations ============
    
    @Transactional
    public ChatDto.ReactionDto addReaction(Long messageId, String emoji, String username) {
        User user = userRepository.findByUsername(username)
                .orElseThrow(() -> new ResourceNotFoundException("User", "username", username));
        
        Message message = messageRepository.findById(messageId)
                .orElseThrow(() -> new ResourceNotFoundException("Message", "id", messageId));
        
        Channel channel = message.getChannel();
        
        // Check if user is a member of the channel - CONFIDENTIALITY FIX
        if (!channel.getMembers().contains(user) && !user.hasRole("ADMIN")) {
            throw new ForbiddenException("You are not a member of this channel");
        }
        
        // Check if reaction already exists
        Reaction existing = reactionRepository.findByMessageIdAndUserIdAndEmoji(messageId, user.getId(), emoji);
        if (existing != null) {
            return mapToReactionDto(existing);
        }
        
        Reaction reaction = Reaction.builder()
                .message(message)
                .user(user)
                .emoji(emoji)
                .build();
        
        reaction = reactionRepository.save(reaction);
        
        // Broadcast reaction update
        Map<String, Object> reactionMap = new java.util.HashMap<>();
        reactionMap.put("type", "reaction_added");
        reactionMap.put("messageId", messageId);
        reactionMap.put("emoji", emoji);
        reactionMap.put("user", username);
        messagingTemplate.convertAndSend("/topic/channel/" + message.getChannel().getId(), reactionMap);
        
        return mapToReactionDto(reaction);
    }
    
    @Transactional
    public void removeReaction(Long messageId, String emoji, String username) {
        User user = userRepository.findByUsername(username)
                .orElseThrow(() -> new ResourceNotFoundException("User", "username", username));
        
        Message message = messageRepository.findById(messageId)
                .orElseThrow(() -> new ResourceNotFoundException("Message", "id", messageId));
        
        Channel channel = message.getChannel();
        
        // Check if user is a member of the channel - CONFIDENTIALITY FIX
        if (!channel.getMembers().contains(user) && !user.hasRole("ADMIN")) {
            throw new ForbiddenException("You are not a member of this channel");
        }
        
        Reaction reaction = reactionRepository.findByMessageIdAndUserIdAndEmoji(messageId, user.getId(), emoji);
        if (reaction != null) {
            reactionRepository.delete(reaction);
            
            // Broadcast reaction removal
            if (message != null) {
                Map<String, Object> reactionRemoveMap = new java.util.HashMap<>();
                reactionRemoveMap.put("type", "reaction_removed");
                reactionRemoveMap.put("messageId", messageId);
                reactionRemoveMap.put("emoji", emoji);
                reactionRemoveMap.put("user", username);
                messagingTemplate.convertAndSend("/topic/channel/" + message.getChannel().getId(), reactionRemoveMap);
            }
        }
    }
    
    // ============ Message Edit/Delete Operations ============
    
    @Transactional
    public ChatDto.MessageResponse editMessage(Long messageId, String content, String username) {
        User user = userRepository.findByUsername(username)
                .orElseThrow(() -> new ResourceNotFoundException("User", "username", username));
        
        Message message = messageRepository.findById(messageId)
                .orElseThrow(() -> new ResourceNotFoundException("Message", "id", messageId));
        
        Channel channel = message.getChannel();
        
        // Check if user is a member of the channel - CONFIDENTIALITY FIX
        if (!channel.getMembers().contains(user) && !user.hasRole("ADMIN")) {
            throw new ForbiddenException("You are not a member of this channel");
        }
        
        // Verify ownership
        if (!message.getSender().getId().equals(user.getId())) {
            throw new ForbiddenException("You can only edit your own messages");
        }
        
        message.setContent(content);
        message.setIsEdited(true);
        
        message = messageRepository.save(message);
        
        // Broadcast edit
        ChatDto.MessageResponse response = mapToMessageResponse(message);
        Map<String, Object> editMap = new java.util.HashMap<>();
        editMap.put("type", "message_edited");
        editMap.put("message", response);
        messagingTemplate.convertAndSend("/topic/channel/" + message.getChannel().getId(), editMap);
        
        return response;
    }
    
    @Transactional
    public void deleteMessage(Long messageId, String username) {
        User user = userRepository.findByUsername(username)
                .orElseThrow(() -> new ResourceNotFoundException("User", "username", username));
        
        Message message = messageRepository.findById(messageId)
                .orElseThrow(() -> new ResourceNotFoundException("Message", "id", messageId));
        
        Channel channel = message.getChannel();
        
        // Check if user is a member of the channel - CONFIDENTIALITY FIX
        if (!channel.getMembers().contains(user) && !user.hasRole("ADMIN")) {
            throw new ForbiddenException("You are not a member of this channel");
        }
        
        // Verify ownership or admin
        if (!message.getSender().getId().equals(user.getId()) && !user.hasRole("ADMIN")) {
            throw new ForbiddenException("You can only delete your own messages");
        }
        
        Long channelId = message.getChannel().getId();
        
        // Delete all replies to this message first
        List<Message> replies = messageRepository.findByParentId(messageId);
        for (Message reply : replies) {
            // Delete reactions on reply
            reactionRepository.deleteAllByMessageId(reply.getId());
            reply.getAttachments().clear();
            messageRepository.delete(reply);
        }
        
        // Delete reactions and clear attachments on the main message
        reactionRepository.deleteAllByMessageId(messageId);
        message.getAttachments().clear();
        
        // Delete the message from database
        messageRepository.delete(message);

        log.info("Message {} permanently deleted from channel {} by {}", messageId, channelId, username);
        auditService.record(username, "MESSAGE_DELETED", "Message", messageId, "channel=" + channelId);
        
        // Broadcast deletion to all connected clients
        Map<String, Object> deleteMap = new java.util.HashMap<>();
        deleteMap.put("type", "message_deleted");
        deleteMap.put("messageId", messageId);
        messagingTemplate.convertAndSend("/topic/channel/" + channelId, deleteMap);
    }
    
    // ============ Pin Message ============
    
    @Transactional
    public ChatDto.MessageResponse pinMessage(Long messageId, String username) {
        User user = userRepository.findByUsername(username)
                .orElseThrow(() -> new ResourceNotFoundException("User", "username", username));
        
        Message message = messageRepository.findById(messageId)
                .orElseThrow(() -> new ResourceNotFoundException("Message", "id", messageId));
        
        Channel channel = message.getChannel();
        
        // Check if user is a member of the channel - CONFIDENTIALITY FIX
        if (!channel.getMembers().contains(user) && !user.hasRole("ADMIN")) {
            throw new ForbiddenException("You are not a member of this channel");
        }
        
        // Only admins or channel members can pin messages
        if (!user.hasRole("ADMIN") && !user.hasRole("MANAGER")) {
            throw new ForbiddenException("Only admins and managers can pin messages");
        }
        
        message.setIsPinned(true);
        message = messageRepository.save(message);
        
        return mapToMessageResponse(message);
    }
    
    // ============ Mapping Methods ============
    
    private ChatDto.ChannelResponse mapToChannelResponse(Channel channel) {
        List<ChatDto.ChannelMemberResponse> memberResponses = channel.getMembers().stream()
                .map(m -> ChatDto.ChannelMemberResponse.builder()
                        .id(m.getId())
                        .username(m.getUsername())
                        .displayName(m.getDisplayName())
                        .avatarUrl(m.getAvatarUrl())
                        .role("MEMBER")
                        .joinedAt(channel.getCreatedAt())
                        .build())
                .collect(Collectors.toList());
        
        return ChatDto.ChannelResponse.builder()
                .id(channel.getId())
                .name(channel.getName())
                .description(channel.getDescription())
                .type(channel.getType().name())
                .teamName(channel.getTeam() != null ? channel.getTeam().getName() : null)
                .teamId(channel.getTeam() != null ? channel.getTeam().getId() : null)
                .createdByUsername(channel.getCreatedBy() != null ? channel.getCreatedBy().getUsername() : null)
                .createdAt(channel.getCreatedAt())
                .updatedAt(channel.getUpdatedAt())
                .memberCount(channel.getMembers().size())
                .isActive(channel.getIsActive())
                .position(channel.getPosition())
                .category(channel.getCategory())
                .maxParticipants(channel.getMaxParticipants())
                .isLocked(channel.getIsLocked())
                .voiceRoomId(channel.getVoiceRoom() != null ? channel.getVoiceRoom().getId() : null)
                .voiceRoomStatus(channel.getVoiceRoom() != null ? (channel.getVoiceRoom().getIsActive() ? "ACTIVE" : "ENDED") : null)
                .members(memberResponses)
                .build();
    }
    
    private ChatDto.ChannelListResponse mapToChannelListResponse(Channel channel) {
        // Get last message
        Page<Message> lastMessagePage = messageRepository.findByChannelIdOrderByCreatedAtAsc(
                channel.getId(), PageRequest.of(0, 1));
        
        String lastMessageContent = null;
        LocalDateTime lastMessageTime = null;
        
        if (!lastMessagePage.isEmpty()) {
            Message lastMessage = lastMessagePage.getContent().get(0);
            lastMessageContent = lastMessage.getContent().length() > 50 
                    ? lastMessage.getContent().substring(0, 50) + "..." 
                    : lastMessage.getContent();
            lastMessageTime = lastMessage.getCreatedAt();
        }
        
        return ChatDto.ChannelListResponse.builder()
                .id(channel.getId())
                .name(channel.getName())
                .description(channel.getDescription())
                .type(channel.getType().name())
                .teamName(channel.getTeam() != null ? channel.getTeam().getName() : null)
                .teamId(channel.getTeam() != null ? channel.getTeam().getId() : null)
                .createdAt(channel.getCreatedAt())
                .memberCount(channel.getMembers().size())
                .lastMessageContent(lastMessageContent)
                .lastMessageTime(lastMessageTime)
                .isActive(channel.getIsActive())
                .position(channel.getPosition())
                .category(channel.getCategory())
                .maxParticipants(channel.getMaxParticipants())
                .isLocked(channel.getIsLocked())
                .build();
    }
    
    private ChatDto.MessageResponse mapToMessageResponse(Message message) {
        List<ChatDto.ReactionSummaryDto> reactions = getReactionSummaries(message.getId());
        
        int replyCount = messageRepository.findByParentId(message.getId()).size();
        
        // Get attachments
        List<Attachment> attachments = attachmentRepository.findByMessageId(message.getId());
        List<ChatDto.AttachmentDto> attachmentResponses = attachments.stream()
                .map(att -> {
                    // filePath stores the storage path (e.g. /opt/company-platform/uploads/attachments/1/uuid_name.png)
                    // If it is a raw filesystem path, extract just the URL portion.
                    String fileUrl = att.getFilePath();
                    if (fileUrl != null && !fileUrl.startsWith("/api/files/")) {
                        // Normalize path delimiters for universal matching
                        String normalizedPath = fileUrl.replace("\\", "/");
                        String normalizedUploads = uploadsPath.replace("\\", "/");
                        
                        // Extract everything after the uploads base directory
                        int idx = normalizedPath.lastIndexOf(normalizedUploads);
                        if (idx >= 0) {
                            String relativePath = normalizedPath.substring(idx + normalizedUploads.length());
                            if (relativePath.startsWith("/")) relativePath = relativePath.substring(1);
                            fileUrl = "/api/files/" + relativePath;
                        }
                    }
                    return ChatDto.AttachmentDto.builder()
                            .id(att.getId())
                            .fileName(att.getFileName())
                            .fileUrl(fileUrl)
                            .fileSize(att.getFileSize())
                            .fileType(att.getMimeType())
                            .build();
                })
                .collect(Collectors.toList());
        
        return ChatDto.MessageResponse.builder()
                .id(message.getId())
                .content(message.getContent())
                .messageType(message.getMessageType().name())
                .isEdited(message.getIsEdited())
                .isPinned(message.getIsPinned() != null && message.getIsPinned())
                .createdAt(message.getCreatedAt())
                .updatedAt(message.getUpdatedAt())
                .sender(mapToUserDto(message.getSender()))
                .channelId(message.getChannel().getId())
                .parentId(message.getParent() != null ? message.getParent().getId() : null)
                .reactions(reactions)
                .replyCount(replyCount)
                .attachments(attachmentResponses)
                .build();
    }
    
    private ChatDto.UserDto mapToUserDto(User user) {
        return ChatDto.UserDto.builder()
                .id(user.getId())
                .username(user.getUsername())
                .displayName(user.getDisplayName())
                .avatarUrl(user.getAvatarUrl())
                .status(user.getStatus().name())
                .presence(user.getPresence().name())
                .build();
    }
    
    private ChatDto.ReactionDto mapToReactionDto(Reaction reaction) {
        return ChatDto.ReactionDto.builder()
                .emoji(reaction.getEmoji())
                .username(reaction.getUser().getUsername())
                .createdAt(reaction.getCreatedAt())
                .build();
    }
    
    private List<ChatDto.ReactionSummaryDto> getReactionSummaries(Long messageId) {
        List<Reaction> reactions = reactionRepository.findByMessageId(messageId);
        
        return reactions.stream()
                .collect(Collectors.groupingBy(Reaction::getEmoji))
                .entrySet().stream()
                .map(entry -> ChatDto.ReactionSummaryDto.builder()
                        .emoji(entry.getKey())
                        .count(entry.getValue().size())
                        .users(entry.getValue().stream()
                                .map(r -> r.getUser().getUsername())
                                .collect(Collectors.toList()))
                        .build())
                .collect(Collectors.toList());
    }
    
    private CallDto.CallRoomResponse mapToCallRoomResponse(CallRoom room) {
        List<CallParticipant> participants = callParticipantRepository
                .findByCallRoomIdAndLeftAtIsNull(room.getId());
        
        return CallDto.CallRoomResponse.builder()
                .id(room.getId())
                .name(room.getName())
                .type(room.getType().name())
                .status(room.getIsActive() ? "ACTIVE" : "ENDED")
                .createdByUsername(room.getCreatedBy() != null ? room.getCreatedBy().getUsername() : null)
                .createdAt(room.getCreatedAt())
                .startedAt(room.getStartedAt())
                .endedAt(room.getEndedAt())
                .participants(participants.stream()
                        .map(this::mapToParticipantResponse)
                        .collect(Collectors.toList()))
                .participantCount(participants.size())
                .build();
    }
    
    private CallDto.ParticipantResponse mapToParticipantResponse(CallParticipant participant) {
        return CallDto.ParticipantResponse.builder()
                .id(participant.getId())
                .userId(participant.getUser().getId())
                .username(participant.getUser().getUsername())
                .displayName(participant.getUser().getDisplayName())
                .avatarUrl(participant.getUser().getAvatarUrl())
                .isMuted(participant.getIsMuted())
                .isVideoEnabled(participant.getIsVideoEnabled())
                .isScreenSharing(participant.getIsScreenSharing())
                .joinedAt(participant.getJoinedAt())
                .leftAt(participant.getLeftAt())
                .build();
    }
}
