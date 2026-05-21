package com.enterprise.collab.service;

import com.enterprise.collab.dto.AdminSecurityDto.*;
import com.enterprise.collab.entity.*;
import com.enterprise.collab.exception.BadRequestException;
import com.enterprise.collab.exception.ConflictException;
import com.enterprise.collab.exception.ResourceNotFoundException;
import com.enterprise.collab.repository.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * Conditional access, DLP, sensitivity labels, information barriers, and
 * retention policies. CRUD only — enforcement engines (DLP scanning,
 * retention sweeper, IP gates) hook into these via {@code …Repository}
 * lookups at request time.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class AdminCompliancePolicyService {

    private final ConditionalAccessPolicyRepository caRepo;
    private final DlpPolicyRepository dlpRepo;
    private final SensitivityLabelRepository labelRepo;
    private final InformationBarrierRepository barrierRepo;
    private final RetentionPolicyRepository retentionRepo;

    private static final Set<String> CA_STATES = Set.of("ENFORCED", "REPORT_ONLY", "DISABLED");
    private static final Set<String> DLP_ACTIONS = Set.of("AUDIT", "WARN", "BLOCK", "TOMBSTONE");
    private static final Set<String> DLP_SCOPES = Set.of("CHATS", "FILES", "BOTH");
    private static final Set<String> BARRIER_TYPES = Set.of("DEPARTMENT", "ROLE");
    private static final Set<String> BARRIER_ACTIONS = Set.of("BLOCK", "WARN");
    private static final Set<String> RETAIN_APPLIES = Set.of("MESSAGES", "FILES", "BOTH");
    private static final Set<String> RETAIN_AFTER = Set.of("DELETE", "ARCHIVE", "LEGAL_HOLD");

    /* ── Conditional access ──────────────────────────────── */

    @Transactional(readOnly = true)
    public List<ConditionalAccessResponse> listCa() {
        return caRepo.findAllByOrderByNameAsc().stream().map(this::toResponse).collect(Collectors.toList());
    }

    @Transactional
    public ConditionalAccessResponse createCa(CreateConditionalAccessRequest req) {
        if (caRepo.findByName(req.getName()).isPresent())
            throw new ConflictException("Policy '" + req.getName() + "' already exists");
        ConditionalAccessPolicy p = ConditionalAccessPolicy.builder()
                .name(req.getName()).description(req.getDescription())
                .state(parseCaState(req.getState(), "REPORT_ONLY"))
                .rulesJson(req.getRulesJson())
                .trustedIpRanges(req.getTrustedIpRanges())
                .blockAction(req.getBlockAction() != null && req.getBlockAction())
                .requireMfa(req.getRequireMfa() == null ? true : req.getRequireMfa())
                .blockLegacyAuth(req.getBlockLegacyAuth() == null ? true : req.getBlockLegacyAuth())
                .sessionMinutes(req.getSessionMinutes() == null ? 60 : req.getSessionMinutes())
                .build();
        return toResponse(caRepo.save(p));
    }

    @Transactional
    public ConditionalAccessResponse updateCa(Long id, CreateConditionalAccessRequest req) {
        ConditionalAccessPolicy p = caRepo.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("ConditionalAccessPolicy", "id", id));
        if (req.getName() != null && !req.getName().isBlank()) p.setName(req.getName());
        if (req.getDescription() != null) p.setDescription(req.getDescription());
        if (req.getState() != null) p.setState(parseCaState(req.getState(), p.getState()));
        if (req.getRulesJson() != null) p.setRulesJson(req.getRulesJson());
        if (req.getTrustedIpRanges() != null) p.setTrustedIpRanges(req.getTrustedIpRanges());
        if (req.getBlockAction() != null) p.setBlockAction(req.getBlockAction());
        if (req.getRequireMfa() != null) p.setRequireMfa(req.getRequireMfa());
        if (req.getBlockLegacyAuth() != null) p.setBlockLegacyAuth(req.getBlockLegacyAuth());
        if (req.getSessionMinutes() != null) {
            if (req.getSessionMinutes() < 5 || req.getSessionMinutes() > 1440)
                throw new BadRequestException("sessionMinutes must be between 5 and 1440");
            p.setSessionMinutes(req.getSessionMinutes());
        }
        return toResponse(caRepo.save(p));
    }

    @Transactional
    public void deleteCa(Long id) {
        ConditionalAccessPolicy p = caRepo.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("ConditionalAccessPolicy", "id", id));
        caRepo.delete(p);
    }

    /* ── DLP ─────────────────────────────────────────────── */

    @Transactional(readOnly = true)
    public List<DlpPolicyResponse> listDlp() {
        return dlpRepo.findAllByOrderByNameAsc().stream().map(this::toResponse).collect(Collectors.toList());
    }

    @Transactional
    public DlpPolicyResponse createDlp(CreateDlpRequest req) {
        if (dlpRepo.findByName(req.getName()).isPresent())
            throw new ConflictException("DLP policy '" + req.getName() + "' already exists");
        DlpPolicy p = DlpPolicy.builder()
                .name(req.getName()).description(req.getDescription())
                .action(parseDlpAction(req.getAction(), "WARN"))
                .detectors(req.getDetectors())
                .scope(parseDlpScope(req.getScope(), "BOTH"))
                .appliesToExternal(req.getAppliesToExternal() == null ? true : req.getAppliesToExternal())
                .appliesToInternal(req.getAppliesToInternal() != null && req.getAppliesToInternal())
                .active(req.getActive() == null ? true : req.getActive())
                .build();
        return toResponse(dlpRepo.save(p));
    }

    @Transactional
    public DlpPolicyResponse updateDlp(Long id, CreateDlpRequest req) {
        DlpPolicy p = dlpRepo.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("DlpPolicy", "id", id));
        if (req.getName() != null && !req.getName().isBlank()) p.setName(req.getName());
        if (req.getDescription() != null) p.setDescription(req.getDescription());
        if (req.getAction() != null) p.setAction(parseDlpAction(req.getAction(), p.getAction()));
        if (req.getDetectors() != null) p.setDetectors(req.getDetectors());
        if (req.getScope() != null) p.setScope(parseDlpScope(req.getScope(), p.getScope()));
        if (req.getAppliesToExternal() != null) p.setAppliesToExternal(req.getAppliesToExternal());
        if (req.getAppliesToInternal() != null) p.setAppliesToInternal(req.getAppliesToInternal());
        if (req.getActive() != null) p.setActive(req.getActive());
        return toResponse(dlpRepo.save(p));
    }

    @Transactional
    public void deleteDlp(Long id) {
        DlpPolicy p = dlpRepo.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("DlpPolicy", "id", id));
        dlpRepo.delete(p);
    }

    /* ── Sensitivity labels ──────────────────────────────── */

    @Transactional(readOnly = true)
    public List<SensitivityLabelResponse> listLabels() {
        return labelRepo.findAllByOrderByPriorityAscNameAsc().stream()
                .map(this::toResponse).collect(Collectors.toList());
    }

    @Transactional
    public SensitivityLabelResponse createLabel(CreateLabelRequest req) {
        if (labelRepo.findByName(req.getName()).isPresent())
            throw new ConflictException("Label '" + req.getName() + "' already exists");
        SensitivityLabel l = SensitivityLabel.builder()
                .name(req.getName()).description(req.getDescription())
                .color(req.getColor())
                .priority(req.getPriority() == null ? 50 : req.getPriority())
                .requiresEncryption(req.getRequiresEncryption() != null && req.getRequiresEncryption())
                .watermarkText(req.getWatermarkText())
                .build();
        return toResponse(labelRepo.save(l));
    }

    @Transactional
    public SensitivityLabelResponse updateLabel(Long id, CreateLabelRequest req) {
        SensitivityLabel l = labelRepo.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("SensitivityLabel", "id", id));
        if (req.getName() != null && !req.getName().isBlank()) l.setName(req.getName());
        if (req.getDescription() != null) l.setDescription(req.getDescription());
        if (req.getColor() != null) l.setColor(req.getColor());
        if (req.getPriority() != null) l.setPriority(req.getPriority());
        if (req.getRequiresEncryption() != null) l.setRequiresEncryption(req.getRequiresEncryption());
        if (req.getWatermarkText() != null) l.setWatermarkText(req.getWatermarkText());
        return toResponse(labelRepo.save(l));
    }

    @Transactional
    public void deleteLabel(Long id) {
        SensitivityLabel l = labelRepo.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("SensitivityLabel", "id", id));
        labelRepo.delete(l);
    }

    /* ── Information barriers ────────────────────────────── */

    @Transactional(readOnly = true)
    public List<InformationBarrierResponse> listBarriers() {
        return barrierRepo.findAllByOrderByNameAsc().stream()
                .map(this::toResponse).collect(Collectors.toList());
    }

    @Transactional
    public InformationBarrierResponse createBarrier(CreateBarrierRequest req) {
        String type = parseBarrierType(req.getSegmentType(), "DEPARTMENT");
        if (req.getSegmentA().equalsIgnoreCase(req.getSegmentB()))
            throw new BadRequestException("Barrier segments must differ");
        InformationBarrier b = InformationBarrier.builder()
                .name(req.getName()).description(req.getDescription())
                .segmentType(type)
                .segmentA(req.getSegmentA()).segmentB(req.getSegmentB())
                .action(parseBarrierAction(req.getAction(), "BLOCK"))
                .active(req.getActive() == null ? true : req.getActive())
                .build();
        return toResponse(barrierRepo.save(b));
    }

    @Transactional
    public InformationBarrierResponse updateBarrier(Long id, CreateBarrierRequest req) {
        InformationBarrier b = barrierRepo.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("InformationBarrier", "id", id));
        if (req.getName() != null && !req.getName().isBlank()) b.setName(req.getName());
        if (req.getDescription() != null) b.setDescription(req.getDescription());
        if (req.getSegmentType() != null) b.setSegmentType(parseBarrierType(req.getSegmentType(), b.getSegmentType()));
        if (req.getSegmentA() != null) b.setSegmentA(req.getSegmentA());
        if (req.getSegmentB() != null) b.setSegmentB(req.getSegmentB());
        if (req.getAction() != null) b.setAction(parseBarrierAction(req.getAction(), b.getAction()));
        if (req.getActive() != null) b.setActive(req.getActive());
        return toResponse(barrierRepo.save(b));
    }

    @Transactional
    public void deleteBarrier(Long id) {
        InformationBarrier b = barrierRepo.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("InformationBarrier", "id", id));
        barrierRepo.delete(b);
    }

    /* ── Retention ───────────────────────────────────────── */

    @Transactional(readOnly = true)
    public List<RetentionPolicyResponse> listRetention() {
        return retentionRepo.findAllByOrderByNameAsc().stream()
                .map(this::toResponse).collect(Collectors.toList());
    }

    @Transactional
    public RetentionPolicyResponse createRetention(CreateRetentionRequest req) {
        if (retentionRepo.findByName(req.getName()).isPresent())
            throw new ConflictException("Retention policy '" + req.getName() + "' already exists");
        RetentionPolicy p = RetentionPolicy.builder()
                .name(req.getName()).description(req.getDescription())
                .appliesTo(parseRetainApplies(req.getAppliesTo(), "BOTH"))
                .scope(req.getScope() == null ? "ORG" : req.getScope())
                .retainDays(req.getRetainDays() == null ? 365 : req.getRetainDays())
                .afterAction(parseRetainAfter(req.getAfterAction(), "DELETE"))
                .active(req.getActive() == null ? true : req.getActive())
                .build();
        return toResponse(retentionRepo.save(p));
    }

    @Transactional
    public RetentionPolicyResponse updateRetention(Long id, CreateRetentionRequest req) {
        RetentionPolicy p = retentionRepo.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("RetentionPolicy", "id", id));
        if (req.getName() != null && !req.getName().isBlank()) p.setName(req.getName());
        if (req.getDescription() != null) p.setDescription(req.getDescription());
        if (req.getAppliesTo() != null) p.setAppliesTo(parseRetainApplies(req.getAppliesTo(), p.getAppliesTo()));
        if (req.getScope() != null) p.setScope(req.getScope());
        if (req.getRetainDays() != null) {
            if (req.getRetainDays() < 1) throw new BadRequestException("retainDays must be >= 1");
            p.setRetainDays(req.getRetainDays());
        }
        if (req.getAfterAction() != null) p.setAfterAction(parseRetainAfter(req.getAfterAction(), p.getAfterAction()));
        if (req.getActive() != null) p.setActive(req.getActive());
        return toResponse(retentionRepo.save(p));
    }

    @Transactional
    public void deleteRetention(Long id) {
        RetentionPolicy p = retentionRepo.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("RetentionPolicy", "id", id));
        retentionRepo.delete(p);
    }

    /* ── Parsers ─────────────────────────────────────────── */

    private String parseCaState(String s, String fallback) {
        if (s == null) return fallback;
        String u = s.trim().toUpperCase();
        if (!CA_STATES.contains(u)) throw new BadRequestException("Invalid state. Allowed: " + CA_STATES);
        return u;
    }
    private String parseDlpAction(String s, String fb) { return require(s, DLP_ACTIONS, fb, "DLP action"); }
    private String parseDlpScope(String s, String fb) { return require(s, DLP_SCOPES, fb, "DLP scope"); }
    private String parseBarrierType(String s, String fb) { return require(s, BARRIER_TYPES, fb, "barrier type"); }
    private String parseBarrierAction(String s, String fb) { return require(s, BARRIER_ACTIONS, fb, "barrier action"); }
    private String parseRetainApplies(String s, String fb) { return require(s, RETAIN_APPLIES, fb, "retention appliesTo"); }
    private String parseRetainAfter(String s, String fb) { return require(s, RETAIN_AFTER, fb, "retention afterAction"); }

    private String require(String s, Set<String> allowed, String fb, String label) {
        if (s == null) return fb;
        String u = s.trim().toUpperCase();
        if (!allowed.contains(u)) throw new BadRequestException("Invalid " + label + ". Allowed: " + allowed);
        return u;
    }

    /* ── Mappers ─────────────────────────────────────────── */

    private ConditionalAccessResponse toResponse(ConditionalAccessPolicy p) {
        return ConditionalAccessResponse.builder()
                .id(p.getId()).name(p.getName()).description(p.getDescription())
                .state(p.getState()).rulesJson(p.getRulesJson())
                .trustedIpRanges(p.getTrustedIpRanges())
                .blockAction(p.isBlockAction()).requireMfa(p.isRequireMfa())
                .blockLegacyAuth(p.isBlockLegacyAuth()).sessionMinutes(p.getSessionMinutes())
                .createdAt(p.getCreatedAt()).updatedAt(p.getUpdatedAt()).build();
    }
    private DlpPolicyResponse toResponse(DlpPolicy p) {
        return DlpPolicyResponse.builder()
                .id(p.getId()).name(p.getName()).description(p.getDescription())
                .action(p.getAction()).detectors(p.getDetectors()).scope(p.getScope())
                .appliesToExternal(p.isAppliesToExternal()).appliesToInternal(p.isAppliesToInternal())
                .active(p.isActive())
                .createdAt(p.getCreatedAt()).updatedAt(p.getUpdatedAt()).build();
    }
    private SensitivityLabelResponse toResponse(SensitivityLabel l) {
        return SensitivityLabelResponse.builder()
                .id(l.getId()).name(l.getName()).description(l.getDescription())
                .color(l.getColor()).priority(l.getPriority())
                .requiresEncryption(l.isRequiresEncryption()).watermarkText(l.getWatermarkText())
                .build();
    }
    private InformationBarrierResponse toResponse(InformationBarrier b) {
        return InformationBarrierResponse.builder()
                .id(b.getId()).name(b.getName()).description(b.getDescription())
                .segmentType(b.getSegmentType()).segmentA(b.getSegmentA()).segmentB(b.getSegmentB())
                .action(b.getAction()).active(b.isActive()).build();
    }
    private RetentionPolicyResponse toResponse(RetentionPolicy p) {
        return RetentionPolicyResponse.builder()
                .id(p.getId()).name(p.getName()).description(p.getDescription())
                .appliesTo(p.getAppliesTo()).scope(p.getScope())
                .retainDays(p.getRetainDays()).afterAction(p.getAfterAction())
                .active(p.isActive()).build();
    }
}
