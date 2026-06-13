"""Performance benchmark report generator.

Runs all performance tests and generates a comprehensive markdown report
with key metrics, comparisons against thresholds, and recommendations.
"""

import json
import os
import re
import subprocess
import sys
from datetime import datetime
from pathlib import Path
from typing import Any

# ── Project root detection ────────────────────────────────────────────────────

PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
AGENT_RUNTIME_DIR = PROJECT_ROOT / "agent-runtime"
VECTOR_ENGINE_DIR = PROJECT_ROOT / "vector-engine"
API_GATEWAY_DIR = PROJECT_ROOT / "api-gateway"

# ── Performance thresholds ────────────────────────────────────────────────────

THRESHOLDS = {
    "agent_create": {"limit": 0.5, "unit": "s", "description": "Agent creation"},
    "agent_list": {"limit": 0.2, "unit": "s", "description": "Agent listing"},
    "agent_get": {"limit": 0.1, "unit": "s", "description": "Agent retrieval"},
    "agent_chat": {"limit": 30.0, "unit": "s", "description": "Agent chat (with LLM)"},
    "workflow_create": {"limit": 0.5, "unit": "s", "description": "Workflow creation"},
    "health_check": {"limit": 0.1, "unit": "s", "description": "Health check"},
    "vector_search": {"limit": 0.05, "unit": "s", "description": "Vector search"},
    "concurrent_agents": {"limit": 10, "unit": "ops", "description": "Concurrent agent ops"},
    "jwt_generation": {"limit": 5.0, "unit": "ms", "description": "JWT token generation"},
    "jwt_validation": {"limit": 2.0, "unit": "ms", "description": "JWT token validation"},
    "hnsw_build_1k": {"limit": 5000.0, "unit": "ms", "description": "HNSW build 1K vectors"},
    "hnsw_search": {"limit": 10.0, "unit": "ms", "description": "HNSW search"},
    "hnsw_insert": {"limit": 1.0, "unit": "ms", "description": "HNSW single insert"},
    "embed_batch_100": {"limit": 100.0, "unit": "ms", "description": "Batch embed 100 texts"},
}


# ── Test runners ──────────────────────────────────────────────────────────────

def run_agent_runtime_tests() -> dict[str, Any]:
    """Run Agent Runtime performance tests and collect results."""
    results: dict[str, Any] = {
        "component": "Agent Runtime (Python/FastAPI)",
        "status": "skipped",
        "tests": [],
        "raw_output": "",
    }

    try:
        proc = subprocess.run(
            [sys.executable, "-m", "pytest",
             "tests/test_performance.py",
             "-v", "--tb=short", "-s"],
            capture_output=True,
            text=True,
            cwd=str(AGENT_RUNTIME_DIR),
            timeout=300,
            env={**os.environ, "PYTHONPATH": str(AGENT_RUNTIME_DIR)},
        )
        results["raw_output"] = proc.stdout + proc.stderr
        results["status"] = "passed" if proc.returncode == 0 else "failed"

        # Parse test results from pytest output
        for line in proc.stdout.splitlines():
            if "PASSED" in line or "FAILED" in line:
                test_name = line.strip()
                results["tests"].append({
                    "name": test_name,
                    "status": "PASSED" if "PASSED" in test_name else "FAILED",
                })

    except subprocess.TimeoutExpired:
        results["status"] = "timeout"
    except FileNotFoundError:
        results["status"] = "not_available"
    except Exception as e:
        results["status"] = "error"
        results["error"] = str(e)

    return results


def run_vector_engine_tests() -> dict[str, Any]:
    """Run Vector Engine performance tests and collect results."""
    results: dict[str, Any] = {
        "component": "Vector Engine (C++)",
        "status": "skipped",
        "tests": [],
        "raw_output": "",
    }

    build_dir = VECTOR_ENGINE_DIR / "build"
    if not build_dir.exists():
        results["status"] = "build_required"
        results["note"] = "Run cmake build first to generate test executables"
        return results

    try:
        # Try to find the test executable
        test_executable = None
        for candidate in ["test_performance", "vector_engine_tests"]:
            for ext in ["", ".exe"]:
                path = build_dir / candidate / (candidate + ext)
                if path.exists():
                    test_executable = str(path)
                    break
            if test_executable:
                break

        if not test_executable:
            # Try ctest
            proc = subprocess.run(
                ["ctest", "--output-on-failure", "-R", "performance"],
                capture_output=True,
                text=True,
                cwd=str(build_dir),
                timeout=300,
            )
        else:
            proc = subprocess.run(
                [test_executable, "--gtest_filter=*Performance*"],
                capture_output=True,
                text=True,
                timeout=300,
            )

        results["raw_output"] = proc.stdout + proc.stderr
        results["status"] = "passed" if proc.returncode == 0 else "failed"

        # Parse gtest output
        for line in proc.stdout.splitlines():
            if "[  PASSED  ]" in line or "[  FAILED  ]" in line:
                results["tests"].append({
                    "name": line.strip(),
                    "status": "PASSED" if "[  PASSED  ]" in line else "FAILED",
                })

    except subprocess.TimeoutExpired:
        results["status"] = "timeout"
    except FileNotFoundError:
        results["status"] = "not_available"
    except Exception as e:
        results["status"] = "error"
        results["error"] = str(e)

    return results


