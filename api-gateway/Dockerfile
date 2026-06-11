# Build stage
FROM eclipse-temurin:21-jdk-alpine AS builder

WORKDIR /app

# Install Maven
RUN apk add --no-cache maven

# Copy pom.xml first for dependency caching
COPY pom.xml .
RUN mvn dependency:go-offline -B

# Copy source code and build
COPY src ./src
RUN mvn package -DskipTests -B

# Runtime stage
FROM eclipse-temurin:21-jre-alpine

LABEL maintainer="DeepAgent Team"
LABEL description="DeepAgent API Gateway - Multi-AI Agent Collaboration Platform"

WORKDIR /app

# Create non-root user for security
RUN addgroup -S deepagent && adduser -S deepagent -G deepagent

# Copy the built JAR from builder stage
COPY --from=builder /app/target/*.jar app.jar

# Change ownership to non-root user
RUN chown -R deepagent:deepagent /app

# Switch to non-root user
USER deepagent

# Expose the application port
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 \
    CMD wget -qO- http://localhost:8080/actuator/health || exit 1

# JVM options for containerized environment
ENV JAVA_OPTS="-XX:+UseZGC \
               -XX:+ZGenerational \
               -XX:MaxRAMPercentage=75.0 \
               -XX:+UseStringDeduplication \
               -Djava.security.egd=file:/dev/./urandom \
               --enable-preview"

# Entry point
ENTRYPOINT ["sh", "-c", "java ${JAVA_OPTS} -jar app.jar"]
