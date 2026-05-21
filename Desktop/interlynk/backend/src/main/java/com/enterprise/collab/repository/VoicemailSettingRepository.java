package com.enterprise.collab.repository;

import com.enterprise.collab.entity.VoicemailSetting;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface VoicemailSettingRepository extends JpaRepository<VoicemailSetting, Long> {
    Optional<VoicemailSetting> findByUserId(Long userId);
}