def run_api_gateway_tests() -> dict[str, Any]:
    """Run API Gateway performance tests and collect results."""
    results: dict[str, Any] = {
        "component": "API Gateway (Java/Spring Boot)",
        "status": "skipped",
        "tests": [],
        "raw_output": "",
    }

    try:
        proc = subprocess.run(
            ["mvn", "test",
             "-Dtest=com.deepagent.performance.PerformanceBenchmarkTest",
             "-pl", "."],
            capture_output=True,
            text=True,
            cwd=str(API_GATEWAY_DIR),
            timeout=600,
        )
        results["raw_output"] = proc.stdout + proc.stderr
        results["status"] = "passed" if proc.returncode == 0 else "failed"

        # Parse Maven surefire output
        for line in proc.stdout.splitlines():
            if "Tests run:" in line:
                results["tests"].append({
                    "name": "Maven test summary",
                    "detail": line.strip(),
                })

    except subprocess.TimeoutExpired:
        results["status"] = "timeout"
    except FileNotFoundError:
        results["status"] = "not_available"
    except Exception as e:
        results["status"] = "error"
        results["error"] = str(e)

    return results


# ── Report generation ─────────────────────────────────────────────────────────

def generate_status_badge(status: str) -> str:
    """Generate a markdown status badge."""
    badges = {
        "passed": "![PASSED](https://img.shields.io/badge/PASSED-green)",
        "failed": "![FAILED](https://img.shields.io/badge/FAILED-red)",
        "timeout": "![TIMEOUT](https://img.shields.io/badge/TIMEOUT-orange)",
        "skipped": "![SKIPPED](https://img.shields.io/badge/SKIPPED-gray)",
        "not_available": "![N/A](https://img.shields.io/badge/N/A-lightgray)",
        "build_required": "![BUILD_REQUIRED](https://img.shields.io/badge/BUILD_REQUIRED-yellow)",
        "error": "![ERROR](https://img.shields.io/badge/ERROR-red)",
    }
    return badges.get(status, f"![{status}](https://img.shields.io/badge/{status}-blue)")


def generate_thresholds_table() -> str:
    """Generate a markdown table of performance thresholds."""
    lines = [
        "| Metric | Threshold | Unit | Description |",
        "|--------|-----------|------|-------------|",
    ]
    for key, val in THRESHOLDS.items():
        lines.append(f"| `{key}` | {val['limit']} | {val['unit']} | {val['description']} |")
    return "\n".join(lines)


def generate_component_section(results: dict[str, Any]) -> str:
    """Generate a markdown section for a component's test results."""
    lines = [
        f"### {results['component']}",
        "",
        f"**Status:** {generate_status_badge(results['status'])}",
        "",
    ]

    if results.get("note"):
        lines.append(f"> **Note:** {results['note']}")
        lines.append("")

    if results.get("error"):
        lines.append(f"> **Error:** {results['error']}")
        lines.append("")

    if results["tests"]:
        lines.append("| Test | Status |")
        lines.append("|------|--------|")
        for test in results["tests"]:
            name = test.get("name", "Unknown")
            status = test.get("status", "")
            detail = test.get("detail", "")
            if detail:
                lines.append(f"| {name} | {detail} |")
            else:
                lines.append(f"| {name} | {status} |")
        lines.append("")
    else:
        lines.append("*No test results captured.*")
        lines.append("")

    return "\n".join(lines)


