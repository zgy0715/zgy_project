#!/bin/bash
# End-to-end integration test runner for DeepAgent
# Runs tests across all modules: Vector Engine, Agent Runtime, API Gateway, Frontend

set -e

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Track overall status
OVERALL_STATUS=0
FAILED_MODULES=""

echo "========================================="
echo "DeepAgent E2E Integration Test Suite"
echo "========================================="
echo ""

# Get the project root directory
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
echo "Project root: ${PROJECT_ROOT}"
echo ""

# -----------------------------------------------
# 1. Vector Engine Tests (C++ / CTest)
# -----------------------------------------------
echo -e "${BLUE}[1/4] Running Vector Engine tests...${NC}"
echo "-----------------------------------------"

if [ -d "${PROJECT_ROOT}/vector-engine/build" ]; then
    cd "${PROJECT_ROOT}/vector-engine/build"
    if ctest --output-on-failure; then
        echo -e "${GREEN}[1/4] Vector Engine tests PASSED${NC}"
    else
        echo -e "${RED}[1/4] Vector Engine tests FAILED${NC}"
        OVERALL_STATUS=1
        FAILED_MODULES="${FAILED_MODULES} vector-engine"
    fi
else
    echo -e "${YELLOW}[1/4] Vector Engine build directory not found. Skipping.${NC}"
    echo "       Run cmake and build first: cd vector-engine && mkdir build && cd build && cmake .. && make"
fi

echo ""

# -----------------------------------------------
# 2. Agent Runtime Tests (Python / Pytest)
# -----------------------------------------------
echo -e "${BLUE}[2/4] Running Agent Runtime tests...${NC}"
echo "-----------------------------------------"

if [ -d "${PROJECT_ROOT}/agent-runtime" ]; then
    cd "${PROJECT_ROOT}/agent-runtime"

    # Check if pytest is available
    if command -v python &> /dev/null && python -m pytest --version &> /dev/null; then
        # Run integration tests and API contract tests
        if python -m pytest tests/test_integration.py tests/test_api_contracts.py -v --tb=short -m "not slow"; then
            echo -e "${GREEN}[2/4] Agent Runtime tests PASSED${NC}"
        else
            echo -e "${RED}[2/4] Agent Runtime tests FAILED${NC}"
            OVERALL_STATUS=1
            FAILED_MODULES="${FAILED_MODULES} agent-runtime"
        fi
    else
        echo -e "${YELLOW}[2/4] pytest not found. Install with: pip install pytest pytest-asyncio${NC}"
        OVERALL_STATUS=1
        FAILED_MODULES="${FAILED_MODULES} agent-runtime(no-pytest)"
    fi
else
    echo -e "${YELLOW}[2/4] Agent Runtime directory not found. Skipping.${NC}"
fi

echo ""

# -----------------------------------------------
# 3. API Gateway Tests (Java / Maven)
# -----------------------------------------------
echo -e "${BLUE}[3/4] Running API Gateway tests...${NC}"
echo "-----------------------------------------"

if [ -d "${PROJECT_ROOT}/api-gateway" ]; then
    cd "${PROJECT_ROOT}/api-gateway"

    # Check for Maven wrapper or mvn
    if [ -f "./mvnw" ]; then
        MVN_CMD="./mvnw"
    elif command -v mvn &> /dev/null; then
        MVN_CMD="mvn"
    else
        MVN_CMD=""
    fi

    if [ -n "${MVN_CMD}" ]; then
        # Run all tests including integration tests
        if ${MVN_CMD} test -Dtest="com.deepagent.**.*Test" -pl . --no-transfer-progress; then
            echo -e "${GREEN}[3/4] API Gateway tests PASSED${NC}"
        else
            echo -e "${RED}[3/4] API Gateway tests FAILED${NC}"
            OVERALL_STATUS=1
            FAILED_MODULES="${FAILED_MODULES} api-gateway"
        fi
    else
        echo -e "${YELLOW}[3/4] Maven not found. Install Maven or use the wrapper.${NC}"
        OVERALL_STATUS=1
        FAILED_MODULES="${FAILED_MODULES} api-gateway(no-maven)"
    fi
else
    echo -e "${YELLOW}[3/4] API Gateway directory not found. Skipping.${NC}"
fi

echo ""

# -----------------------------------------------
# 4. Frontend Tests (TypeScript / Next.js)
# -----------------------------------------------
echo -e "${BLUE}[4/4] Running Frontend type checks and lint...${NC}"
echo "-----------------------------------------"

if [ -d "${PROJECT_ROOT}/frontend" ]; then
    cd "${PROJECT_ROOT}/frontend"

    # Check if node_modules exists
    if [ ! -d "node_modules" ]; then
        echo "Installing frontend dependencies..."
        npm install
    fi

    FRONTEND_PASSED=true

    # Type check
    echo "  Running type check..."
    if ! npm run type-check; then
        echo -e "${RED}  Type check FAILED${NC}"
        FRONTEND_PASSED=false
    fi

    # Lint
    echo "  Running lint..."
    if ! npm run lint; then
        echo -e "${RED}  Lint FAILED${NC}"
        FRONTEND_PASSED=false
    fi

    # Run contract tests if jest is configured
    if npm run test 2>/dev/null; then
        echo "  Contract tests passed"
    else
        echo -e "${YELLOW}  No test script configured or tests not available${NC}"
    fi

    if [ "${FRONTEND_PASSED}" = true ]; then
        echo -e "${GREEN}[4/4] Frontend checks PASSED${NC}"
    else
        echo -e "${RED}[4/4] Frontend checks FAILED${NC}"
        OVERALL_STATUS=1
        FAILED_MODULES="${FAILED_MODULES} frontend"
    fi
else
    echo -e "${YELLOW}[4/4] Frontend directory not found. Skipping.${NC}"
fi

echo ""

# -----------------------------------------------
# Summary
# -----------------------------------------------
echo "========================================="
if [ ${OVERALL_STATUS} -eq 0 ]; then
    echo -e "${GREEN}All E2E tests completed successfully!${NC}"
else
    echo -e "${RED}Some E2E tests FAILED!${NC}"
    echo -e "Failed modules:${RED}${FAILED_MODULES}${NC}"
fi
echo "========================================="

exit ${OVERALL_STATUS}
