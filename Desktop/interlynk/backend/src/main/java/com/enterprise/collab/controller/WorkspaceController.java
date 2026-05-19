package com.enterprise.collab.controller;

import com.enterprise.collab.entity.Workspace;
import com.enterprise.collab.entity.WorkspaceFile;
import com.enterprise.collab.security.JwtTokenProvider;
import com.enterprise.collab.service.WorkspaceService;
import javax.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/workspaces")
@RequiredArgsConstructor
public class WorkspaceController {
    
    private final WorkspaceService workspaceService;
    private final JwtTokenProvider jwtTokenProvider;
    
    @PostMapping
    public ResponseEntity<Workspace> createWorkspace(
            @RequestParam Long repositoryId,
            @RequestParam(required = false) String branch,
            HttpServletRequest request) {
        Long userId = getUserIdFromRequest(request);
        Workspace workspace = workspaceService.createWorkspace(userId, repositoryId, branch);
        return ResponseEntity.ok(workspace);
    }
    
    @GetMapping
    public ResponseEntity<List<Workspace>> getUserWorkspaces(HttpServletRequest request) {
        Long userId = getUserIdFromRequest(request);
        return ResponseEntity.ok(workspaceService.getUserWorkspaces(userId));
    }
    
    @GetMapping("/{workspaceId}")
    public ResponseEntity<Workspace> getWorkspace(
            @PathVariable Long workspaceId,
            HttpServletRequest request) {
        Long userId = getUserIdFromRequest(request);
        return ResponseEntity.ok(workspaceService.getWorkspaceForUser(workspaceId, userId));
    }
    
    @PostMapping("/{workspaceId}/files")
    public ResponseEntity<WorkspaceFile> saveFile(
            @PathVariable Long workspaceId,
            @RequestBody Map<String, String> fileData,
            HttpServletRequest request) {
        Long userId = getUserIdFromRequest(request);
        String filePath = fileData.get("filePath");
        String content = fileData.get("content");
        return ResponseEntity.ok(workspaceService.saveFile(workspaceId, filePath, content, userId));
    }
    
    @GetMapping("/{workspaceId}/files")
    public ResponseEntity<List<WorkspaceFile>> getWorkspaceFiles(
            @PathVariable Long workspaceId,
            HttpServletRequest request) {
        Long userId = getUserIdFromRequest(request);
        return ResponseEntity.ok(workspaceService.getWorkspaceFiles(workspaceId, userId));
    }
    
    @GetMapping("/{workspaceId}/files/{filePath:.*}")
    public ResponseEntity<WorkspaceFile> getWorkspaceFile(
            @PathVariable Long workspaceId,
            @PathVariable String filePath,
            HttpServletRequest request) {
        Long userId = getUserIdFromRequest(request);
        return workspaceService.getWorkspaceFile(workspaceId, filePath, userId)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }
    
    @DeleteMapping("/{workspaceId}")
    public ResponseEntity<Void> deleteWorkspace(
            @PathVariable Long workspaceId,
            HttpServletRequest request) {
        Long userId = getUserIdFromRequest(request);
        workspaceService.deleteWorkspace(workspaceId, userId);
        return ResponseEntity.ok().build();
    }
    
    private Long getUserIdFromRequest(HttpServletRequest request) {
        String token = jwtTokenProvider.getTokenFromRequest(request);
        return jwtTokenProvider.getUserIdFromToken(token);
    }
}
