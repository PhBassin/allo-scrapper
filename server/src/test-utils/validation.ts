/**
 * Test helpers for validation-related assertions.
 *
 * Usage:
 *   import { expectValidationError } from '../test-utils/validation.js';
 *   expectValidationError(response, 'username', 'required');
 */

import type { Response } from 'supertest';
import { expect } from 'vitest';

// ---------------------------------------------------------------------------
// Standardised validation error assertion
// ---------------------------------------------------------------------------

/**
 * Asserts that a response is a 400 validation error containing a specific
 * field and error code/message fragment.
 *
 * @param response - The supertest response object.
 * @param field    - The field name expected in the error message.
 * @param code     - A fragment expected in `response.body.error` (e.g. 'required', 'minLength', 'pattern').
 */
export function expectValidationError(
  response: Response,
  field: string,
  code: string,
): void {
  expect(response.status).toBe(400);
  expect(response.body.success).toBe(false);
  expect(response.body.error).toBeDefined();

  const error = response.body.error as string;
  // The error message should mention the field and the code
  expect(error.toLowerCase()).toContain(field.toLowerCase());
  expect(error.toLowerCase()).toContain(code.toLowerCase());
}
