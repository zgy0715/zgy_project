package com.deepagent.common.util;

import com.deepagent.common.exception.BusinessException;

import java.util.regex.Pattern;

/**
 * Utility class for input validation.
 *
 * <p>Provides reusable validation methods for common input patterns.
 * Throws {@link BusinessException} on validation failure.</p>
 */
public final class ValidationUtil {

    // Email regex pattern (RFC 5322 simplified)
    private static final Pattern EMAIL_PATTERN = Pattern.compile(
            "^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$"
    );

    // Username pattern: alphanumeric with underscores, 3-100 chars
    private static final Pattern USERNAME_PATTERN = Pattern.compile(
            "^[a-zA-Z0-9_]{3,100}$"
    );

    private ValidationUtil() {
        // Utility class, no instantiation
    }

    /**
     * Validates that a string is not null or blank.
     *
     * @param value     the string to validate
     * @param fieldName the field name for error messages
     * @throws BusinessException if the value is null or blank
     */
    public static void requireNonBlank(String value, String fieldName) {
        if (value == null || value.isBlank()) {
            throw new BusinessException(fieldName + " is required");
        }
    }

    /**
     * Validates that an object is not null.
     *
     * @param value     the object to validate
     * @param fieldName the field name for error messages
     * @throws BusinessException if the value is null
     */
    public static void requireNonNull(Object value, String fieldName) {
        if (value == null) {
            throw new BusinessException(fieldName + " is required");
        }
    }

    /**
     * Validates an email address format.
     *
     * @param email the email to validate
     * @throws BusinessException if the email format is invalid
     */
    public static void validateEmail(String email) {
        if (email == null || !EMAIL_PATTERN.matcher(email).matches()) {
            throw new BusinessException("Invalid email format");
        }
    }

    /**
     * Validates a username format.
     *
     * @param username the username to validate
     * @throws BusinessException if the username format is invalid
     */
    public static void validateUsername(String username) {
        if (username == null || !USERNAME_PATTERN.matcher(username).matches()) {
            throw new BusinessException(
                    "Username must be 3-100 characters and contain only letters, numbers, and underscores");
        }
    }

    /**
     * Validates that a string length is within bounds.
     *
     * @param value     the string to validate
     * @param minLength the minimum length (inclusive)
     * @param maxLength the maximum length (inclusive)
     * @param fieldName the field name for error messages
     * @throws BusinessException if the length is out of bounds
     */
    public static void validateLength(String value, int minLength, int maxLength,
                                       String fieldName) {
        if (value != null && (value.length() < minLength || value.length() > maxLength)) {
            throw new BusinessException(
                    fieldName + " must be between " + minLength + " and " + maxLength + " characters");
        }
    }

    /**
     * Validates that a page number and size are within acceptable bounds.
     *
     * @param page the page number (0-based)
     * @param size the page size
     * @throws BusinessException if the pagination parameters are invalid
     */
    public static void validatePagination(int page, int size) {
        if (page < 0) {
            throw new BusinessException("Page number must be non-negative");
        }
        if (size < 1 || size > 100) {
            throw new BusinessException("Page size must be between 1 and 100");
        }
    }
}
