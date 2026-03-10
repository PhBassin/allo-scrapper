import React from 'react';
import type { UserRole } from '../../api/users';

interface RoleBadgeProps {
  role: UserRole;
}

/**
 * Badge component to display user role with appropriate styling
 * - Admin: Red badge with crown icon
 * - User: Blue badge
 */
const RoleBadge: React.FC<RoleBadgeProps> = ({ role }) => {
  if (role === 'admin') {
    return (
      <span className="px-2 py-1 text-xs font-semibold rounded-full bg-red-100 text-red-800">
        👑 Admin
      </span>
    );
  }

  return (
    <span className="px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800">
      User
    </span>
  );
};

export default RoleBadge;
