package com.deepagent.common.exception;

import com.deepagent.common.response.ApiResponse;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.servlet.resource.NoResourceFoundException;

import java.util.stream.Collectors;

/**
 * Global exception handler for REST controllers.
 *
 * <p>Provides centralized exception handling across all controllers,
 * converting exceptions into standardized {@link ApiResponse} format
 * with appropriate HTTP status codes.</p>
 *
 * <p>Handled exception types:</p>
 * <ul>
 *   <li>{@link BusinessException} - 400 Bad Request</li>
 *   <li>{@link MethodArgumentNotValidException} - 400 Bad Request (validation errors)</li>
 *   <li>{@link BadCredentialsException} - 401 Unauthorized</li>
 *   <li>{@link AccessDeniedException} - 403 Forbidden</li>
 *   <li>{@link NoResourceFoundException} - 404 Not Found</li>
 *   <li>{@link Exception} - 500 Internal Server Error (catch-all)</li>
 * </ul>
 */
@Slf4j
@RestControllerAdvice
public class GlobalExceptionHandler {

    /**
     * Handles BusinessException with a 400 status.
     *
     * @param e the business exception
     * @return error response with 400 status
     */
    @ExceptionHandler(BusinessException.class)
    public ResponseEntity<ApiResponse<Void>> handleBusinessException(BusinessException e) {
        log.warn("Business exception: {}", e.getMessage());
        return ResponseEntity.badRequest()
                .body(ApiResponse.error(e.getCode(), e.getMessage()));
    }

    /**
     * Handles validation errors with a 400 status.
     *
     * @param e the validation exception
     * @return error response with field-level error details
     */
    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ApiResponse<Void>> handleValidationException(
            MethodArgumentNotValidException e) {
        var errors = e.getBindingResult().getFieldErrors().stream()
                .map(error -> error.getField() + ": " + error.getDefaultMessage())
                .collect(Collectors.joining("; "));

        log.warn("Validation error: {}", errors);
        return ResponseEntity.badRequest()
                .body(ApiResponse.error("VALIDATION_ERROR", errors));
    }

    /**
     * Handles authentication errors with a 401 status.
     *
     * @param e the bad credentials exception
     * @return error response with 401 status
     */
    @ExceptionHandler(BadCredentialsException.class)
    public ResponseEntity<ApiResponse<Void>> handleBadCredentialsException(
            BadCredentialsException e) {
        log.warn("Authentication failed: {}", e.getMessage());
        return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                .body(ApiResponse.error("AUTHENTICATION_FAILED", "Invalid credentials"));
    }

    /**
     * Handles access denied errors with a 403 status.
     *
     * @param e the access denied exception
     * @return error response with 403 status
     */
    @ExceptionHandler(AccessDeniedException.class)
    public ResponseEntity<ApiResponse<Void>> handleAccessDeniedException(
            AccessDeniedException e) {
        log.warn("Access denied: {}", e.getMessage());
        return ResponseEntity.status(HttpStatus.FORBIDDEN)
                .body(ApiResponse.error("ACCESS_DENIED", "You do not have permission to access this resource"));
    }

    /**
     * Handles resource not found errors with a 404 status.
     *
     * @param e the no resource found exception
     * @return error response with 404 status
     */
    @ExceptionHandler(NoResourceFoundException.class)
    public ResponseEntity<ApiResponse<Void>> handleNoResourceFoundException(
            NoResourceFoundException e) {
        log.warn("Resource not found: {}", e.getMessage());
        return ResponseEntity.status(HttpStatus.NOT_FOUND)
                .body(ApiResponse.error("NOT_FOUND", "Resource not found"));
    }

    /**
     * Handles all unhandled exceptions with a 500 status.
     *
     * @param e the unexpected exception
     * @return error response with 500 status
     */
    @ExceptionHandler(Exception.class)
    public ResponseEntity<ApiResponse<Void>> handleGenericException(Exception e) {
        log.error("Unexpected error: {}", e.getMessage(), e);
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(ApiResponse.error("INTERNAL_ERROR", "An unexpected error occurred"));
    }
}
