package com.enterprise.collab.controller;

import com.enterprise.collab.service.SearchService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.Map;

@RestController
@RequestMapping("/api/search")
@RequiredArgsConstructor
public class SearchController {

    private final SearchService searchService;

    @GetMapping
    public ResponseEntity<Map<String, Object>> search(
            @RequestParam("q") String query,
            @RequestParam(value = "limit", defaultValue = "50") int limit,
            @RequestParam(value = "scope", defaultValue = "all") String scope,
            @AuthenticationPrincipal UserDetails principal) {
        Map<String, Object> out = new HashMap<>();
        if ("messages".equalsIgnoreCase(scope) || "all".equalsIgnoreCase(scope)) {
            out.put("messages", searchService.searchMessages(principal.getUsername(), query, limit));
        }
        if ("users".equalsIgnoreCase(scope) || "all".equalsIgnoreCase(scope)) {
            out.put("users", searchService.searchUsers(query, limit));
        }
        out.put("query", query);
        return ResponseEntity.ok(out);
    }
}
