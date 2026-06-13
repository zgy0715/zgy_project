"""Global exception handler middleware for consistent error responses."""

import logging
import traceback

from fastapi import FastAPI, Request, status
from fastapi.responses import JSONResponse
from pydantic import ValidationError

logger = logging.getLogger(__name__)


class AgentRuntimeError(Exception):
    """Base exception for Agent Runtime errors."""

    def __init__(self, message: str, code: str = "RUNTIME_ERROR") -> None:
        self.message = message
        self.code = code
        super().__init__(message)


class AgentNotFoundError(AgentRuntimeError):
    """Raised when an agent is not found."""

    def __init__(self, agent_id: str) -> None:
        super().__init__(
            message=f"Agent '{agent_id}' not found",
            code="AGENT_NOT_FOUND",
        )


class WorkflowNotFoundError(AgentRuntimeError):
    """Raised when a workflow is not found."""

    def __init__(self, workflow_id: str) -> None:
        super().__init__(
            message=f"Workflow '{workflow_id}' not found",
            code="WORKFLOW_NOT_FOUND",
        )


class LLMServiceError(AgentRuntimeError):
    """Raised when LLM service call fails."""

    def __init__(self, message: str) -> None:
        super().__init__(message=message, code="LLM_SERVICE_ERROR")


class ToolExecutionError(AgentRuntimeError):
    """Raised when a tool execution fails."""

    def __init__(self, tool_name: str, message: str) -> None:
        super().__init__(
            message=f"Tool '{tool_name}' execution failed: {message}",
            code="TOOL_EXECUTION_ERROR",
        )


def register_error_handlers(app: FastAPI) -> None:
    """Register global exception handlers on the FastAPI application.

    Args:
        app: The FastAPI application instance.
    """

    @app.exception_handler(AgentRuntimeError)
    async def agent_runtime_error_handler(
        request: Request, exc: AgentRuntimeError
    ) -> JSONResponse:
        """Handle AgentRuntimeError and its subclasses."""
        status_code = status.HTTP_400_BAD_REQUEST
        if isinstance(exc, (AgentNotFoundError, WorkflowNotFoundError)):
            status_code = status.HTTP_404_NOT_FOUND
        elif isinstance(exc, LLMServiceError):
            status_code = status.HTTP_502_BAD_GATEWAY

        logger.warning("AgentRuntimeError: %s (%s)", exc.message, exc.code)

        return JSONResponse(
            status_code=status_code,
            content={
                "error": {
                    "code": exc.code,
                    "message": exc.message,
                }
            },
        )

    @app.exception_handler(ValidationError)
    async def validation_error_handler(
        request: Request, exc: ValidationError
    ) -> JSONResponse:
        """Handle Pydantic validation errors."""
        logger.warning("Validation error: %s", str(exc))

        return JSONResponse(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            content={
                "error": {
                    "code": "VALIDATION_ERROR",
                    "message": "Request validation failed",
                    "details": exc.errors(),
                }
            },
        )

    @app.exception_handler(Exception)
    async def generic_error_handler(
        request: Request, exc: Exception
    ) -> JSONResponse:
        """Handle all unhandled exceptions."""
        logger.error(
            "Unhandled exception: %s\n%s",
            str(exc),
            traceback.format_exc(),
        )

        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={
                "error": {
                    "code": "INTERNAL_ERROR",
                    "message": "An unexpected error occurred",
                }
            },
        )
