import React from 'react';
import {
  isSameAsUsername,
  meetsMinimumLength,
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  passwordLength,
} from '../utils/userValidators.js';

interface PasswordRequirementsProps {
  password: string;
  /** When given, adds the "different from the username" requirement. */
  username?: string;
}

interface Requirement {
  test: (password: string) => boolean;
  label: string;
}

const REQUIREMENTS: Requirement[] = [
  { test: meetsMinimumLength, label: `At least ${PASSWORD_MIN_LENGTH} characters` },
  { test: (p) => passwordLength(p) <= PASSWORD_MAX_LENGTH, label: `At most ${PASSWORD_MAX_LENGTH} characters` },
];

const CheckIcon: React.FC = () => (
  <svg className="w-4 h-4 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
  </svg>
);

const CrossIcon: React.FC = () => (
  <svg className="w-4 h-4 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
  </svg>
);

const PasswordRequirements: React.FC<PasswordRequirementsProps> = ({ password, username }) => {
  const requirements = username
    ? [...REQUIREMENTS, { test: (p: string) => !isSameAsUsername(p, username), label: 'Different from the username' }]
    : REQUIREMENTS;
  return (
    <div className="mt-2 text-sm">
      <p className="text-gray-600 mb-1 font-medium">Constraints:</p>
      <ul className="space-y-1">
        {requirements.map((req, index) => {
          const isMet = req.test(password);
          return (
            <li key={index} className="flex items-center gap-2">
              {isMet ? <CheckIcon /> : <CrossIcon />}
              <span className={isMet ? 'text-green-700 font-medium' : 'text-red-700'}>
                {req.label}
              </span>
            </li>
          );
        })}
      </ul>
      <p className="mt-1 text-gray-500">
        Passphrases are welcome. Common passwords and the username are refused.
      </p>
    </div>
  );
};

export default PasswordRequirements;
