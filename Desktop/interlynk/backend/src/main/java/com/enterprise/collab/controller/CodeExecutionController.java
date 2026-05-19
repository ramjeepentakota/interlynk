package com.enterprise.collab.controller;

import com.enterprise.collab.dto.CodeReviewDto;
import com.enterprise.collab.security.JwtTokenProvider;
import com.enterprise.collab.service.CodeExecutionService;
import javax.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/execute")
@RequiredArgsConstructor
public class CodeExecutionController {
    
    private final CodeExecutionService codeExecutionService;
    private final JwtTokenProvider jwtTokenProvider;
    
    @PostMapping
    public ResponseEntity<CodeReviewDto.ExecuteCodeResponse> executeCode(
            @RequestBody Map<String, String> request,
            HttpServletRequest httpRequest) {
        Long userId = getUserIdFromRequest(httpRequest);
        
        Long workspaceId = Long.parseLong(request.get("workspaceId"));
        String language = request.get("language");
        String code = request.get("code");
        
        return ResponseEntity.ok(codeExecutionService.executeCode(workspaceId, language, code, userId));
    }
    
    @GetMapping("/{executionId}")
    public ResponseEntity<CodeReviewDto.ExecuteCodeResponse> getExecution(@PathVariable Long executionId) {
        return ResponseEntity.ok(codeExecutionService.getExecution(executionId));
    }
    
    private Long getUserIdFromRequest(HttpServletRequest request) {
        String token = jwtTokenProvider.getTokenFromRequest(request);
        return jwtTokenProvider.getUserIdFromToken(token);
    }
}
