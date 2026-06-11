package com.deepagent.common.response;

import com.fasterxml.jackson.annotation.JsonInclude;

import java.time.LocalDateTime;

/**
 * Unified API response wrapper for all REST endpoints.
 *
 * <p>Provides a consistent response structure across all API endpoints:</p>
 * <pre>
 * {
 *   "success": true,
 *   "code": "SUCCESS",
 *   "message": "Operation completed",
 *   "data": {...},
 *   "timestamp": "2024-01-01T00:00:00"
 * }
 * </pre>
 *
 * @param <T> the type of the response data
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record ApiResponse<T>(

        boolean success,
        String code,
        String message,
        T data,
        LocalDateTime timestamp

) {

    /**
     * Creates a successful response with data.
     *
     * @param data the response data
     * @param <T>  the data type
     * @return a success ApiResponse
     */
    public static <T> ApiResponse<T> success(T data) {
        return new ApiResponse<>(true, "SUCCESS", "Operation completed", data, LocalDateTime.now());
    }

    /**
     * Creates a successful response with data and a custom message.
     *
     * @param data    the response data
     * @param message the success message
     * @param <T>     the data type
     * @return a success ApiResponse
     */
    public static <T> ApiResponse<T> success(T data, String message) {
        return new ApiResponse<>(true, "SUCCESS", message, data, LocalDateTime.now());
    }

    /**
     * Creates a successful response without data.
     *
     * @param <T> the data type
     * @return a success ApiResponse with null data
     */
    public static <T> ApiResponse<T> success() {
        return new ApiResponse<>(true, "SUCCESS", "Operation completed", null, LocalDateTime.now());
    }

    /**
     * Creates an error response with code and message.
     *
     * @param code    the error code
     * @param message the error message
     * @param <T>     the data type
     * @return an error ApiResponse
     */
    public static <T> ApiResponse<T> error(String code, String message) {
        return new ApiResponse<>(false, code, message, null, LocalDateTime.now());
    }

    /**
     * Creates an error response with just a message.
     *
     * @param message the error message
     * @param <T>     the data type
     * @return an error ApiResponse
     */
    public static <T> ApiResponse<T> error(String message) {
        return new ApiResponse<>(false, "ERROR", message, null, LocalDateTime.now());
    }
}
