package com.deepagent.common.exception;

/**
 * 认证/授权失败异常，映射为 HTTP 401。
 *
 * 与 {@link BusinessException}（统一映射为 400）区分开，避免把“未认证/凭据错误”
 * 误报为“请求参数错误”。
 */
public class UnauthorizedException extends RuntimeException {

    private final String code;

    public UnauthorizedException(String message) {
        this("UNAUTHORIZED", message);
    }

    public UnauthorizedException(String code, String message) {
        super(message);
        this.code = code;
    }

    public String getCode() {
        return code;
    }
}
