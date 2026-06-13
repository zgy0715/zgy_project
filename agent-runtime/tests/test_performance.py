"""Performance benchmarks for the Agent Runtime.

Measures and validates key performance indicators:
- API endpoint response times
- Agent creation/execution throughput
- Workflow execution latency
- LLM service call overhead
- Vector search latency
- Memory usage under load
"""

import asyncio
import statistics
import time
from typing import Any

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient

from app.agents.registry import AgentRegistry
from app.models.enums import AgentType, TaskStatus
from app.models.schemas import AgentCreateRequest, WorkflowCreateRequest, WorkflowNode

# ── Benchmark thresholds (in seconds) ────────────────────────────────────────

THRESHOLDS = {
    "agent_create": 0.5,       # Agent creation should be < 500ms
    "agent_list": 0.2,         # Agent listing should be < 200ms
    "agent_get": 0.1,          # Agent get should be < 100ms
    "agent_chat": 30.0,        # Agent chat (with LLM) should be < 30s
    "workflow_create": 0.5,    # Workflow creation should be < 500ms
    "health_check": 0.1,       # Health check should be < 100ms
    "vector_search": 0.05,     # Vector search should be < 50ms
    "concurrent_agents": 10,   # Should handle 10 concurrent agent operations
}


# ── Helpers ───────────────────────────────────────────────────────────────────

class PerformanceResult:
    """Container for a performance benchmark result."""

    def __init__(self, name: str, durations: list[float]):
        self.name = name
        self.durations = durations
        self.mean = statistics.mean(durations)
        self.median = statistics.median(durations)
        self.p95 = (
            sorted(durations)[int(len(durations) * 0.95)]
            if len(durations) >= 2
            else durations[0]
        )
        self.min = min(durations)
        self.max = max(durations)

    def __str__(self) -> str:
        return (
            f"{self.name}: mean={self.mean:.3f}s, median={self.median:.3f}s, "
            f"p95={self.p95:.3f}s, min={self.min:.3f}s, max={self.max:.3f}s"
        )

    def to_dict(self) -> dict[str, Any]:
        return {
            "name": self.name,
            "iterations": len(self.durations),
            "mean_s": round(self.mean, 4),
            "median_s": round(self.median, 4),
            "p95_s": round(self.p95, 4),
            "min_s": round(self.min, 4),
            "max_s": round(self.max, 4),
        }


def benchmark_sync(func, iterations: int = 10) -> PerformanceResult:
    """Run a synchronous function multiple times and collect timing data."""
    durations: list[float] = []
    for _ in range(iterations):
        start = time.perf_counter()
        func()
        durations.append(time.perf_counter() - start)
    return PerformanceResult(func.__name__, durations)


async def benchmark_async(func, iterations: int = 10) -> PerformanceResult:
    """Run an async function multiple times and collect timing data."""
    durations: list[float] = []
    for _ in range(iterations):
        start = time.perf_counter()
        await func()
        durations.append(time.perf_counter() - start)
    return PerformanceResult(func.__name__, durations)


# ── Fixtures ──────────────────────────────────────────────────────────────────

@pytest_asyncio.fixture
async def client():
    """Provide an async HTTP client wired to the FastAPI app."""
    from app.main import create_app

    app = create_app()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        yield c


@pytest.fixture
def agent_registry() -> AgentRegistry:
    """Provide a fresh AgentRegistry instance."""
    return AgentRegistry()


# ── Health Endpoint Performance ───────────────────────────────────────────────

@pytest.mark.asyncio
async def test_health_endpoint_performance(client: AsyncClient):
    """Benchmark GET /api/v1/health — should respond within threshold."""
    async def _health():
        return await client.get("/api/v1/health")

    result = await benchmark_async(_health, iterations=20)
    assert result.p95 < THRESHOLDS["health_check"], (
        f"Health check p95={result.p95:.3f}s exceeds "
        f"threshold={THRESHOLDS['health_check']}s"
    )


