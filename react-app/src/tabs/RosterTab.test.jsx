import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import RosterTab from './RosterTab';

function setup(overrides = {}) {
  const props = {
    roster: [],
    setRoster: vi.fn(),
    currentRole: 'ah',
    setCurrentRole: vi.fn(),
    userName: '',
    setUserName: vi.fn(),
    userPosition: 'Club Member',
    setUserPosition: vi.fn(),
    onGoToSession: vi.fn(),
    ...overrides,
  };
  render(<RosterTab {...props} />);
  return props;
}

beforeEach(() => {
  vi.restoreAllMocks();
});

describe('RosterTab', () => {
  it('shows the empty state when roster is empty', () => {
    setup();
    expect(screen.getByText('No members yet.')).toBeInTheDocument();
  });

  it('renders each roster member with their initials', () => {
    setup({ roster: [{ name: 'Erika Fernandez' }, { name: 'Carlos Millones' }] });
    expect(screen.getByText('Erika Fernandez')).toBeInTheDocument();
    expect(screen.getByText('EF')).toBeInTheDocument();
    expect(screen.getByText('Carlos Millones')).toBeInTheDocument();
  });

  it('calls setRoster with the new member when "+ Add Member" is clicked', () => {
    const { setRoster } = setup();
    fireEvent.change(screen.getAllByPlaceholderText('e.g. Ralph Smedley')[1], { target: { value: 'Sara Cueva' } });
    fireEvent.click(screen.getByText('+ Add Member'));
    expect(setRoster).toHaveBeenCalledWith([{ name: 'Sara Cueva' }]);
  });

  it('does not add a blank name', () => {
    const { setRoster } = setup();
    fireEvent.click(screen.getByText('+ Add Member'));
    expect(setRoster).not.toHaveBeenCalled();
  });

  it('warns instead of adding a name already in the roster (case-insensitive)', () => {
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});
    const { setRoster } = setup({ roster: [{ name: 'Erika Fernandez' }] });
    fireEvent.change(screen.getAllByPlaceholderText('e.g. Ralph Smedley')[1], { target: { value: 'erika fernandez' } });
    fireEvent.click(screen.getByText('+ Add Member'));
    expect(alertSpy).toHaveBeenCalledWith('Already in roster.');
    expect(setRoster).not.toHaveBeenCalled();
  });

  it('removes a member when its Remove button is clicked', () => {
    const { setRoster } = setup({ roster: [{ name: 'Erika Fernandez' }, { name: 'Carlos Millones' }] });
    fireEvent.click(screen.getAllByText('Remove')[0]);
    expect(setRoster).toHaveBeenCalledWith([{ name: 'Carlos Millones' }]);
  });

  it('asks for confirmation before clearing the roster, and skips if declined', () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
    const { setRoster } = setup({ roster: [{ name: 'Erika Fernandez' }] });
    fireEvent.click(screen.getByText('Clear Roster'));
    expect(confirmSpy).toHaveBeenCalled();
    expect(setRoster).not.toHaveBeenCalled();
  });

  it('clears the roster when confirmed', () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const { setRoster } = setup({ roster: [{ name: 'Erika Fernandez' }] });
    fireEvent.click(screen.getByText('Clear Roster'));
    expect(setRoster).toHaveBeenCalledWith([]);
  });

  it('switches role when a role card is clicked', () => {
    const { setCurrentRole } = setup();
    fireEvent.click(screen.getByText('Timer'));
    expect(setCurrentRole).toHaveBeenCalledWith('timer');
  });

  it('calls onGoToSession from the "Go to Session" button', () => {
    const { onGoToSession } = setup();
    fireEvent.click(screen.getByText(/Go to Session/));
    expect(onGoToSession).toHaveBeenCalled();
  });

  it('renders all 14 default member chips, including the intentional "Sadith Lopez" duplicate', () => {
    setup();
    expect(screen.getAllByText(/Sadith Lopez/)).toHaveLength(2);
  });

  it('adding default members merges them into the roster without duplicating an existing name', () => {
    const { setRoster } = setup({ roster: [{ name: 'Sara Cueva' }] });
    fireEvent.click(screen.getByText('+ Add default members'));
    const added = setRoster.mock.calls[0][0];
    expect(added.filter((r) => r.name === 'Sara Cueva')).toHaveLength(1);
    // 14 entries in DEFAULT_MEMBERS, "Sadith Lopez" listed twice on purpose -> 13 unique names.
    // "Sara Cueva" was already in the roster, so it isn't duplicated.
    expect(added.length).toBe(13);
  });
});
