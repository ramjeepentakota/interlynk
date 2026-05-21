package com.enterprise.collab.service;

import com.enterprise.collab.entity.Channel;
import com.enterprise.collab.entity.User;
import com.enterprise.collab.repository.UserRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Arrays;
import java.util.HashSet;
import java.util.Optional;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.lenient;

/**
 * Pure-logic test: feed a message body, assert the right users come back as
 * mentioned. Doesn't touch the DB or messaging template — those are mocked.
 */
@ExtendWith(MockitoExtension.class)
class MentionServiceTest {

    @Mock UserRepository userRepository;
    @Mock NotificationService notificationService;

    @InjectMocks MentionService service;

    private User user(Long id, String name, User.Presence presence) {
        User u = new User();
        u.setId(id);
        u.setUsername(name);
        u.setDisplayName(name);
        u.setPresence(presence);
        return u;
    }

    private Channel channelWith(User... members) {
        Channel c = new Channel();
        c.setId(99L);
        c.setName("general");
        c.setMembers(new HashSet<>(Arrays.asList(members)));
        return c;
    }

    @Test
    void extractsPlainMention() {
        User alice = user(1L, "alice", User.Presence.ONLINE);
        User bob = user(2L, "bob", User.Presence.OFFLINE);
        Channel ch = channelWith(alice, bob);

        lenient().when(userRepository.findByUsername("alice")).thenReturn(Optional.of(alice));
        lenient().when(userRepository.findByUsername(anyString())).thenReturn(Optional.empty());
        lenient().when(userRepository.findByUsername("alice")).thenReturn(Optional.of(alice));

        Set<User> hits = service.extractMentionedUsers("hey @alice did you see this?", ch);
        assertThat(hits).extracting(User::getUsername).containsExactly("alice");
    }

    @Test
    void ignoresMentionForNonMember() {
        User alice = user(1L, "alice", User.Presence.ONLINE);
        Channel ch = channelWith(alice); // bob NOT in channel

        User bob = user(2L, "bob", User.Presence.OFFLINE);
        lenient().when(userRepository.findByUsername("bob")).thenReturn(Optional.of(bob));

        Set<User> hits = service.extractMentionedUsers("@bob can you help?", ch);
        assertThat(hits).isEmpty();
    }

    @Test
    void hereTokenOnlyHitsOnlineMembers() {
        User alice = user(1L, "alice", User.Presence.ONLINE);
        User bob = user(2L, "bob", User.Presence.OFFLINE);
        User carol = user(3L, "carol", User.Presence.ONLINE);
        Channel ch = channelWith(alice, bob, carol);

        Set<User> hits = service.extractMentionedUsers("@here heads up", ch);
        assertThat(hits).extracting(User::getUsername).containsExactlyInAnyOrder("alice", "carol");
    }

    @Test
    void channelTokenHitsEveryMember() {
        User alice = user(1L, "alice", User.Presence.ONLINE);
        User bob = user(2L, "bob", User.Presence.OFFLINE);
        Channel ch = channelWith(alice, bob);

        Set<User> hits = service.extractMentionedUsers("@channel announcement", ch);
        assertThat(hits).extracting(User::getUsername).containsExactlyInAnyOrder("alice", "bob");
    }

    @Test
    void emailLikeStringIsNotMention() {
        Channel ch = channelWith();
        Set<User> hits = service.extractMentionedUsers("contact me at alice@example.com", ch);
        assertThat(hits).isEmpty();
    }
}
