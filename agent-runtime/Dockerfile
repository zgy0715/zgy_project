# ========================
# Stage 1: Builder
# ========================
FROM python:3.11-slim AS builder

WORKDIR /app

# Install system dependencies
RUN apt-get update && \
    apt-get install -y --no-install-recommends git build-essential && \
    rm -rf /var/lib/apt/lists/*

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir --prefix=/install -r requirements.txt

# ========================
# Stage 2: Runtime
# ========================
FROM python:3.11-slim AS runtime

WORKDIR /app

# Install runtime system dependencies only
RUN apt-get update && \
    apt-get install -y --no-install-recommends git curl && \
    rm -rf /var/lib/apt/lists/*

# Create non-root user
RUN groupadd -r deepagent && useradd -r -g deepagent -d /app -s /sbin/nologin deepagent

# Copy installed packages from builder
COPY --from=builder /install /usr/local

# Copy application code
COPY . .

# Change ownership
RUN chown -R deepagent:deepagent /app

# Switch to non-root user
USER deepagent

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD curl -f http://localhost:8000/api/v1/health || exit 1

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
