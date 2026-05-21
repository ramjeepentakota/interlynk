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
                // Allow localhost and private LAN origins (any port) on either
                // http:// or https:// — HTTPS is required when the frontend
                // dev server uses the basic-ssl plugin so that the browser
                // exposes camera/microphone (getUserMedia) over the LAN.
                String[] originPatterns = {
                                "http://localhost:[*]",
                                "https://localhost:[*]",
                                "http://127.0.0.1:[*]",
                                "https://127.0.0.1:[*]",
                                "http://192.168.*:[*]",
                                "https://192.168.*:[*]",
                                "http://10.*:[*]",
                                "https://10.*:[*]",
                                "http://172.16.*:[*]",
                                "https://172.16.*:[*]"
                };

                // Main WebSocket endpoint with SockJS fallback
                registry.addEndpoint("/ws")
                                .setAllowedOriginPatterns(originPatterns)
                                .withSockJS();

                // WebSocket endpoint without SockJS (for native WebSocket)
                registry.addEndpoint("/ws")
                                .setAllowedOriginPatterns(originPatterns);

                // Endpoint for call signaling
                registry.addEndpoint("/ws/call")
                                .setAllowedOriginPatterns(originPatterns)
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
