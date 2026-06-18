import type { ReactNode } from 'react';

export interface AdminTableColumn {
  /** Header label displayed in <th>. */
  label: string;
  /** Column alignment; defaults to left. */
  align?: 'left' | 'right';
  /** Extra Tailwind classes for the <th>. */
  className?: string;
}

interface AdminTableProps {
  /** Column headers. Render order matches insertion order. */
  columns: AdminTableColumn[];
  /** Body rows, already wrapped in <tr>. */
  children: ReactNode;
  /** Optional className for the outer wrapper. */
  className?: string;
}

/**
 * Shared shell for the admin tables used on theaters/roles/users/system
 * pages. Encapsulates the wrapper (`shadow-md rounded-lg overflow-hidden`),
 * `min-w-full divide-y` table styling, and the gray-50 / gray-200 thead/tbody
 * palette. Column headers and row markup stay page-specific so consumers
 * keep full control over cell content.
 */
export function AdminTable({ columns, children, className }: AdminTableProps) {
  return (
    <div className={`bg-white shadow-md rounded-lg overflow-hidden${className ? ` ${className}` : ''}`}>
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            {columns.map((col, i) => (
              <th
                key={i}
                className={
                  `px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider ${
                    col.align === 'right' ? 'text-right' : 'text-left'
                  }${col.className ? ` ${col.className}` : ''}`
                }
              >
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {children}
        </tbody>
      </table>
    </div>
  );
}