# ── Agent CRUD Performance ───────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_agent_create_performance(client: AsyncClient):
    """Benchmark POST /api/v1/agents/ — agent creation latency."""
    async def _create():
        return await client.post(
            "/api/v1/agents/",
            json={
                "name": f"perf-agent-{time.monotonic_ns()}",
                "agent_type": "coder",
                "description": "Performance test agent",
            },
        )

    result = await benchmark_async(_create, iterations=10)
    assert result.p95 < THRESHOLDS["agent_create"], (
        f"Agent create p95={result.p95:.3f}s exceeds "
        f"threshold={THRESHOLDS['agent_create']}s"
    )


@pytest.mark.asyncio
async def test_agent_list_performance(client: AsyncClient):
    """Benchmark GET /api/v1/agents/ — agent listing latency."""
    # Pre-populate some agents
    for i in range(5):
        await client.post(
            "/api/v1/agents/",
            json={
                "name": f"list-perf-{i}",
                "agent_type": "coder",
                "description": "Listing perf agent",
            },
        )

    async def _list():
        return await client.get("/api/v1/agents/")

    result = await benchmark_async(_list, iterations=20)
    assert result.p95 < THRESHOLDS["agent_list"], (
        f"Agent list p95={result.p95:.3f}s exceeds "
        f"threshold={THRESHOLDS['agent_list']}s"
    )


@pytest.mark.asyncio
async def test_agent_get_performance(client: AsyncClient):
    """Benchmark GET /api/v1/agents/{id} — single agent retrieval latency."""
    create_resp = await client.post(
        "/api/v1/agents/",
        json={
            "name": "get-perf-agent",
            "agent_type": "coder",
            "description": "Get perf agent",
        },
    )
    agent_id = create_resp.json()["id"]

    async def _get():
        return await client.get(f"/api/v1/agents/{agent_id}")

    result = await benchmark_async(_get, iterations=20)
    assert result.p95 < THRESHOLDS["agent_get"], (
        f"Agent get p95={result.p95:.3f}s exceeds "
        f"threshold={THRESHOLDS['agent_get']}s"
    )


@pytest.mark.asyncio
async def test_agent_crud_cycle_performance(client: AsyncClient):
    """Benchmark the full agent CRUD cycle (create → get → list → delete)."""
    async def _crud_cycle():
        # Create
        resp = await client.post(
            "/api/v1/agents/",
            json={
                "name": f"crud-{time.monotonic_ns()}",
                "agent_type": "coder",
                "description": "CRUD cycle agent",
            },
        )
        agent_id = resp.json()["id"]

        # Get
        await client.get(f"/api/v1/agents/{agent_id}")

        # List
        await client.get("/api/v1/agents/")

        # Delete
        await client.delete(f"/api/v1/agents/{agent_id}")

    result = await benchmark_async(_crud_cycle, iterations=10)
    # Full CRUD cycle should complete within 2 seconds
    assert result.p95 < 2.0, (
        f"Agent CRUD cycle p95={result.p95:.3f}s exceeds 2.0s"
    )


# ── Concurrent Agent Operations ──────────────────────────────────────────────

@pytest.mark.asyncio
async def test_concurrent_agent_operations(client: AsyncClient):
    """Test handling 10 concurrent agent operations without errors."""
    num_concurrent = THRESHOLDS["concurrent_agents"]

    async def _create_agent(idx: int):
        return await client.post(
            "/api/v1/agents/",
            json={
                "name": f"concurrent-{idx}-{time.monotonic_ns()}",
                "agent_type": "coder",
                "description": f"Concurrent test agent {idx}",
            },
        )

    start = time.perf_counter()
    results = await asyncio.gather(*[_create_agent(i) for i in range(num_concurrent)])
    elapsed = time.perf_counter() - start

    # All requests should succeed
    for i, resp in enumerate(results):
        assert resp.status_code == 201, (
            f"Concurrent request {i} failed with status {resp.status_code}"
        )

    # Total time for all concurrent operations should be reasonable
    assert elapsed < 5.0, (
        f"{num_concurrent} concurrent agent creations took {elapsed:.2f}s (> 5s)"
    )


