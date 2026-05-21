package com.enterprise.collab.controller;

import com.enterprise.collab.entity.User;
import com.enterprise.collab.entity.Webhook;
import com.enterprise.collab.exception.ResourceNotFoundException;
import com.enterprise.collab.repository.UserRepository;
import com.enterprise.collab.repository.WebhookRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * Admin-only management surface for outbound webhooks. The dispatcher and HMAC
 * signing live in WebhookService; this controller just exposes CRUD.
 */
@RestController
@RequestMapping("/api/admin/webhooks")
@RequiredArgsConstructor
@PreAuthorize("hasRole('ADMIN')")
public class WebhookController {

    private final WebhookRepository repository;
    private final UserRepository userRepository;

    @GetMapping
    public ResponseEntity<List<Webhook>> list() {
        return ResponseEntity.ok(repository.findAll());
    }

    @PostMapping
    public ResponseEntity<Webhook> create(@RequestBody Webhook body, @AuthenticationPrincipal UserDetails principal) {
        User creator = userRepository.findByUsername(principal.getUsername())
                .orElseThrow(() -> new ResourceNotFoundException("User", "username", principal.getUsername()));
        body.setId(null);
        body.setCreatedBy(creator);
        if (body.getActive() == null) body.setActive(true);
        return ResponseEntity.ok(repository.save(body));
    }

    @PutMapping("/{id}")
    public ResponseEntity<Webhook> update(@PathVariable Long id, @RequestBody Webhook body) {
        Webhook existing = repository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Webhook", "id", id));
        if (body.getName() != null) existing.setName(body.getName());
        if (body.getUrl() != null) existing.setUrl(body.getUrl());
        if (body.getEvents() != null) existing.setEvents(body.getEvents());
        if (body.getSecret() != null) existing.setSecret(body.getSecret());
        if (body.getActive() != null) existing.setActive(body.getActive());
        return ResponseEntity.ok(repository.save(existing));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        repository.deleteById(id);
        return ResponseEntity.noContent().build();
    }
}
