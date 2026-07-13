import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useLocalStorageState } from './useLocalStorageState';

beforeEach(() => {
  localStorage.clear();
});

describe('useLocalStorageState', () => {
  it('initializes from the given default when localStorage is empty', () => {
    const { result } = renderHook(() => useLocalStorageState('test-key', ['a']));
    expect(result.current[0]).toEqual(['a']);
  });

  it('reads an existing JSON value from localStorage on mount', () => {
    localStorage.setItem('test-key', JSON.stringify(['existing']));
    const { result } = renderHook(() => useLocalStorageState('test-key', []));
    expect(result.current[0]).toEqual(['existing']);
  });

  it('persists updates to localStorage as JSON by default', () => {
    const { result } = renderHook(() => useLocalStorageState('test-key', []));
    act(() => result.current[1](['x', 'y']));
    expect(JSON.parse(localStorage.getItem('test-key'))).toEqual(['x', 'y']);
  });

  it('stores/reads a plain string without JSON encoding when raw is true', () => {
    const { result } = renderHook(() => useLocalStorageState('role-key', 'ah', { raw: true }));
    act(() => result.current[1]('timer'));
    // a raw string in localStorage, NOT '"timer"' - this is what keeps tmRole/gsEndpoint
    // readable by the original vanilla toolkit during the migration transition.
    expect(localStorage.getItem('role-key')).toBe('timer');
    expect(result.current[0]).toBe('timer');
  });

  it('falls back to the default if the stored value is corrupted JSON', () => {
    localStorage.setItem('test-key', '{not valid json');
    const { result } = renderHook(() => useLocalStorageState('test-key', ['fallback']));
    expect(result.current[0]).toEqual(['fallback']);
  });
});