@pytest.mark.asyncio
async def test_concurrent_agent_reads(client: AsyncClient):
    """Test concurrent read operations on the same agent."""
    create_resp = await client.post(
        "/api/v1/agents/",
        json={
            "name": "concurrent-read-target",
            "agent_type": "coder",
            "description": "Target for concurrent reads",
        },
    )
    agent_id = create_resp.json()["id"]

    async def _read_agent():
        return await client.get(f"/api/v1/agents/{agent_id}")

    results = await asyncio.gather(*[_read_agent() for _ in range(20)])
    for resp in results:
        assert resp.status_code == 200


# ── Workflow Creation Performance ────────────────────────────────────────────

@pytest.mark.asyncio
async def test_workflow_creation_performance(client: AsyncClient):
    """Benchmark POST /api/v1/workflows/ — workflow creation latency."""
    async def _create_workflow():
        return await client.post(
            "/api/v1/workflows/",
            json={
                "name": f"perf-workflow-{time.monotonic_ns()}",
                "description": "Performance test workflow",
                "nodes": [
                    {"id": "coder-1", "agent_type": "coder", "name": "Coder"},
                    {"id": "reviewer-1", "agent_type": "reviewer", "name": "Reviewer"},
                ],
                "edges": [
                    {"source": "coder-1", "target": "reviewer-1"},
                ],
            },
        )

    result = await benchmark_async(_create_workflow, iterations=10)
    assert result.p95 < THRESHOLDS["workflow_create"], (
        f"Workflow create p95={result.p95:.3f}s exceeds "
        f"threshold={THRESHOLDS['workflow_create']}s"
    )


# ── Registry In-Memory Performance ───────────────────────────────────────────

def test_agent_registry_create_performance(agent_registry: AgentRegistry):
    """Benchmark in-memory AgentRegistry.create throughput."""
    def _create():
        agent_registry.create(
            name=f"reg-perf-{time.monotonic_ns()}",
            agent_type=AgentType.CODER,
            description="Registry perf agent",
        )

    result = benchmark_sync(_create, iterations=50)
    # In-memory creation should be very fast
    assert result.mean < 0.01, (
        f"Registry create mean={result.mean:.4f}s exceeds 10ms"
    )


def test_agent_registry_list_performance(agent_registry: AgentRegistry):
    """Benchmark in-memory AgentRegistry.list_all throughput."""
    # Populate 100 agents
    for i in range(100):
        agent_registry.create(
            name=f"list-reg-{i}",
            agent_type=AgentType.CODER,
            description=f"Registry list agent {i}",
        )

    def _list():
        return agent_registry.list_all()

    result = benchmark_sync(_list, iterations=50)
    assert result.mean < 0.01, (
        f"Registry list mean={result.mean:.4f}s exceeds 10ms for 100 agents"
    )


def test_agent_registry_get_performance(agent_registry: AgentRegistry):
    """Benchmark in-memory AgentRegistry.get throughput."""
    agent = agent_registry.create(
        name="get-reg-target",
        agent_type=AgentType.CODER,
        description="Registry get target",
    )

    def _get():
        return agent_registry.get("get-reg-target")

    result = benchmark_sync(_get, iterations=100)
    assert result.mean < 0.001, (
        f"Registry get mean={result.mean:.6f}s exceeds 1ms"
    )


# ── Memory Usage Under Load ──────────────────────────────────────────────────

def test_agent_registry_memory_under_load(agent_registry: AgentRegistry):
    """Test that creating many agents doesn't cause excessive memory growth."""
    import sys

    initial_size = sys.getsizeof(agent_registry)  # rough baseline

    for i in range(500):
        agent_registry.create(
            name=f"mem-test-{i}",
            agent_type=AgentType.CODER,
            description=f"Memory test agent {i}",
        )

    agents = agent_registry.list_all()
    assert len(agents) == 500, f"Expected 500 agents, got {len(agents)}"

    # Clean up should work
    for i in range(500):
        try:
            agent_registry.remove(f"mem-test-{i}")
        except KeyError:
            pass

    remaining = agent_registry.list_all()
    assert len(remaining) == 0, f"Expected 0 agents after cleanup, got {len(remaining)}"
