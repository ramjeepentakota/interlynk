package com.enterprise.collab.config;

import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.messaging.simp.config.ChannelRegistration;
import org.springframework.messaging.simp.config.MessageBrokerRegistry;
import org.springframework.scheduling.concurrent.ThreadPoolTaskScheduler;
import org.springframework.web.socket.config.annotation.EnableWebSocketMessageBroker;
import org.springframework.web.socket.config.annotation.StompEndpointRegistry;
import org.springframework.web.socket.config.annotation.WebSocketMessageBrokerConfigurer;

/**
 * WebSocket Configuration with JWT Authentication.
 */
@Configuration
@EnableWebSocketMessageBroker
@RequiredArgsConstructor
public class WebSocketConfig implements WebSocketMessageBrokerConfigurer {

        @Value("${springwebsocket.message.buffer-size:81920}")
        private int messageBrokerSize;

        @Value("${springwebsocket.broker.enabled:false}")
        private boolean useRedisBroker;

        private final WebSocketAuthInterceptor authInterceptor;

        @Override
        public void configureMessageBroker(MessageBrokerRegistry config) {
                ThreadPoolTaskScheduler taskScheduler = new ThreadPoolTaskScheduler();
                taskScheduler.setPoolSize(10);
                taskScheduler.setThreadNamePrefix("ws-heartbeat-");
                taskScheduler.initialize();

                config.enableSimpleBroker("/topic", "/queue")
                                .setHeartbeatValue(new long[] { 10000, 10000 })
                                .setTaskScheduler(taskScheduler);

                config.setApplicationDestinationPrefixes("/app");
                config.setUserDestinationPrefix("/user");
        }

        @Override
        public void registerStompEndpoints(StompEndpointRegistry registry) {
                // Main WebSocket endpoint with SockJS fallback
                registry.addEndpoint("/ws")
                                .setAllowedOrigins("http://localhost:5173")
                                .withSockJS();

                // WebSocket endpoint without SockJS (for native WebSocket)
                registry.addEndpoint("/ws")
                                .setAllowedOrigins("http://localhost:5173");

                // Endpoint for call signaling
                registry.addEndpoint("/ws/call")
                                .setAllowedOrigins("http://localhost:5173")
                                .withSockJS();
        }

        @Override
        public void configureClientInboundChannel(ChannelRegistration registration) {
                // Register the JWT authentication interceptor
                registration.interceptors(authInterceptor);
        }

        @Override
        public void configureWebSocketTransport(
                        org.springframework.web.socket.config.annotation.WebSocketTransportRegistration registration) {
                registration.setMessageSizeLimit(messageBrokerSize);
                registration.setSendBufferSizeLimit(messageBrokerSize);
        }
}
