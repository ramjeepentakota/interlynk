package com.enterprise.collab.config;

import com.enterprise.collab.entity.*;
import com.enterprise.collab.repository.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.CommandLineRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import javax.persistence.EntityManager;
import javax.persistence.PersistenceContext;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

@Component
@RequiredArgsConstructor
@Slf4j
public class DataInitializer implements CommandLineRunner {

    private final RoleRepository roleRepository;
    private final UserRepository userRepository;
    private final TeamRepository teamRepository;
    private final ChannelRepository channelRepository;
    private final LicenseKeyRepository licenseKeyRepository;
    private final SystemSettingRepository systemSettingRepository;
    private final PasswordEncoder passwordEncoder;

    @PersistenceContext
    private EntityManager entityManager;

    @Value("${app.storage.base-path:/opt/company-platform}")
    private String storageBasePath;

    @Override
    @Transactional
    public void run(String... args) throws Exception {
        log.info("Starting data initialization...");

        initializeStorageDirectories();
        initializeRoles();
        initializeDemoUser();
        initializeAdminUser();
        // No default chats: never seed text channels and remove any
        // previously seeded "general"/"random"/"announcements".
        cleanupDefaultTextChannels();

        log.info("Data initialization completed successfully");
    }

    private void initializeRoles() {
        if (roleRepository.count() == 0) {
            log.info("Initializing roles...");

            Role adminRole = Role.builder()
                    .name("ADMIN")
                    .description("System Administrator with full access")
                    .permissions("ALL")
                    .build();
            roleRepository.save(adminRole);

            Role managerRole = Role.builder()
                    .name("MANAGER")
                    .description("Team Manager with limited admin access")
                    .permissions("USER_MANAGEMENT,TEAM_MANAGE,CHANNEL_MANAGE")
                    .build();
            roleRepository.save(managerRole);

            Role employeeRole = Role.builder()
                    .name("EMPLOYEE")
                    .description("Regular employee with standard access")
                    .permissions("CHAT,VOICE,CODE_REVIEW,WORKSPACE")
                    .build();
            roleRepository.save(employeeRole);

            log.info("Roles initialized: ADMIN, MANAGER, EMPLOYEE");
        }
    }

    private void initializeDemoUser() {
        if (!userRepository.findByUsername("demo").isPresent()) {
            log.info("Creating demo user...");

            Role employeeRole = roleRepository.findByName("EMPLOYEE")
                    .orElseGet(() -> roleRepository.save(Role.builder()
                            .name("EMPLOYEE")
                            .description("Regular employee")
                            .permissions("CHAT,VOICE,CODE_REVIEW,WORKSPACE")
                            .build()));

            // Password: "demo123"
            String passwordHash = passwordEncoder.encode("demo123");
            User demoUser = User.builder()
                    .username("demo")
                    .email("demo@interlynk.local")
                    .displayName("Demo User")
                    .passwordHash(passwordHash)
                    .status(User.UserStatus.ACTIVE)
                    .presence(User.Presence.ONLINE)
                    .build();

            // Assign employee role
            Set<Role> roles = new HashSet<>();
            roles.add(employeeRole);
            demoUser.setRoles(roles);
            userRepository.save(demoUser);

            log.info("Demo user created: username=demo, password=demo123");
        }
    }

