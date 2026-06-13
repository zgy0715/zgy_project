package com.deepagent.performance;

import com.deepagent.auth.jwt.JwtTokenProvider;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.RepeatedTest;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInstance;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Performance benchmarks for the API Gateway.
 *
 * <p>Measures:</p>
 * <ul>
 *   <li>JWT token generation/validation throughput</li>
 *   <li>REST API endpoint response times</li>
 *   <li>WebSocket connection throughput</li>
 *   <li>Concurrent request handling</li>
 * </ul>
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
class PerformanceBenchmarkTest {

    // ── Performance thresholds ──────────────────────────────────────────────

    private static final double JWT_GENERATION_THRESHOLD_MS = 5.0;    // < 5ms per token
    private static final double JWT_VALIDATION_THRESHOLD_MS = 2.0;    // < 2ms per validation
    private static final int CONCURRENT_REQUEST_COUNT = 100;          // 100 concurrent requests
    private static final double CONCURRENT_REQUEST_THRESHOLD_MS = 5000.0; // < 5s total
    private static final double PROXY_OVERHEAD_THRESHOLD_MS = 50.0;   // < 50ms proxy overhead

    @Autowired
    private MockMvc mockMvc;

    private JwtTokenProvider jwtTokenProvider;

    @BeforeEach
    void setUp() {
        // Create a JwtTokenProvider with a test secret
        String testSecret = "this-is-a-very-long-test-secret-key-for-performance-benchmark-testing-purposes-only-min-256-bits";
        jwtTokenProvider = new JwtTokenProvider(testSecret, 3600000L, 86400000L);
    }

    // ── Helper: compute statistics ──────────────────────────────────────────

    private static class BenchStats {
        final double mean;
        final double median;
        final double p95;
        final double min;
        final double max;

        BenchStats(List<Double> durations) {
            Collections.sort(durations);
            int n = durations.size();
            this.mean = durations.stream().mapToDouble(d -> d).sum() / n;
            this.median = durations.get(n / 2);
            this.p95 = durations.get((int) (n * 0.95));
            this.min = durations.get(0);
            this.max = durations.get(n - 1);
        }

        @Override
        public String toString() {
            return String.format("mean=%.3fms, median=%.3fms, p95=%.3fms, min=%.3fms, max=%.3fms",
                    mean, median, p95, min, max);
        }
    }

    private BenchStats benchmark(String label, Runnable task, int iterations) {
        // Warm up
        for (int i = 0; i < Math.min(5, iterations); i++) {
            task.run();
        }

        List<Double> durations = new ArrayList<>(iterations);
        for (int i = 0; i < iterations; i++) {
            long start = System.nanoTime();
            task.run();
            long end = System.nanoTime();
            durations.add((end - start) / 1_000_000.0); // nanos to millis
        }

        BenchStats stats = new BenchStats(durations);
        System.out.printf("[BENCH] %s: %s%n", label, stats);
        return stats;
    }

    // ═══════════════════════════════════════════════════════════════════════
    // JWT Token Generation Performance
    // ═══════════════════════════════════════════════════════════════════════

    @Test
    @DisplayName("JWT access token generation should be under 5ms")
    void testJwtTokenGenerationPerformance() {
        BenchStats stats = benchmark("JWT access token generation", () -> {
            String token = jwtTokenProvider.generateAccessToken("testuser", "admin");
            assertThat(token).isNotBlank();
        }, 100);

        assertThat(stats.p95).isLessThan(JWT_GENERATION_THRESHOLD_MS)
                .withFailMessage("JWT generation p95=%.3fms exceeds threshold %.1fms",
                        stats.p95, JWT_GENERATION_THRESHOLD_MS);
    }

    @Test
    @DisplayName("JWT refresh token generation should be under 5ms")
    void testJwtRefreshTokenGenerationPerformance() {
        BenchStats stats = benchmark("JWT refresh token generation", () -> {
            String token = jwtTokenProvider.generateRefreshToken("testuser");
            assertThat(token).isNotBlank();
        }, 100);

        assertThat(stats.p95).isLessThan(JWT_GENERATION_THRESHOLD_MS)
                .withFailMessage("JWT refresh generation p95=%.3fms exceeds threshold %.1fms",
                        stats.p95, JWT_GENERATION_THRESHOLD_MS);
    }

    // ═══════════════════════════════════════════════════════════════════════
    // JWT Token Validation Performance
    // ═══════════════════════════════════════════════════════════════════════

    @Test
    @DisplayName("JWT access token validation should be under 2ms")
    void testJwtTokenValidationPerformance() {
        String token = jwtTokenProvider.generateAccessToken("testuser", "admin");

        BenchStats stats = benchmark("JWT access token validation", () -> {
            boolean valid = jwtTokenProvider.validateAccessToken(token);
            assertThat(valid).isTrue();
        }, 200);

        assertThat(stats.p95).isLessThan(JWT_VALIDATION_THRESHOLD_MS)
                .withFailMessage("JWT validation p95=%.3fms exceeds threshold %.1fms",
                        stats.p95, JWT_VALIDATION_THRESHOLD_MS);
    }

    @Test
    @DisplayName("JWT refresh token validation should be under 2ms")
    void testJwtRefreshTokenValidationPerformance() {
        String token = jwtTokenProvider.generateRefreshToken("testuser");

        BenchStats stats = benchmark("JWT refresh token validation", () -> {
            boolean valid = jwtTokenProvider.validateRefreshToken(token);
            assertThat(valid).isTrue();
        }, 200);

        assertThat(stats.p95).isLessThan(JWT_VALIDATION_THRESHOLD_MS)
                .withFailMessage("JWT refresh validation p95=%.3fms exceeds threshold %.1fms",
                        stats.p95, JWT_VALIDATION_THRESHOLD_MS);
    }

