package com.enterprise.collab.controller;

import com.enterprise.collab.dto.AdminSecurityDto.*;
import com.enterprise.collab.service.AdminCompliancePolicyService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;

import javax.validation.Valid;
import java.util.List;

/** Conditional access · DLP · Sensitivity labels · Information barriers · Retention. */
@RestController
@RequestMapping("/api/admin/compliance")
@RequiredArgsConstructor
@PreAuthorize("hasRole('ADMIN')")
@Validated
public class AdminCompliancePolicyController {

    private final AdminCompliancePolicyService service;

    /* Conditional access */
    @GetMapping("/conditional-access") public ResponseEntity<List<ConditionalAccessResponse>> ca() { return ResponseEntity.ok(service.listCa()); }
    @PostMapping("/conditional-access") public ResponseEntity<ConditionalAccessResponse> createCa(@Valid @RequestBody CreateConditionalAccessRequest r) { return ResponseEntity.ok(service.createCa(r)); }
    @PutMapping("/conditional-access/{id}") public ResponseEntity<ConditionalAccessResponse> updateCa(@PathVariable Long id, @RequestBody CreateConditionalAccessRequest r) { return ResponseEntity.ok(service.updateCa(id, r)); }
    @DeleteMapping("/conditional-access/{id}") public ResponseEntity<SimpleResponse> deleteCa(@PathVariable Long id) { service.deleteCa(id); return ResponseEntity.ok(new SimpleResponse(true, "Deleted")); }

    /* DLP */
    @GetMapping("/dlp") public ResponseEntity<List<DlpPolicyResponse>> dlp() { return ResponseEntity.ok(service.listDlp()); }
    @PostMapping("/dlp") public ResponseEntity<DlpPolicyResponse> createDlp(@Valid @RequestBody CreateDlpRequest r) { return ResponseEntity.ok(service.createDlp(r)); }
    @PutMapping("/dlp/{id}") public ResponseEntity<DlpPolicyResponse> updateDlp(@PathVariable Long id, @RequestBody CreateDlpRequest r) { return ResponseEntity.ok(service.updateDlp(id, r)); }
    @DeleteMapping("/dlp/{id}") public ResponseEntity<SimpleResponse> deleteDlp(@PathVariable Long id) { service.deleteDlp(id); return ResponseEntity.ok(new SimpleResponse(true, "Deleted")); }

    /* Labels */
    @GetMapping("/labels") public ResponseEntity<List<SensitivityLabelResponse>> labels() { return ResponseEntity.ok(service.listLabels()); }
    @PostMapping("/labels") public ResponseEntity<SensitivityLabelResponse> createLabel(@Valid @RequestBody CreateLabelRequest r) { return ResponseEntity.ok(service.createLabel(r)); }
    @PutMapping("/labels/{id}") public ResponseEntity<SensitivityLabelResponse> updateLabel(@PathVariable Long id, @RequestBody CreateLabelRequest r) { return ResponseEntity.ok(service.updateLabel(id, r)); }
    @DeleteMapping("/labels/{id}") public ResponseEntity<SimpleResponse> deleteLabel(@PathVariable Long id) { service.deleteLabel(id); return ResponseEntity.ok(new SimpleResponse(true, "Deleted")); }

    /* Information barriers */
    @GetMapping("/barriers") public ResponseEntity<List<InformationBarrierResponse>> barriers() { return ResponseEntity.ok(service.listBarriers()); }
    @PostMapping("/barriers") public ResponseEntity<InformationBarrierResponse> createBarrier(@Valid @RequestBody CreateBarrierRequest r) { return ResponseEntity.ok(service.createBarrier(r)); }
    @PutMapping("/barriers/{id}") public ResponseEntity<InformationBarrierResponse> updateBarrier(@PathVariable Long id, @RequestBody CreateBarrierRequest r) { return ResponseEntity.ok(service.updateBarrier(id, r)); }
    @DeleteMapping("/barriers/{id}") public ResponseEntity<SimpleResponse> deleteBarrier(@PathVariable Long id) { service.deleteBarrier(id); return ResponseEntity.ok(new SimpleResponse(true, "Deleted")); }

    /* Retention */
    @GetMapping("/retention") public ResponseEntity<List<RetentionPolicyResponse>> retention() { return ResponseEntity.ok(service.listRetention()); }
    @PostMapping("/retention") public ResponseEntity<RetentionPolicyResponse> createRetention(@Valid @RequestBody CreateRetentionRequest r) { return ResponseEntity.ok(service.createRetention(r)); }
    @PutMapping("/retention/{id}") public ResponseEntity<RetentionPolicyResponse> updateRetention(@PathVariable Long id, @RequestBody CreateRetentionRequest r) { return ResponseEntity.ok(service.updateRetention(id, r)); }
    @DeleteMapping("/retention/{id}") public ResponseEntity<SimpleResponse> deleteRetention(@PathVariable Long id) { service.deleteRetention(id); return ResponseEntity.ok(new SimpleResponse(true, "Deleted")); }
}
