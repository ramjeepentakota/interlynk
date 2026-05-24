package com.enterprise.collab.service;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import javax.annotation.PostConstruct;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardCopyOption;
import java.util.UUID;

@Service
@Slf4j
public class FileStorageService {
    
    @Value("${app.storage.uploads-path}")
    private String uploadsPath;
    
    @Value("${app.storage.recordings-path}")
    private String recordingsPath;
    
    @Value("${app.storage.repos-path}")
    private String reposPath;
    
    @PostConstruct
    public void init() {
        try {
            Files.createDirectories(Paths.get(uploadsPath));
            Files.createDirectories(Paths.get(recordingsPath));
            Files.createDirectories(Paths.get(reposPath));
        } catch (IOException e) {
            log.error("Failed to initialize storage directories", e);
        }
    }
    
    public String storeFile(MultipartFile file, String directory) throws IOException {
        String filename = UUID.randomUUID() + "_" + file.getOriginalFilename();
        Path targetPath = Paths.get(uploadsPath, directory, filename);
        
        Files.createDirectories(targetPath.getParent());
        Files.copy(file.getInputStream(), targetPath, StandardCopyOption.REPLACE_EXISTING);
        
        return targetPath.toString();
    }
    
    public String storeRecording(MultipartFile file, String userId) throws IOException {
        String filename = userId + "_" + System.currentTimeMillis() + "_" + file.getOriginalFilename();
        Path targetPath = Paths.get(recordingsPath, filename);
        
        Files.copy(file.getInputStream(), targetPath, StandardCopyOption.REPLACE_EXISTING);
        
        return targetPath.toString();
    }
    
    public byte[] readFile(String filePath) throws IOException {
        return Files.readAllBytes(resolveWithinUploads(filePath));
    }

    public void deleteFile(String filePath) throws IOException {
        Files.deleteIfExists(resolveWithinUploads(filePath));
    }

    public boolean fileExists(String filePath) {
        try {
            return Files.exists(resolveWithinUploads(filePath));
        } catch (IOException e) {
            return false;
        }
    }

    /**
     * Resolve a caller-supplied relative path against the uploads root and
     * guarantee the normalized result stays inside it. Defeats path-traversal
     * (e.g. "../../etc/passwd" or absolute paths) before any filesystem access.
     */
    private Path resolveWithinUploads(String filePath) throws IOException {
        if (filePath == null || filePath.isEmpty()) {
            throw new IOException("Invalid file path");
        }
        Path base = Paths.get(uploadsPath).toAbsolutePath().normalize();
        Path resolved = base.resolve(filePath).normalize();
        if (!resolved.startsWith(base)) {
            throw new IOException("Path escapes storage root: " + filePath);
        }
        return resolved;
    }
    
    public String getUploadsPath() {
        return uploadsPath;
    }
    
    public String getRecordingsPath() {
        return recordingsPath;
    }
    
    public String getReposPath() {
        return reposPath;
    }
}
