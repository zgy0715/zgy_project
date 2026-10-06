/**
 * Tests for the shared list-shape and error helpers.
 *
 * The gateway is inconsistent about list payloads: `GET /projects` returns a
 * `PageResponse<ProjectResponse>` (the array lives in `data.content`) while
 * `GET /agents` and `GET /workflows` return plain arrays in `data`. The stores
 * must survive every one of those shapes instead of rendering
 * "x.map is not a function".
 */

import { asArray, getErrorMessage } from '../utils';

describe('asArray unwraps every list shape the gateway returns', () => {
  it('returns a plain array unchanged', () => {
    expect(asArray([1, 2, 3])).toEqual([1, 2, 3]);
  });

  it('unwraps a PageResponse (content)', () => {
    expect(
      asArray<number>({
        content: [1, 2],
        pageNumber: 0,
        pageSize: 20,
        totalElements: 2,
        totalPages: 1,
        first: true,
        last: true,
      })
    ).toEqual([1, 2]);
  });

  it('unwraps a named collection', () => {
    expect(asArray<number>({ agents: [1] })).toEqual([1]);
    expect(asArray<number>({ workflows: [2] })).toEqual([2]);
    expect(asArray<number>({ files: [3] })).toEqual([3]);
    expect(asArray<number>({ activities: [4] })).toEqual([4]);
    expect(asArray<number>({ templates: [5] })).toEqual([5]);
    expect(asArray<number>({ messages: [6] })).toEqual([6]);
  });

  it('unwraps a nested data array', () => {
    expect(asArray<number>({ data: [7] })).toEqual([7]);
  });

  it('does not unwrap a plain object that has no array field', () => {
    expect(asArray({ id: 'a', name: 'b' })).toEqual([]);
  });

  it('returns an empty array for null, undefined and primitives', () => {
    expect(asArray(null)).toEqual([]);
    expect(asArray(undefined)).toEqual([]);
    expect(asArray('nope')).toEqual([]);
    expect(asArray(42)).toEqual([]);
  });
});

describe('getErrorMessage never leaks an unreadable message', () => {
  it('prefers the gateway ApiResponse message', () => {
    const error = { response: { data: { message: '用户名已存在' } }, message: 'Request failed' };
    expect(getErrorMessage(error, '注册失败')).toBe('用户名已存在');
  });

  it('falls back to the Error message', () => {
    expect(getErrorMessage(new Error('Network Error'), '请求失败')).toBe('Network Error');
  });

  it('falls back to the supplied default for unknown values', () => {
    expect(getErrorMessage(null, '请求失败')).toBe('请求失败');
    expect(getErrorMessage(undefined, '请求失败')).toBe('请求失败');
    expect(getErrorMessage({}, '请求失败')).toBe('请求失败');
    expect(getErrorMessage({ response: { data: { message: '' } }, message: '' }, '请求失败')).toBe(
      '请求失败'
    );
  });
});
