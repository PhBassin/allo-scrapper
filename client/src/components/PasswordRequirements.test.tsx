import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import PasswordRequirements from './PasswordRequirements';

function itemFor(label: RegExp) {
  return screen.getByText(label).closest('li');
}

describe('PasswordRequirements', () => {
  it('marks no requirement as met while the password is empty', () => {
    render(<PasswordRequirements password="" username="cinemalover42" />);

    for (const label of [/at least 12 characters/i, /at most 128 characters/i, /different from the username/i]) {
      expect(itemFor(label)?.querySelector('.text-red-500')).toBeInTheDocument();
      expect(itemFor(label)?.querySelector('.text-green-500')).not.toBeInTheDocument();
    }
  });

  it('marks every requirement as met for a valid passphrase', () => {
    render(<PasswordRequirements password="correct horse battery" username="cinemalover42" />);

    for (const label of [/at least 12 characters/i, /at most 128 characters/i, /different from the username/i]) {
      expect(itemFor(label)?.querySelector('.text-green-500')).toBeInTheDocument();
    }
  });
});
