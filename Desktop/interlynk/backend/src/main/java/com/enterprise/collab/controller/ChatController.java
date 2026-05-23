package com.enterprise.collab.controller;

import com.enterprise.collab.dto.ChatDto;
import com.enterprise.collab.entity.Channel;
import com.enterprise.collab.service.ChatService;
import com.enterprise.collab.service.FileStorageService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api")
@RequiredArgsConstructor
public class ChatController {
    
    private final ChatService chatService;
    private final FileStorageService fileStorageService;
    
    // ============ Channel CRUD Endpoints ============
    
    @PostMapping("/channels")
    public ResponseEntity<ChatDto.ChannelResponse> createChannel(
            @RequestBody ChatDto.CreateChannelRequest request,
            Authentication authentication) {

        Channel.ChannelType channelType;
        try {
            channelType = Channel.ChannelType.valueOf(request.getType().toUpperCase());
        } catch (IllegalArgumentException e) {
            // Default to TEXT if invalid type
            channelType = Channel.ChannelType.TEXT;
        }
        // Voice CHANNELS were removed from the product; never let a client
        // create one. Quietly normalise any caller that still asks for VOICE.
        if (channelType == Channel.ChannelType.VOICE) {
            channelType = Channel.ChannelType.TEXT;
        }

        return ResponseEntity.ok(chatService.createChannel(
                request.getName(),
                request.getDescription(),
                channelType,
                request.getTeamId(),
                authentication.getName()));
    }
    
    @PutMapping("/channels/{channelId}")
    public ResponseEntity<ChatDto.ChannelResponse> updateChannel(
            @PathVariable Long channelId,
            @RequestBody ChatDto.UpdateChannelRequest request,
            Authentication authentication) {
        
        return ResponseEntity.ok(chatService.updateChannel(channelId, request, authentication.getName()));
    }
    
    @DeleteMapping("/channels/{channelId}")
    public ResponseEntity<Void> deleteChannel(
            @PathVariable Long channelId,
            Authentication authentication) {
        
        chatService.deleteChannel(channelId, authentication.getName());
        return ResponseEntity.ok().build();
    }
    
    @GetMapping("/channels")
    public ResponseEntity<List<ChatDto.ChannelListResponse>> getUserChannels(Authentication authentication) {
        return ResponseEntity.ok(chatService.getUserChannels(authentication.getName()));
    }
    
    @GetMapping("/channels/{channelId}")
    public ResponseEntity<ChatDto.ChannelResponse> getChannel(
            @PathVariable Long channelId,
            Authentication authentication) {
        return ResponseEntity.ok(chatService.getChannel(channelId, authentication.getName()));
    }
    
    // ============ Team-Channel Management Endpoints ============
    
    @PostMapping("/channels/{channelId}/team")
    public ResponseEntity<ChatDto.ChannelResponse> addTeamToChannel(
            @PathVariable Long channelId,
            @RequestBody ChatDto.AddTeamToChannelRequest request,
            Authentication authentication) {
        
        return ResponseEntity.ok(chatService.addTeamToChannel(channelId, request.getTeamId(), authentication.getName()));
    }
    
    @DeleteMapping("/channels/{channelId}/team")
    public ResponseEntity<ChatDto.ChannelResponse> removeTeamFromChannel(
            @PathVariable Long channelId,
            Authentication authentication) {
        
        return ResponseEntity.ok(chatService.removeTeamFromChannel(channelId, authentication.getName()));
    }
    
    @GetMapping("/teams/{teamId}/channels")
    public ResponseEntity<List<ChatDto.ChannelByTeamResponse>> getChannelsByTeam(@PathVariable Long teamId) {
        return ResponseEntity.ok(chatService.getChannelsByTeam(teamId));
    }
    
    @GetMapping("/teams/{teamId}/channels/text")
    public ResponseEntity<List<ChatDto.ChannelListResponse>> getTextChannelsByTeam(@PathVariable Long teamId) {
        return ResponseEntity.ok(chatService.getTextChannelsByTeam(teamId));
    }
    
    @GetMapping("/channels/categories")
    public ResponseEntity<List<String>> getAllCategories() {
        return ResponseEntity.ok(chatService.getAllCategories());
    }
    
    // ============ Channel Member Endpoints ============
    
    @PostMapping("/channels/{channelId}/members")
    public ResponseEntity<ChatDto.ChannelResponse> addMember(
            @PathVariable Long channelId,
            @RequestParam String username,
            Authentication authentication) {
        return ResponseEntity.ok(chatService.addMemberToChannel(channelId, username, authentication.getName()));
    }
    
    @DeleteMapping("/channels/{channelId}/members/{username}")
    public ResponseEntity<ChatDto.ChannelResponse> removeMember(
            @PathVariable Long channelId,
            @PathVariable String username,
            Authentication authentication) {
        return ResponseEntity.ok(chatService.removeMemberFromChannel(channelId, username, authentication.getName()));
    }
    
    // ============ Voice Channel Endpoints — REMOVED ============
    // The ambient voice-channel feature was removed from the product. Clients
    // that still hit /api/channels/{id}/voice/* will receive 404 by default,
    // which is the right answer: the resource genuinely no longer exists.

    // ============ Message endpoints ============
    
