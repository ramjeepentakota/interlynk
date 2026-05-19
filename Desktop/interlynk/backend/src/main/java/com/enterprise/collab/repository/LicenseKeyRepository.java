package com.enterprise.collab.repository;

import com.enterprise.collab.entity.LicenseKey;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.Optional;

@Repository
public interface LicenseKeyRepository extends JpaRepository<LicenseKey, Long> {
    Optional<LicenseKey> findByLicenseKey(String licenseKey);
    Optional<LicenseKey> findByIsActiveTrue();
}
