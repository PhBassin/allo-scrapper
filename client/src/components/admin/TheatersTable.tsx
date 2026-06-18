import type { Theater } from '../../types';
import LinkButton from '../ui/LinkButton';
import { AdminTable, type AdminTableColumn } from './AdminTable.js';

interface TheatersTableProps {
  theaters: Theater[];
  canScrapeSingle: boolean;
  canUpdate: boolean;
  canDelete: boolean;
  onScrapeSingle: (theaterId: string) => Promise<void>;
  onEdit: (theater: Theater) => void;
  onDelete: (theater: Theater) => void;
}

const COLUMNS: AdminTableColumn[] = [
  { label: 'ID' },
  { label: 'Name' },
  { label: 'City' },
  { label: 'Screens' },
  { label: 'Actions', align: 'right' },
];

export function TheatersTable({
  theaters,
  canScrapeSingle,
  canUpdate,
  canDelete,
  onScrapeSingle,
  onEdit,
  onDelete,
}: TheatersTableProps) {
  return (
    <AdminTable columns={COLUMNS}>
      {theaters.map((theater) => (
        <TheaterRow
          key={theater.id}
          theater={theater}
          canScrapeSingle={canScrapeSingle}
          canUpdate={canUpdate}
          canDelete={canDelete}
          onScrapeSingle={onScrapeSingle}
          onEdit={onEdit}
          onDelete={onDelete}
        />
      ))}
    </AdminTable>
  );
}

interface TheaterRowProps {
  theater: Theater;
  canScrapeSingle: boolean;
  canUpdate: boolean;
  canDelete: boolean;
  onScrapeSingle: (theaterId: string) => Promise<void>;
  onEdit: (theater: Theater) => void;
  onDelete: (theater: Theater) => void;
}

function TheaterRow({
  theater,
  canScrapeSingle,
  canUpdate,
  canDelete,
  onScrapeSingle,
  onEdit,
  onDelete,
}: TheaterRowProps) {
  return (
    <tr className="hover:bg-gray-50">
      <td className="px-6 py-4 whitespace-nowrap">
        <div className="font-mono text-sm text-gray-900">{theater.id}</div>
      </td>
      <td className="px-6 py-4 whitespace-nowrap">
        <div className="text-sm font-bold text-gray-900">{theater.name}</div>
      </td>
      <td className="px-6 py-4 whitespace-nowrap">
        <div className="text-sm text-gray-500">{theater.city ?? '-'}</div>
      </td>
      <td className="px-6 py-4 whitespace-nowrap">
        <div className="text-sm text-gray-500">
          {theater.screen_count != null ? theater.screen_count : '-'}
        </div>
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
        <div className="flex justify-end gap-2">
          {canScrapeSingle && (
            <LinkButton
              variant="success"
              onClick={() => { onScrapeSingle(theater.id); }}
              data-testid={`scrape-theater-${theater.id}`}
            >
              Scraper
            </LinkButton>
          )}
          {canUpdate && (
            <LinkButton
              onClick={() => onEdit(theater)}
              data-testid={`edit-theater-${theater.id}`}
            >
              Edit
            </LinkButton>
          )}
          {canDelete && (
            <LinkButton
              variant="danger"
              onClick={() => onDelete(theater)}
              data-testid={`delete-theater-${theater.id}`}
            >
              Delete
            </LinkButton>
          )}
        </div>
      </td>
    </tr>
  );
}