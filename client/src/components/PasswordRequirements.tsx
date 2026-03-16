import React from 'react';

interface PasswordRequirementsProps {
  password: string;
}

interface Requirement {
  test: (password: string) => boolean;
  label: string;
}

const REQUIREMENTS: Requirement[] = [
  { test: (p) => p.length >= 8, label: 'At least 8 characters' },
  { test: (p) => /[A-Z]/.test(p), label: 'One uppercase letter' },
  { test: (p) => /[a-z]/.test(p), label: 'One lowercase letter' },
  { test: (p) => /[0-9]/.test(p), label: 'One digit' },
  { test: (p) => /[^A-Za-z0-9]/.test(p), label: 'One special character' },
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

const PasswordRequirements: React.FC<PasswordRequirementsProps> = ({ password }) => {
  return (
    <div className="mt-2 text-sm">
      <p className="text-gray-600 mb-1 font-medium">Constraints:</p>
      <ul className="space-y-1">
        {REQUIREMENTS.map((req, index) => {
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
    </div>
  );
};

export default PasswordRequirements;
