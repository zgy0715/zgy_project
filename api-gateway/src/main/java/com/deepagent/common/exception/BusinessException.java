package com.deepagent.common.exception;

/**
 * Business exception for application-level errors.
 *
 * <p>Used to represent expected business rule violations that should
 * result in a 4xx HTTP response. Unlike system exceptions, these are
 * anticipated errors that the application handles gracefully.</p>
 */
public class BusinessException extends RuntimeException {

    private final String code;

    /**
     * Constructs a BusinessException with a message.
     *
     * @param message the error message
     */
    public BusinessException(String message) {
        super(message);
        this.code = "BUSINESS_ERROR";
    }

    /**
     * Constructs a BusinessException with a code and message.
     *
     * @param code    the error code
     * @param message the error message
     */
    public BusinessException(String code, String message) {
        super(message);
        this.code = code;
    }

    /**
     * Constructs a BusinessException with a message and cause.
     *
     * @param message the error message
     * @param cause   the underlying cause
     */
    public BusinessException(String message, Throwable cause) {
        super(message, cause);
        this.code = "BUSINESS_ERROR";
    }

    /**
     * Returns the error code.
     *
     * @return the error code string
     */
    public String getCode() {
        return code;
    }
}
