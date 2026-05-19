package com.enterprise.collab.service;

import com.enterprise.collab.dto.CodeReviewDto;
import com.enterprise.collab.entity.CodeExecution;
import com.enterprise.collab.entity.User;
import com.enterprise.collab.entity.Workspace;
import com.enterprise.collab.exception.BadRequestException;
import com.enterprise.collab.exception.ResourceNotFoundException;
import com.enterprise.collab.repository.CodeExecutionRepository;
import com.enterprise.collab.repository.UserRepository;
import com.enterprise.collab.repository.WorkspaceRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.time.LocalDateTime;
import java.util.Arrays;
import java.util.List;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.*;

@Service
@RequiredArgsConstructor
@Slf4j
public class CodeExecutionService {
    
    private final CodeExecutionRepository codeExecutionRepository;
    private final WorkspaceRepository workspaceRepository;
    private final UserRepository userRepository;
    
    @Value("${app.execution.timeout:30000}")
    private long executionTimeout;
    
    @Value("${app.execution.memory-limit:524288000}")
    private long memoryLimit;
    
    private final ExecutorService executorService = Executors.newCachedThreadPool();
    
    // ============ Code Execution Operations ============
    
    @Transactional
    public CodeReviewDto.ExecuteCodeResponse executeCode(Long workspaceId, String language, String code, Long userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User", "id", userId));
        
        Workspace workspace = workspaceRepository.findById(workspaceId)
                .orElseThrow(() -> new ResourceNotFoundException("Workspace", "id", workspaceId));
        
        // Validate language
        if (!isLanguageSupported(language)) {
            throw new BadRequestException("Language not supported: " + language);
        }
        
        // Create execution record
        CodeExecution execution = CodeExecution.builder()
                .workspace(workspace)
                .user(user)
                .language(language)
                .code(code)
                .status(CodeExecution.ExecutionStatus.PENDING)
                .build();
        
        execution = codeExecutionRepository.save(execution);
        
        log.info("Starting code execution {} for user {} in workspace {}", execution.getId(), userId, workspaceId);
        
        // Execute code asynchronously
        try {
            Future<CodeExecutionResult> future = executorService.submit(() -> runCode(language, code));
            
            CodeExecutionResult result;
            try {
                result = future.get(executionTimeout, TimeUnit.MILLISECONDS);
            } catch (TimeoutException e) {
                future.cancel(true);
                result = new CodeExecutionResult("", "Execution timed out", -1, -1);
                execution.setStatus(CodeExecution.ExecutionStatus.TIMEOUT);
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                result = new CodeExecutionResult("", "Execution interrupted", -1, -1);
                execution.setStatus(CodeExecution.ExecutionStatus.ERROR);
            }
            
            execution.setOutput(result.getOutput());
            execution.setError(result.getError());
            execution.setExecutionTimeMs((int) result.getExecutionTime());
            execution.setMemoryUsageBytes(result.getMemoryUsage());
            execution.setStatus(CodeExecution.ExecutionStatus.COMPLETED);
            
        } catch (ExecutionException e) {
            execution.setError(e.getMessage());
            execution.setStatus(CodeExecution.ExecutionStatus.ERROR);
            log.error("Code execution failed", e);
        }
        
        execution.setExecutedAt(LocalDateTime.now());
        execution = codeExecutionRepository.save(execution);
        
        return mapToExecutionResponse(execution);
    }
    
    public CodeReviewDto.ExecuteCodeResponse getExecution(Long executionId) {
        CodeExecution execution = codeExecutionRepository.findById(executionId)
                .orElseThrow(() -> new ResourceNotFoundException("Execution", "id", executionId));
        
        return mapToExecutionResponse(execution);
    }
    
    public List<CodeReviewDto.ExecuteCodeResponse> getUserExecutions(Long userId) {
        List<CodeExecution> executions = codeExecutionRepository.findByUserIdOrderByExecutedAtDesc(userId);
        
        return executions.stream()
                .map(this::mapToExecutionResponse)
                .collect(java.util.stream.Collectors.toList());
    }
    
