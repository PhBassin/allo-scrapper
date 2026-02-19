import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import AddCinemaModal from './AddCinemaModal';
import * as clientApi from '../api/client';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';

vi.mock('../api/client', () => ({
  addCinema: vi.fn(),
}));

describe('AddCinemaModal', () => {
  let mockAddCinema: ReturnType<typeof vi.fn>;
  const onClose = vi.fn();
  const onSuccess = vi.fn();

  beforeEach(() => {
    mockAddCinema = vi.fn();
    (clientApi.addCinema as any) = mockAddCinema;
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should render the form fields', () => {
    render(<AddCinemaModal onClose={onClose} onSuccess={onSuccess} />);

    expect(screen.getByLabelText(/Identifiant/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Nom du cinéma/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/URL/i)).toBeInTheDocument();
  });

  it('should call onClose when cancel is clicked', () => {
    render(<AddCinemaModal onClose={onClose} onSuccess={onSuccess} />);

    fireEvent.click(screen.getByText('Annuler'));
    expect(onClose).toHaveBeenCalled();
  });

  it('should call addCinema and onSuccess on successful submission', async () => {
    mockAddCinema.mockResolvedValue({ id: 'W1234', name: 'Test Cinéma', url: 'https://allocine.fr/test' });

    render(<AddCinemaModal onClose={onClose} onSuccess={onSuccess} />);

    fireEvent.change(screen.getByLabelText(/Identifiant/i), { target: { value: 'W1234' } });
    fireEvent.change(screen.getByLabelText(/Nom du cinéma/i), { target: { value: 'Test Cinéma' } });
    fireEvent.change(screen.getByLabelText(/URL/i), { target: { value: 'https://allocine.fr/test' } });

    fireEvent.click(screen.getByText('Ajouter et scraper'));

    await waitFor(() => {
      expect(mockAddCinema).toHaveBeenCalledWith({
        id: 'W1234',
        name: 'Test Cinéma',
        url: 'https://allocine.fr/test',
      });
      expect(onSuccess).toHaveBeenCalledWith('W1234');
    });
  });

  it('should show an error message when addCinema fails', async () => {
    mockAddCinema.mockRejectedValue({
      response: { data: { error: 'Cinema with this ID already exists' } },
    });

    render(<AddCinemaModal onClose={onClose} onSuccess={onSuccess} />);

    fireEvent.change(screen.getByLabelText(/Identifiant/i), { target: { value: 'W1234' } });
    fireEvent.change(screen.getByLabelText(/Nom du cinéma/i), { target: { value: 'Test' } });
    fireEvent.change(screen.getByLabelText(/URL/i), { target: { value: 'https://allocine.fr/test' } });

    fireEvent.click(screen.getByText('Ajouter et scraper'));

    await waitFor(() => {
      expect(screen.getByText('Cinema with this ID already exists')).toBeInTheDocument();
    });
    expect(onSuccess).not.toHaveBeenCalled();
  });
});
