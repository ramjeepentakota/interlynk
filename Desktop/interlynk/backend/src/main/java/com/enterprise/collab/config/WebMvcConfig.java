package com.enterprise.collab.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.ResourceHandlerRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

import java.nio.file.Paths;

@Configuration
public class WebMvcConfig implements WebMvcConfigurer {

    @Value("${app.storage.uploads-path:${app.storage.base-path:/opt/company-platform}/uploads}")
    private String uploadsPath;

    @Value("${app.storage.recordings-path:${app.storage.base-path:/opt/company-platform}/recordings}")
    private String recordingsPath;
    
    @Override
    public void addResourceHandlers(ResourceHandlerRegistry registry) {
        // Convert to absolute URI format
        String uploadResourcePath = Paths.get(uploadsPath).toAbsolutePath().toUri().toString();
        String recordingResourcePath = Paths.get(recordingsPath).toAbsolutePath().toUri().toString();

        // Serve files from the uploads directory at /api/files/**
        registry.addResourceHandler("/api/files/**")
                .addResourceLocations(uploadResourcePath);
        
        // Also serve recordings
        registry.addResourceHandler("/api/recordings/**")
                .addResourceLocations(recordingResourcePath);
    }
}
