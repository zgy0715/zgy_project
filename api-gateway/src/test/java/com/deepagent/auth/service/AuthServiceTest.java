package com.deepagent.auth.service;

import com.deepagent.auth.dto.AuthResponse;
import com.deepagent.auth.dto.LoginRequest;
import com.deepagent.auth.dto.RegisterRequest;
import com.deepagent.auth.entity.User;
import com.deepagent.auth.jwt.JwtTokenProvider;
import com.deepagent.auth.repository.UserRepository;
import com.deepagent.auth.service.impl.AuthServiceImpl;
import com.deepagent.common.exception.BusinessException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Unit tests for {@link AuthServiceImpl}.
 *
 * <p>Tests cover the main authentication flows: registration, login,
 * and token refresh, including error cases.</p>
 */
@ExtendWith(MockitoExtension.class)
class AuthServiceTest {

    @Mock
    private UserRepository userRepository;

    @Mock
    private PasswordEncoder passwordEncoder;

    @Mock
    private JwtTokenProvider jwtTokenProvider;

    @InjectMocks
    private AuthServiceImpl authService;

    private RegisterRequest registerRequest;
    private LoginRequest loginRequest;
    private User testUser;

    @BeforeEach
    void setUp() {
        registerRequest = new RegisterRequest("testuser", "test@example.com", "password123");
        loginRequest = new LoginRequest("testuser", "password123");

        testUser = User.builder()
                .id(1L)
                .username("testuser")
                .email("test@example.com")
                .password("encoded_password")
                .role(User.Role.USER)
                .enabled(true)
                .build();
    }

    @Nested
    @DisplayName("Registration Tests")
    class RegistrationTests {

        @Test
        @DisplayName("Should register a new user successfully")
        void shouldRegisterNewUser() {
            when(userRepository.existsByUsername("testuser")).thenReturn(false);
            when(userRepository.existsByEmail("test@example.com")).thenReturn(false);
            when(passwordEncoder.encode("password123")).thenReturn("encoded_password");
            when(userRepository.save(any(User.class))).thenReturn(testUser);
            when(jwtTokenProvider.generateAccessToken(anyString(), anyString())).thenReturn("access_token");
            when(jwtTokenProvider.generateRefreshToken(anyString())).thenReturn("refresh_token");
            when(jwtTokenProvider.getAccessTokenExpirationSeconds()).thenReturn(3600L);

            var response = authService.register(registerRequest);

            assertThat(response).isNotNull();
            assertThat(response.accessToken()).isEqualTo("access_token");
            assertThat(response.refreshToken()).isEqualTo("refresh_token");
            assertThat(response.username()).isEqualTo("testuser");
            assertThat(response.role()).isEqualTo(User.Role.USER);

            verify(userRepository).save(any(User.class));
        }

        @Test
        @DisplayName("Should throw exception when username already exists")
        void shouldThrowWhenUsernameExists() {
            when(userRepository.existsByUsername("testuser")).thenReturn(true);

            assertThatThrownBy(() -> authService.register(registerRequest))
                    .isInstanceOf(BusinessException.class)
                    .hasMessageContaining("Username already exists");
        }

        @Test
        @DisplayName("Should throw exception when email already exists")
        void shouldThrowWhenEmailExists() {
            when(userRepository.existsByUsername("testuser")).thenReturn(false);
            when(userRepository.existsByEmail("test@example.com")).thenReturn(true);

            assertThatThrownBy(() -> authService.register(registerRequest))
                    .isInstanceOf(BusinessException.class)
                    .hasMessageContaining("Email already exists");
        }
    }

    @Nested
    @DisplayName("Login Tests")
    class LoginTests {

        @Test
        @DisplayName("Should login successfully with valid credentials")
        void shouldLoginWithValidCredentials() {
            when(userRepository.findByUsername("testuser")).thenReturn(Optional.of(testUser));
            when(passwordEncoder.matches("password123", "encoded_password")).thenReturn(true);
            when(jwtTokenProvider.generateAccessToken(anyString(), anyString())).thenReturn("access_token");
            when(jwtTokenProvider.generateRefreshToken(anyString())).thenReturn("refresh_token");
            when(jwtTokenProvider.getAccessTokenExpirationSeconds()).thenReturn(3600L);

            var response = authService.login(loginRequest);

            assertThat(response).isNotNull();
            assertThat(response.accessToken()).isEqualTo("access_token");
        }

        @Test
        @DisplayName("Should throw exception with invalid username")
        void shouldThrowWithInvalidUsername() {
            when(userRepository.findByUsername("testuser")).thenReturn(Optional.empty());

            assertThatThrownBy(() -> authService.login(loginRequest))
                    .isInstanceOf(BusinessException.class)
                    .hasMessageContaining("Invalid username or password");
        }

        @Test
        @DisplayName("Should throw exception with invalid password")
        void shouldThrowWithInvalidPassword() {
            when(userRepository.findByUsername("testuser")).thenReturn(Optional.of(testUser));
            when(passwordEncoder.matches("password123", "encoded_password")).thenReturn(false);

            assertThatThrownBy(() -> authService.login(loginRequest))
                    .isInstanceOf(BusinessException.class)
                    .hasMessageContaining("Invalid username or password");
        }

        @Test
        @DisplayName("Should throw exception when account is disabled")
        void shouldThrowWhenAccountDisabled() {
            testUser.setEnabled(false);
            when(userRepository.findByUsername("testuser")).thenReturn(Optional.of(testUser));
            when(passwordEncoder.matches("password123", "encoded_password")).thenReturn(true);

            assertThatThrownBy(() -> authService.login(loginRequest))
                    .isInstanceOf(BusinessException.class)
                    .hasMessageContaining("Account is disabled");
        }
    }

    @Nested
    @DisplayName("Token Refresh Tests")
    class TokenRefreshTests {

        @Test
        @DisplayName("Should refresh token successfully")
        void shouldRefreshToken() {
            when(jwtTokenProvider.validateRefreshToken("valid_refresh")).thenReturn(true);
            when(jwtTokenProvider.getUsernameFromToken("valid_refresh")).thenReturn("testuser");
            when(userRepository.findByUsername("testuser")).thenReturn(Optional.of(testUser));
            when(jwtTokenProvider.generateAccessToken(anyString(), anyString())).thenReturn("new_access");
            when(jwtTokenProvider.generateRefreshToken(anyString())).thenReturn("new_refresh");
            when(jwtTokenProvider.getAccessTokenExpirationSeconds()).thenReturn(3600L);

            var response = authService.refreshToken("valid_refresh");

            assertThat(response).isNotNull();
            assertThat(response.accessToken()).isEqualTo("new_access");
            assertThat(response.refreshToken()).isEqualTo("new_refresh");
        }

        @Test
        @DisplayName("Should throw exception with invalid refresh token")
        void shouldThrowWithInvalidRefreshToken() {
            when(jwtTokenProvider.validateRefreshToken("invalid")).thenReturn(false);

            assertThatThrownBy(() -> authService.refreshToken("invalid"))
                    .isInstanceOf(BusinessException.class)
                    .hasMessageContaining("Invalid or expired refresh token");
        }
    }
}
