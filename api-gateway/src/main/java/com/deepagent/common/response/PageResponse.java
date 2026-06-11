package com.deepagent.common.response;

import com.fasterxml.jackson.annotation.JsonInclude;
import org.springframework.data.domain.Page;

import java.util.List;

/**
 * Paginated response wrapper for list endpoints.
 *
 * <p>Provides pagination metadata alongside the result list:</p>
 * <pre>
 * {
 *   "content": [...],
 *   "pageNumber": 0,
 *   "pageSize": 20,
 *   "totalElements": 100,
 *   "totalPages": 5,
 *   "first": true,
 *   "last": false
 * }
 * </pre>
 *
 * @param <T> the type of items in the content list
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record PageResponse<T>(

        List<T> content,
        int pageNumber,
        int pageSize,
        long totalElements,
        int totalPages,
        boolean first,
        boolean last

) {

    /**
     * Creates a PageResponse from a Spring Data Page.
     *
     * @param page the Spring Data Page object
     * @param <T>  the type of items
     * @return the PageResponse with pagination metadata
     */
    public static <T> PageResponse<T> from(Page<T> page) {
        return new PageResponse<>(
                page.getContent(),
                page.getNumber(),
                page.getSize(),
                page.getTotalElements(),
                page.getTotalPages(),
                page.isFirst(),
                page.isLast()
        );
    }

    /**
     * Creates a PageResponse from a list with manual pagination info.
     *
     * @param content       the page content
     * @param pageNumber    the current page number (0-based)
     * @param pageSize      the page size
     * @param totalElements the total number of elements across all pages
     * @param <T>           the type of items
     * @return the PageResponse
     */
    public static <T> PageResponse<T> of(List<T> content, int pageNumber,
                                          int pageSize, long totalElements) {
        var totalPages = (int) Math.ceil((double) totalElements / pageSize);
        return new PageResponse<>(
                content,
                pageNumber,
                pageSize,
                totalElements,
                totalPages,
                pageNumber == 0,
                pageNumber >= totalPages - 1
        );
    }
}
