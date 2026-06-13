# End-to-end integration test runner for DeepAgent (Windows PowerShell)
# Runs tests across all modules: Vector Engine, Agent Runtime, API Gateway, Frontend

$ErrorActionPreference = "Continue"
$OverallStatus = 0
$FailedModules = @()

Write-Host "=========================================" -ForegroundColor Cyan
Write-Host "DeepAgent E2E Integration Test Suite" -ForegroundColor Cyan
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host ""

$ProjectRoot = Split-Path -Parent $PSScriptRoot
Write-Host "Project root: $ProjectRoot"
Write-Host ""

# -----------------------------------------------
# 1. Vector Engine Tests (C++ / CTest)
# -----------------------------------------------
Write-Host "[1/4] Running Vector Engine tests..." -ForegroundColor Blue
Write-Host "-----------------------------------------"

$vectorBuildDir = Join-Path $ProjectRoot "vector-engine\build"
if (Test-Path $vectorBuildDir) {
    Push-Location $vectorBuildDir
    try {
        $ctestResult = ctest --output-on-failure 2>&1
        if ($LASTEXITCODE -eq 0) {
            Write-Host "[1/4] Vector Engine tests PASSED" -ForegroundColor Green
        } else {
            Write-Host "[1/4] Vector Engine tests FAILED" -ForegroundColor Red
            Write-Host $ctestResult
            $OverallStatus = 1
            $FailedModules += "vector-engine"
        }
    } finally {
        Pop-Location
    }
} else {
    Write-Host "[1/4] Vector Engine build directory not found. Skipping." -ForegroundColor Yellow
    Write-Host "       Run cmake and build first: cd vector-engine; mkdir build; cd build; cmake ..; make" -ForegroundColor Yellow
}

Write-Host ""

# -----------------------------------------------
# 2. Agent Runtime Tests (Python / Pytest)
# -----------------------------------------------
Write-Host "[2/4] Running Agent Runtime tests..." -ForegroundColor Blue
Write-Host "-----------------------------------------"

$agentRuntimeDir = Join-Path $ProjectRoot "agent-runtime"
if (Test-Path $agentRuntimeDir) {
    Push-Location $agentRuntimeDir
    try {
        $pytestAvailable = $null -ne (Get-Command python -ErrorAction SilentlyContinue)
        if ($pytestAvailable) {
            $pytestCheck = python -m pytest --version 2>&1
            if ($LASTEXITCODE -eq 0) {
                $testResult = python -m pytest tests/test_integration.py tests/test_api_contracts.py -v --tb=short -m "not slow" 2>&1
                if ($LASTEXITCODE -eq 0) {
                    Write-Host "[2/4] Agent Runtime tests PASSED" -ForegroundColor Green
                } else {
                    Write-Host "[2/4] Agent Runtime tests FAILED" -ForegroundColor Red
                    Write-Host $testResult
                    $OverallStatus = 1
                    $FailedModules += "agent-runtime"
                }
            } else {
                Write-Host "[2/4] pytest not installed. Install with: pip install pytest pytest-asyncio" -ForegroundColor Yellow
                $OverallStatus = 1
                $FailedModules += "agent-runtime(no-pytest)"
            }
        } else {
            Write-Host "[2/4] Python not found. Skipping." -ForegroundColor Yellow
            $OverallStatus = 1
            $FailedModules += "agent-runtime(no-python)"
        }
    } finally {
        Pop-Location
    }
} else {
    Write-Host "[2/4] Agent Runtime directory not found. Skipping." -ForegroundColor Yellow
}

Write-Host ""

# -----------------------------------------------
# 3. API Gateway Tests (Java / Maven)
# -----------------------------------------------
Write-Host "[3/4] Running API Gateway tests..." -ForegroundColor Blue
Write-Host "-----------------------------------------"

$apiGatewayDir = Join-Path $ProjectRoot "api-gateway"
if (Test-Path $apiGatewayDir) {
    Push-Location $apiGatewayDir
    try {
        $mvnCmd = $null
        $mvnwPath = Join-Path $apiGatewayDir "mvnw.cmd"
        if (Test-Path $mvnwPath) {
            $mvnCmd = ".\mvnw.cmd"
        } elseif ($null -ne (Get-Command mvn -ErrorAction SilentlyContinue)) {
            $mvnCmd = "mvn"
        }

        if ($null -ne $mvnCmd) {
            $mvnResult = & $mvnCmd test "-Dtest=com.deepagent.**.*Test" --no-transfer-progress 2>&1
            if ($LASTEXITCODE -eq 0) {
                Write-Host "[3/4] API Gateway tests PASSED" -ForegroundColor Green
            } else {
                Write-Host "[3/4] API Gateway tests FAILED" -ForegroundColor Red
                Write-Host $mvnResult
                $OverallStatus = 1
                $FailedModules += "api-gateway"
            }
        } else {
            Write-Host "[3/4] Maven not found. Install Maven or use the wrapper." -ForegroundColor Yellow
            $OverallStatus = 1
            $FailedModules += "api-gateway(no-maven)"
        }
    } finally {
        Pop-Location
    }
} else {
    Write-Host "[3/4] API Gateway directory not found. Skipping." -ForegroundColor Yellow
}

Write-Host ""

# -----------------------------------------------
# 4. Frontend Tests (TypeScript / Next.js)
# -----------------------------------------------
Write-Host "[4/4] Running Frontend type checks and lint..." -ForegroundColor Blue
Write-Host "-----------------------------------------"

$frontendDir = Join-Path $ProjectRoot "frontend"
if (Test-Path $frontendDir) {
    Push-Location $frontendDir
    try {
        # Check if node_modules exists
        if (-not (Test-Path "node_modules")) {
            Write-Host "Installing frontend dependencies..."
            npm install
        }

        $frontendPassed = $true

        # Type check
        Write-Host "  Running type check..."
        npm run type-check 2>&1 | Out-Null
        if ($LASTEXITCODE -ne 0) {
            Write-Host "  Type check FAILED" -ForegroundColor Red
            $frontendPassed = $false
        }

        # Lint
        Write-Host "  Running lint..."
        npm run lint 2>&1 | Out-Null
        if ($LASTEXITCODE -ne 0) {
            Write-Host "  Lint FAILED" -ForegroundColor Red
            $frontendPassed = $false
        }

        # Run contract tests if jest is configured
        try {
            npm test 2>&1 | Out-Null
            if ($LASTEXITCODE -eq 0) {
                Write-Host "  Contract tests passed"
            }
        } catch {
            Write-Host "  No test script configured or tests not available" -ForegroundColor Yellow
        }

        if ($frontendPassed) {
            Write-Host "[4/4] Frontend checks PASSED" -ForegroundColor Green
        } else {
            Write-Host "[4/4] Frontend checks FAILED" -ForegroundColor Red
            $OverallStatus = 1
            $FailedModules += "frontend"
        }
    } finally {
        Pop-Location
    }
} else {
    Write-Host "[4/4] Frontend directory not found. Skipping." -ForegroundColor Yellow
}

Write-Host ""

# -----------------------------------------------
# Summary
# -----------------------------------------------
Write-Host "=========================================" -ForegroundColor Cyan
if ($OverallStatus -eq 0) {
    Write-Host "All E2E tests completed successfully!" -ForegroundColor Green
} else {
    Write-Host "Some E2E tests FAILED!" -ForegroundColor Red
    Write-Host "Failed modules: $($FailedModules -join ', ')" -ForegroundColor Red
}
Write-Host "=========================================" -ForegroundColor Cyan

exit $OverallStatus