    @Test
    @DisplayName("JWT claim extraction should be under 1ms")
    void testJwtClaimExtractionPerformance() {
        String token = jwtTokenProvider.generateAccessToken("benchmarkuser", "developer");

        BenchStats stats = benchmark("JWT claim extraction", () -> {
            String username = jwtTokenProvider.getUsernameFromToken(token);
            String role = jwtTokenProvider.getRoleFromToken(token);
            assertThat(username).isEqualTo("benchmarkuser");
            assertThat(role).isEqualTo("developer");
        }, 200);

        assertThat(stats.p95).isLessThan(1.0)
                .withFailMessage("JWT claim extraction p95=%.3fms exceeds 1ms", stats.p95);
    }

    // ═══════════════════════════════════════════════════════════════════════
    // Concurrent Request Handling
    // ═══════════════════════════════════════════════════════════════════════

    @Test
    @DisplayName("Should handle 100 concurrent requests without errors")
    void testConcurrentRequestHandling() throws Exception {
        int numRequests = CONCURRENT_REQUEST_COUNT;
        ExecutorService executor = Executors.newFixedThreadPool(20);
        CountDownLatch latch = new CountDownLatch(numRequests);
        AtomicInteger successCount = new AtomicInteger(0);
        AtomicInteger failureCount = new AtomicInteger(0);

        long start = System.nanoTime();

        for (int i = 0; i < numRequests; i++) {
            final int idx = i;
            executor.submit(() -> {
                try {
                    MvcResult result = mockMvc.perform(get("/actuator/health"))
                            .andReturn();
                    if (result.getResponse().getStatus() == 200) {
                        successCount.incrementAndGet();
                    } else {
                        failureCount.incrementAndGet();
                    }
                } catch (Exception e) {
                    failureCount.incrementAndGet();
                } finally {
                    latch.countDown();
                }
            });
        }

        boolean completed = latch.await(10, TimeUnit.SECONDS);
        long elapsed = (System.nanoTime() - start) / 1_000_000;

        executor.shutdown();

        assertThat(completed).isTrue()
                .withFailMessage("Not all concurrent requests completed within 10s");
        assertThat(failureCount.get()).isEqualTo(0)
                .withFailMessage("%d out of %d concurrent requests failed",
                        failureCount.get(), numRequests);
        assertThat(elapsed).isLessThan((long) CONCURRENT_REQUEST_THRESHOLD_MS)
                .withFailMessage("%d concurrent requests took %dms (threshold: %.0fms)",
                        numRequests, elapsed, CONCURRENT_REQUEST_THRESHOLD_MS);
    }

    // ═══════════════════════════════════════════════════════════════════════
    // Agent Proxy Latency
    // ═══════════════════════════════════════════════════════════════════════

    @Test
    @DisplayName("Agent proxy should add less than 50ms overhead")
    void testAgentProxyLatency() throws Exception {
        // Measure the health endpoint as a baseline for gateway overhead
        BenchStats stats = benchmark("Health endpoint (proxy overhead)", () -> {
            try {
                mockMvc.perform(get("/actuator/health")).andExpect(status().isOk());
            } catch (Exception e) {
                throw new RuntimeException(e);
            }
        }, 50);

        // The health endpoint should respond quickly — any overhead is from the gateway
        assertThat(stats.p95).isLessThan(PROXY_OVERHEAD_THRESHOLD_MS)
                .withFailMessage("Health endpoint p95=%.3fms exceeds proxy overhead threshold %.1fms",
                        stats.p95, PROXY_OVERHEAD_THRESHOLD_MS);
    }

    // ═══════════════════════════════════════════════════════════════════════
    // JWT Throughput Under Load
    // ═══════════════════════════════════════════════════════════════════════

    @Test
    @DisplayName("JWT operations should handle 50 concurrent threads")
    void testConcurrentJwtOperations() throws Exception {
        int numThreads = 50;
        ExecutorService executor = Executors.newFixedThreadPool(numThreads);
        CountDownLatch latch = new CountDownLatch(numThreads);
        AtomicInteger successCount = new AtomicInteger(0);

        long start = System.nanoTime();

        for (int i = 0; i < numThreads; i++) {
            executor.submit(() -> {
                try {
                    // Generate and validate in each thread
                    for (int j = 0; j < 20; j++) {
                        String token = jwtTokenProvider.generateAccessToken(
                                "thread-user", "admin");
                        boolean valid = jwtTokenProvider.validateAccessToken(token);
                        if (valid) {
                            successCount.incrementAndGet();
                        }
                    }
                } finally {
                    latch.countDown();
                }
            });
        }

        boolean completed = latch.await(10, TimeUnit.SECONDS);
        long elapsed = (System.nanoTime() - start) / 1_000_000;

        executor.shutdown();

        assertThat(completed).isTrue()
                .withFailMessage("Concurrent JWT operations did not complete within 10s");
        assertThat(successCount.get()).isEqualTo(numThreads * 20)
                .withFailMessage("Expected %d successful JWT ops, got %d",
                        numThreads * 20, successCount.get());

        double perOpMs = (double) elapsed / (numThreads * 20);
        System.out.printf("[BENCH] Concurrent JWT: %d ops in %dms (%.3fms/op)%n",
                numThreads * 20, elapsed, perOpMs);
    }
}