    @PostMapping("/channels/{channelId}/messages")
    public ResponseEntity<ChatDto.MessageResponse> sendMessage(
            @PathVariable Long channelId,
            @RequestBody Map<String, Object> payload,
            Authentication authentication) {
        
        String content = (String) payload.get("content");
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> attachmentsData = (List<Map<String, Object>>) payload.get("attachments");
        
        List<ChatDto.AttachmentDto> attachments = null;
        if (attachmentsData != null && !attachmentsData.isEmpty()) {
            attachments = attachmentsData.stream()
                .map(att -> ChatDto.AttachmentDto.builder()
                    .fileName((String) att.get("filename"))
                    .fileUrl((String) att.get("url"))
                    .fileSize(att.get("size") != null ? ((Number) att.get("size")).longValue() : 0L)
                    .fileType((String) att.get("fileType"))  // frontend sends 'fileType' not 'mimeType'
                    .build())
                .collect(Collectors.toList());
        }
        
        return ResponseEntity.ok(chatService.sendMessage(channelId, content, 
                authentication.getName(), attachments));
    }
    
    @GetMapping("/channels/{channelId}/messages")
    public ResponseEntity<ChatDto.MessageListResponse> getMessages(
            @PathVariable Long channelId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "50") int size,
            Authentication authentication) {
        return ResponseEntity.ok(chatService.getChannelMessages(channelId, authentication.getName(), page, size));
    }
    
    // Reply to message
    @PostMapping("/messages/{messageId}/reply")
    public ResponseEntity<ChatDto.MessageResponse> replyToMessage(
            @PathVariable Long messageId,
            @RequestBody Map<String, String> payload,
            Authentication authentication) {
        
        return ResponseEntity.ok(chatService.replyToMessage(messageId, payload.get("content"), 
                authentication.getName()));
    }
    
    // Edit message
    @PutMapping("/messages/{messageId}")
    public ResponseEntity<ChatDto.MessageResponse> editMessage(
            @PathVariable Long messageId,
            @RequestBody Map<String, String> payload,
            Authentication authentication) {
        
        return ResponseEntity.ok(chatService.editMessage(messageId, payload.get("content"), 
                authentication.getName()));
    }
    
    // Delete message
    @DeleteMapping("/messages/{messageId}")
    public ResponseEntity<Void> deleteMessage(
            @PathVariable Long messageId,
            Authentication authentication) {
        
        chatService.deleteMessage(messageId, authentication.getName());
        return ResponseEntity.ok().build();
    }
    
    // Get thread
    @GetMapping("/messages/{messageId}/thread")
    public ResponseEntity<ChatDto.ThreadResponse> getThread(
            @PathVariable Long messageId,
            Authentication authentication) {
        return ResponseEntity.ok(chatService.getThread(messageId, authentication.getName()));
    }
    
    // Pin message
    @PostMapping("/messages/{messageId}/pin")
    public ResponseEntity<ChatDto.MessageResponse> pinMessage(
            @PathVariable Long messageId,
            Authentication authentication) {
        
        return ResponseEntity.ok(chatService.pinMessage(messageId, authentication.getName()));
    }
    
    // ============ Reaction endpoints ============
    
    @PostMapping("/messages/{messageId}/reactions")
    public ResponseEntity<ChatDto.ReactionDto> addReaction(
            @PathVariable Long messageId,
            @RequestBody Map<String, String> payload,
            Authentication authentication) {
        
        return ResponseEntity.ok(chatService.addReaction(messageId, payload.get("emoji"), 
                authentication.getName()));
    }
    
    @DeleteMapping("/messages/{messageId}/reactions")
    public ResponseEntity<Void> removeReaction(
            @PathVariable Long messageId,
            @RequestParam String emoji,
            Authentication authentication) {
        
        chatService.removeReaction(messageId, emoji, authentication.getName());
        return ResponseEntity.ok().build();
    }
    
    // ============ File Upload Endpoints ============
    
    @PostMapping("/channels/{channelId}/attachments")
    public ResponseEntity<ChatDto.AttachmentResponse> uploadAttachment(
            @PathVariable Long channelId,
            @RequestParam("file") MultipartFile file,
            Authentication authentication) throws IOException {
        
        // Validate file
        if (file.isEmpty()) {
            return ResponseEntity.badRequest().build();
        }
        
        // Store the file
        String uploadDir = "attachments/" + channelId;
        String filePath = fileStorageService.storeFile(file, uploadDir);
        
        // Extract just the filename from the full path
        java.io.File fullPath = new java.io.File(filePath);
        String storedFilename = fullPath.getName();
        
        // Create response with correct URL including UUID
        ChatDto.AttachmentResponse response = ChatDto.AttachmentResponse.builder()
                .id(System.currentTimeMillis())
                .fileName(file.getOriginalFilename())
                .fileUrl("/api/files/attachments/" + channelId + "/" + storedFilename)
                .fileSize(file.getSize())
                .fileType(file.getContentType())
                .build();
        
        return ResponseEntity.ok(response);
    }
    
    @GetMapping("/files/attachments/{channelId}/{filename}")
    public ResponseEntity<byte[]> getFile(
            @PathVariable Long channelId,
            @PathVariable String filename) throws IOException {
        
        String filePath = "attachments/" + channelId + "/" + filename;
        byte[] fileData = fileStorageService.readFile(filePath);
        
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "inline; filename=\"" + filename + "\"")
                .contentType(MediaType.APPLICATION_OCTET_STREAM)
                .body(fileData);
    }
}
