import { describe, it, expect } from 'vitest';
import { useContext } from 'react';
import { AuthContext, AuthProvider } from '../contexts/AuthContext';
import { render, screen } from '@testing-library/react';

// This test demonstrates the current lack of type strictness for permissions.
// After the refactoring, calling hasPermission with a string that is NOT a 
// PermissionName should be a TypeScript compilation error.

function TestComponent() {
  const { hasPermission } = useContext(AuthContext);
  
  // CURRENTLY: This is valid TypeScript but is logically "bad" because it's a typo
  // GOAL: This should cause a compilation error after refactoring
  const hasBadPermission = hasPermission('invalid:permission:string' as any);
  
  return <div data-testid="result">{String(hasBadPermission)}</div>;
}

describe('Permission Type Strictness (RED)', () => {
  it('should ideally fail at compile-time for invalid permission strings', () => {
    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );
    
    // It returns false now, which is runtime-correct, but we want compile-time protection.
    expect(screen.getByTestId('result').textContent).toBe('false');
  });
});
