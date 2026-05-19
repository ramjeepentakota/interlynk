package com.enterprise.collab.repository;

import com.enterprise.collab.entity.SystemSetting;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.Optional;

@Repository
public interface SystemSettingRepository extends JpaRepository<SystemSetting, String> {
    Optional<SystemSetting> findByKeyName(String keyName);
    Optional<SystemSetting> findByKey(String key);
}