def generate_recommendations(all_results: list[dict[str, Any]]) -> str:
    """Generate performance recommendations based on test results."""
    recommendations: list[str] = []

    for result in all_results:
        if result["status"] == "failed":
            recommendations.append(
                f"- **{result['component']}**: Performance tests failed. "
                "Review the raw output for specific threshold violations."
            )
        elif result["status"] == "timeout":
            recommendations.append(
                f"- **{result['component']}**: Tests timed out. "
                "Consider increasing timeout thresholds or investigating slow operations."
            )
        elif result["status"] == "build_required":
            recommendations.append(
                f"- **{result['component']}**: Build required before running tests. "
                "Run cmake build to compile the test executables."
            )
        elif result["status"] == "not_available":
            recommendations.append(
                f"- **{result['component']}**: Test runner not found. "
                "Ensure the required build tools are installed."
            )

    # General recommendations
    recommendations.extend([
        "",
        "### General Recommendations",
        "",
        "1. **Enable caching middleware** (`CacheMiddleware`) for GET endpoints "
        "to reduce backend load and improve p95 latency.",
        "2. **Use parallel batch embedding** in the Vector Engine to improve "
        "throughput for bulk indexing operations.",
        "3. **Monitor p95 latency** in production — mean latency can mask tail "
        "latency issues that affect user experience.",
        "4. **Run benchmarks regularly** (e.g., in CI/CD) to catch performance "
        "regressions early.",
        "5. **Profile before optimizing** — use the benchmark data to identify "
        "the most impactful bottlenecks.",
    ])

    return "\n".join(recommendations)


def generate_report(all_results: list[dict[str, Any]]) -> str:
    """Generate the full markdown performance report."""
    now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    sections = [
        "# DeepAgent Performance Benchmark Report",
        "",
        f"**Generated:** {now}",
        f"**Project Root:** `{PROJECT_ROOT}`",
        "",
        "---",
        "",
        "## 1. Executive Summary",
        "",
    ]

    # Summary table
    sections.append("| Component | Status |")
    sections.append("|-----------|--------|")
    for result in all_results:
        badge = generate_status_badge(result["status"])
        sections.append(f"| {result['component']} | {badge} |")
    sections.append("")

    # Component details
    sections.append("---")
    sections.append("")
    sections.append("## 2. Agent Runtime Performance")
    sections.append("")
    for r in all_results:
        if "Agent Runtime" in r["component"]:
            sections.append(generate_component_section(r))

    sections.append("---")
    sections.append("")
    sections.append("## 3. Vector Engine Performance")
    sections.append("")
    for r in all_results:
        if "Vector Engine" in r["component"]:
            sections.append(generate_component_section(r))

    sections.append("---")
    sections.append("")
    sections.append("## 4. API Gateway Performance")
    sections.append("")
    for r in all_results:
        if "API Gateway" in r["component"]:
            sections.append(generate_component_section(r))

    # Thresholds
    sections.append("---")
    sections.append("")
    sections.append("## 5. Performance Thresholds")
    sections.append("")
    sections.append(generate_thresholds_table())
    sections.append("")

    # Recommendations
    sections.append("---")
    sections.append("")
    sections.append("## 6. Recommendations")
    sections.append("")
    sections.append(generate_recommendations(all_results))
    sections.append("")

    # Footer
    sections.append("---")
    sections.append("")
    sections.append("*Report generated by `agent-runtime/tests/generate_perf_report.py`*")

    return "\n".join(sections)


# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    """Run all benchmarks and generate the report."""
    print("=" * 60)
    print("DeepAgent Performance Benchmark Report Generator")
    print("=" * 60)
    print()

    all_results: list[dict[str, Any]] = []

    # Run Agent Runtime tests
    print("[1/3] Running Agent Runtime performance tests...")
    agent_results = run_agent_runtime_tests()
    all_results.append(agent_results)
    print(f"  → Status: {agent_results['status']}")

    # Run Vector Engine tests
    print("[2/3] Running Vector Engine performance tests...")
    vector_results = run_vector_engine_tests()
    all_results.append(vector_results)
    print(f"  → Status: {vector_results['status']}")

    # Run API Gateway tests
    print("[3/3] Running API Gateway performance tests...")
    gateway_results = run_api_gateway_tests()
    all_results.append(gateway_results)
    print(f"  → Status: {gateway_results['status']}")

    # Generate report
    print()
    print("Generating report...")
    report = generate_report(all_results)

    # Write report
    report_path = AGENT_RUNTIME_DIR / "tests" / "performance_report.md"
    report_path.write_text(report, encoding="utf-8")
    print(f"Report written to: {report_path}")

    # Also print to stdout
    print()
    print(report)

    # Exit with non-zero if any test failed
    any_failed = any(r["status"] in ("failed", "timeout", "error") for r in all_results)
    sys.exit(1 if any_failed else 0)


if __name__ == "__main__":
    main()