    private void initializeAdminUser() {
        // Ensure Admin user exists
        if (!userRepository.findByUsername("admin").isPresent()) {
            log.info("Creating admin user...");

            Role adminRole = roleRepository.findByName("ADMIN")
                    .orElseGet(() -> roleRepository.save(Role.builder()
                            .name("ADMIN")
                            .description("System Administrator")
                            .permissions("ALL")
                            .build()));

            // Password: "admin@123"
            String adminPasswordHash = passwordEncoder.encode("admin@123");
            User adminUser = User.builder()
                    .username("admin")
                    .email("admin@interlynk.com")
                    .displayName("Admin User")
                    .passwordHash(adminPasswordHash)
                    .status(User.UserStatus.ACTIVE)
                    .presence(User.Presence.ONLINE)
                    .build();

            // Assign admin role
            Set<Role> adminRoles = new HashSet<>();
            adminRoles.add(adminRole);
            adminUser.setRoles(adminRoles);
            userRepository.save(adminUser);

            log.info("Admin user created: username=admin@interlynk.com, password=admin@123");
        }

        // Ensure Jay account exists for testing
        if (!userRepository.findByUsername("jay").isPresent()) {
            log.info("Creating jay user for testing...");
            User jayUser = User.builder()
                    .username("jay")
                    .email("jay@interlynk.com")
                    .displayName("Jay Dev")
                    .passwordHash(passwordEncoder.encode("Test@1234"))
                    .status(User.UserStatus.ACTIVE)
                    .presence(User.Presence.OFFLINE)
                    .build();
            
            Role employeeRole = roleRepository.findByName("EMPLOYEE").orElse(null);
            if (employeeRole != null) {
                Set<Role> roles = new java.util.HashSet<>();
                roles.add(employeeRole);
                jayUser.setRoles(roles);
            }
            userRepository.save(jayUser);
            log.info("Jay user created: username=jay, email=jay@interlynk.com, password=Test@1234");
        }
    }

    /**
     * The platform must not ship with any default chats. This removes the
     * legacy seeded "general"/"random"/"announcements" channels (and their
     * dependent rows) if a previous build created them. User-created
     * channels are never touched.
     */
    private void cleanupDefaultTextChannels() {
        try {
            @SuppressWarnings("unchecked")
            List<Number> ids = entityManager.createNativeQuery(
                    "SELECT id FROM channels WHERE team_id IS NULL AND name IN ('general','random','announcements')")
                    .getResultList();
            if (ids == null || ids.isEmpty()) {
                return;
            }

            log.info("Removing {} legacy default text channel(s)...", ids.size());
            String inClause = "(SELECT id FROM messages WHERE channel_id IN "
                    + "(SELECT id FROM channels WHERE team_id IS NULL AND name IN ('general','random','announcements')))";

            entityManager.createNativeQuery("DELETE FROM reactions WHERE message_id IN " + inClause).executeUpdate();
            entityManager.createNativeQuery("DELETE FROM attachments WHERE message_id IN " + inClause).executeUpdate();
            entityManager.createNativeQuery("DELETE FROM message_read_receipts WHERE message_id IN " + inClause).executeUpdate();
            // Break the self-referencing parent_id FK before deleting messages.
            entityManager.createNativeQuery(
                    "UPDATE messages SET parent_id = NULL WHERE channel_id IN "
                    + "(SELECT id FROM channels WHERE team_id IS NULL AND name IN ('general','random','announcements'))")
                    .executeUpdate();
            entityManager.createNativeQuery(
                    "DELETE FROM messages WHERE channel_id IN "
                    + "(SELECT id FROM channels WHERE team_id IS NULL AND name IN ('general','random','announcements'))")
                    .executeUpdate();
            entityManager.createNativeQuery(
                    "DELETE FROM channel_members WHERE channel_id IN "
                    + "(SELECT id FROM channels WHERE team_id IS NULL AND name IN ('general','random','announcements'))")
                    .executeUpdate();
            entityManager.createNativeQuery(
                    "DELETE FROM channels WHERE team_id IS NULL AND name IN ('general','random','announcements')")
                    .executeUpdate();

            log.info("Legacy default text channels removed.");
        } catch (Exception e) {
            log.warn("Could not clean up default text channels: {}", e.getMessage());
        }
    }

    private void initializeStorageDirectories() {
        try {
            Path basePath = Paths.get(storageBasePath);
            Files.createDirectories(basePath.resolve("repos"));
            Files.createDirectories(basePath.resolve("user-workspaces"));
            Files.createDirectories(basePath.resolve("uploads"));
            Files.createDirectories(basePath.resolve("recordings"));
            Files.createDirectories(basePath.resolve("logs"));
            Files.createDirectories(basePath.resolve("temp"));
            log.info("Storage directories created at: {}", storageBasePath);
        } catch (IOException e) {
            log.error("Could not create storage directories: {}", e.getMessage());
        }
    }
}
