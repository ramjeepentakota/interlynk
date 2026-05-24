package com.enterprise.collab.controller;

import com.enterprise.collab.dto.CodeReviewDto;
import com.enterprise.collab.security.JwtTokenProvider;
import com.enterprise.collab.service.CodeExecutionService;
import javax.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/execute")
@RequiredArgsConstructor
public class CodeExecutionController {

    private final CodeExecutionService codeExecutionService;
    private final JwtTokenProvider jwtTokenProvider;

    // SECURITY: the executor runs user code directly on the host with no sandbox.
    // It is DISABLED by default and must never be enabled in production until the
    // runner is isolated (container/jail with no network, cpu/mem rlimits, and a
    // hard process kill on timeout). Toggle with app.execution.enabled=true.
    @Value("${app.execution.enabled:false}")
    private boolean executionEnabled;

    @PostMapping
    public ResponseEntity<CodeReviewDto.ExecuteCodeResponse> executeCode(
            @RequestBody Map<String, String> request,
            HttpServletRequest httpRequest) {
        if (!executionEnabled) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN,
                    "Code execution is disabled on this server.");
        }
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
