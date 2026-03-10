import React from 'react';

interface RoleBadgeProps {
  roleName: string;
  isSystem?: boolean;
}

/**
 * Badge component to display user role with appropriate styling.
 * - admin: Red badge with crown icon
 * - system role (non-admin): Blue badge
 * - custom role: Gray badge
 */
const RoleBadge: React.FC<RoleBadgeProps> = ({ roleName, isSystem }) => {
  if (roleName === 'admin') {
    return (
      <span className="px-2 py-1 text-xs font-semibold rounded-full bg-red-100 text-red-800">
        👑 {roleName}
      </span>
    );
  }

  if (isSystem) {
    return (
      <span className="px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800">
        {roleName}
      </span>
    );
  }

  return (
    <span className="px-2 py-1 text-xs font-semibold rounded-full bg-gray-100 text-gray-800">
      {roleName}
    </span>
  );
};

export default RoleBadge;