    // ============ Private Methods ============
    
    private boolean isLanguageSupported(String language) {
        List<String> supportedLanguages = Arrays.asList(
                "python", "java", "javascript", "node", "go", "rust", "cpp", "c"
        );
        return supportedLanguages.contains(language.toLowerCase());
    }
    
    private CodeExecutionResult runCode(String language, String code) {
        long startTime = System.currentTimeMillis();
        
        try {
            List<String> command = buildCommand(language, code);
            ProcessBuilder processBuilder = new ProcessBuilder(command);
            processBuilder.redirectErrorStream(true);
            
            Process process = processBuilder.start();
            
            StringBuilder output = new StringBuilder();
            StringBuilder error = new StringBuilder();
            
            // Read output
            BufferedReader reader = new BufferedReader(new InputStreamReader(process.getInputStream()));
            String line;
            while ((line = reader.readLine()) != null) {
                output.append(line).append("\n");
            }
            
            // Wait for process to complete
            int exitCode = process.waitFor();
            
            // Read error if any
            if (exitCode != 0) {
                BufferedReader errorReader = new BufferedReader(new InputStreamReader(process.getErrorStream()));
                while ((line = errorReader.readLine()) != null) {
                    error.append(line).append("\n");
                }
            }
            
            long executionTime = System.currentTimeMillis() - startTime;
            
            return new CodeExecutionResult(
                    output.toString().trim(),
                    error.toString().trim(),
                    executionTime,
                    Runtime.getRuntime().totalMemory() - Runtime.getRuntime().freeMemory()
            );
            
        } catch (Exception e) {
            log.error("Error executing code", e);
            return new CodeExecutionResult(
                    "",
                    "Error: " + e.getMessage(),
                    System.currentTimeMillis() - startTime,
                    0
            );
        }
    }
    
    private List<String> buildCommand(String language, String code) {
        List<String> command = new ArrayList<>();
        
        switch (language.toLowerCase()) {
            case "python":
                command.add("python3");
                command.add("-c");
                command.add(code);
                break;
            case "javascript":
            case "node":
                command.add("node");
                command.add("-e");
                command.add(code);
                break;
            case "java":
                // For Java, we'd need to compile and run
                command.add("java");
                command.add("--version");
                break;
            case "go":
                command.add("go");
                command.add("run");
                command.add("-");
                break;
            case "rust":
                command.add("rustc");
                command.add("--version");
                break;
            case "cpp":
            case "c":
                command.add("g++");
                command.add("--version");
                break;
            default:
                command.add("echo");
                command.add("Language not supported");
        }
        
        return command;
    }
    
    private CodeReviewDto.ExecuteCodeResponse mapToExecutionResponse(CodeExecution execution) {
        return CodeReviewDto.ExecuteCodeResponse.builder()
                .id(execution.getId())
                .status(execution.getStatus().name())
                .output(execution.getOutput())
                .error(execution.getError())
                .language(execution.getLanguage())
                .executionTimeMs(execution.getExecutionTimeMs() != null ? execution.getExecutionTimeMs().longValue() : null)
                .memoryUsageBytes(execution.getMemoryUsageBytes())
                .createdAt(execution.getExecutedAt())
                .build();
    }
    
    // Inner class for execution result
    private static class CodeExecutionResult {
        private final String output;
        private final String error;
        private final long executionTime;
        private final long memoryUsage;
        
        public CodeExecutionResult(String output, String error, long executionTime, long memoryUsage) {
            this.output = output;
            this.error = error;
            this.executionTime = executionTime;
            this.memoryUsage = memoryUsage;
        }
        
        public String getOutput() { return output; }
        public String getError() { return error; }
        public long getExecutionTime() { return executionTime; }
        public long getMemoryUsage() { return memoryUsage; }
    }
}
