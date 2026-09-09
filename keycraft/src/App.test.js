import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { WorkspaceProvider } from './Workspace';
import Home from './pages/Home';
import DesignPage from './pages/DesignPage';
import { parseVimMaplist } from './utils/importMappings';

function workspaceUI(path = '/') {
  return render(<WorkspaceProvider><MemoryRouter initialEntries={[path]}><Routes><Route path="/" element={<Home />} /><Route path="/snapshots/:profileId" element={<DesignPage />} /></Routes></MemoryRouter></WorkspaceProvider>);
}

beforeEach(() => {
  localStorage.clear();
  Object.defineProperty(window, 'crypto', { configurable: true, value: { randomUUID: () => 'test-snapshot' } });
});

afterEach(() => jest.restoreAllMocks());

function seedSnapshots() {
  const profiles = [
    { id: 'private', name: 'Private Vim', kind: 'vim', mappings: [{ lhs: 'x', rhs: 'private-command' }] },
    { id: 'keep', name: 'Keep tmux', kind: 'tmux', mappings: [{ lhs: 'c', rhs: 'new-window', table: 'root', cmd: 'root' }] },
  ];
  const value = { version: 1, profiles };
  localStorage.setItem('keycraft.workspace.v1', JSON.stringify(value));
  return value;
}

test('deleting a snapshot requires confirmation, preserves others and persists after reopening', async () => {
  const original = seedSnapshots();
  const mounted = workspaceUI();
  fireEvent.click(await screen.findByRole('button', { name: 'Delete snapshot Private Vim' }));
  let dialog = within(screen.getByRole('dialog', { name: 'Delete snapshot?' }));
  fireEvent.click(dialog.getByRole('button', { name: 'Cancel' }));
  expect(JSON.parse(localStorage.getItem('keycraft.workspace.v1'))).toEqual(original);
  fireEvent.click(screen.getByRole('button', { name: 'Delete snapshot Private Vim' }));
  dialog = within(screen.getByRole('dialog', { name: 'Delete snapshot?' }));
  fireEvent.click(dialog.getByRole('button', { name: 'Delete snapshot', exact: true }));
  await waitFor(() => expect(screen.queryByRole('button', { name: 'Delete snapshot Private Vim' })).not.toBeInTheDocument());
  expect(JSON.parse(localStorage.getItem('keycraft.workspace.v1')).profiles).toEqual([original.profiles[1]]);
  expect(screen.getByRole('button', { name: 'Delete snapshot Keep tmux' })).toBeInTheDocument();
  mounted.unmount();
  workspaceUI('/snapshots/private');
  expect(await screen.findByText('This snapshot could not be found.')).toBeInTheDocument();
});

test('clear all removes filtered-out snapshots too and leaves the built-in reference available', async () => {
  seedSnapshots();
  const mounted = workspaceUI();
  await waitFor(() => expect(screen.getByRole('button', { name: 'Clear all snapshots' })).toBeEnabled());
  fireEvent.click(screen.getByRole('button', { name: 'Vim snapshots' }));
  fireEvent.change(screen.getByRole('searchbox', { name: 'Search snapshots' }), { target: { value: 'Private' } });
  fireEvent.click(screen.getByRole('button', { name: 'Clear all snapshots' }));
  const dialog = within(screen.getByRole('dialog', { name: 'Clear all snapshots?' }));
  expect(dialog.getByText('Delete all 2 saved snapshots, including those hidden by filters?')).toBeInTheDocument();
  fireEvent.click(dialog.getByRole('button', { name: 'Delete all snapshots' }));
  await screen.findByText('No snapshots yet');
  expect(JSON.parse(localStorage.getItem('keycraft.workspace.v1'))).toEqual({ version: 1, profiles: [] });
  expect(screen.getByRole('button', { name: 'Clear all snapshots' })).toBeDisabled();
  mounted.unmount();
  workspaceUI();
  await screen.findByText('No snapshots yet');
  fireEvent.click(screen.getByRole('link', { name: 'Explore Vim built-ins' }));
  await screen.findByRole('heading', { name: 'Vim built-ins' });
  expect(parseInt(screen.getByRole('status').textContent, 10)).toBeGreaterThan(500);
});

test('failed deletion keeps the stored snapshots and allows retry', async () => {
  const original = seedSnapshots();
  workspaceUI();
  fireEvent.click(await screen.findByRole('button', { name: 'Delete snapshot Private Vim' }));
  const write = jest.spyOn(Storage.prototype, 'setItem').mockImplementationOnce(() => { throw new Error('Disk unavailable'); });
  const dialog = within(screen.getByRole('dialog', { name: 'Delete snapshot?' }));
  fireEvent.click(dialog.getByRole('button', { name: 'Delete snapshot', exact: true }));
  expect(await dialog.findByRole('alert')).toHaveTextContent('Could not delete snapshots: Disk unavailable');
  expect(JSON.parse(localStorage.getItem('keycraft.workspace.v1'))).toEqual(original);
  write.mockRestore();
  fireEvent.click(dialog.getByRole('button', { name: 'Delete snapshot', exact: true }));
  await waitFor(() => expect(JSON.parse(localStorage.getItem('keycraft.workspace.v1')).profiles).toEqual([original.profiles[1]]));
});

test('import, search, capture Enter and reopen a saved snapshot without a server', async () => {
  const mounted = workspaceUI();
  await waitFor(() => expect(screen.getByRole('button', { name: 'Import text or file' })).toBeEnabled());
  fireEvent.click(screen.getByRole('button', { name: 'Import text or file' }));
  fireEvent.change(screen.getByLabelText('Snapshot name'), { target: { value: 'My Vim setup' } });
  fireEvent.change(screen.getByLabelText('Exported mappings'), { target: { value: 'n  <CR>       * :write<CR>\nn  gg         * :normal! gg<CR>' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save and explore →' }));
  await screen.findByRole('heading', { name: 'My Vim setup' });
  expect(screen.getByRole('status')).toHaveTextContent('2 mappings');
  fireEvent.keyDown(screen.getByLabelText('Search mappings'), { key: 'w', code: 'KeyW' });
  expect(screen.queryByRole('button', { name: 'Clear sequence' })).not.toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('Search mappings'), { target: { value: '<cr>' } });
  expect(screen.getByRole('status')).toHaveTextContent('2 mappings');
  fireEvent.keyDown(window, { key: 'Enter', code: 'Enter' });
  expect(screen.getByRole('status')).toHaveTextContent('1 mappings');
  fireEvent.click(screen.getByRole('button', { name: 'Clear sequence' }));
  expect(screen.getByRole('status')).toHaveTextContent('2 mappings');
  fireEvent.keyDown(window, { key: 'g', code: 'KeyG' });
  fireEvent.keyDown(window, { key: 'g', code: 'KeyG' });
  expect(screen.getByRole('status')).toHaveTextContent('1 mappings');
  expect(fireEvent.keyDown(screen.getByLabelText('Search mappings'), { key: 'Backspace', code: 'Backspace' })).toBe(true);
  expect(screen.getByRole('status')).toHaveTextContent('1 mappings');
  expect(fireEvent.keyDown(window, { key: 'Backspace', code: 'Backspace' })).toBe(false);
  expect(screen.queryByRole('button', { name: 'Clear sequence' })).not.toBeInTheDocument();
  expect(screen.getByRole('status')).toHaveTextContent('2 mappings');
  expect(screen.getByLabelText('Search mappings')).toHaveValue('<cr>');
  fireEvent.keyDown(window, { key: 'g', code: 'KeyG' });
  fireEvent.click(screen.getByRole('button', { name: 'Keyboard capture on' }));
  expect(fireEvent.keyDown(window, { key: 'Backspace', code: 'Backspace' })).toBe(true);
  expect(screen.getByRole('button', { name: 'Clear sequence' })).toBeInTheDocument();
  mounted.unmount();
  workspaceUI('/snapshots/test-snapshot');
  await screen.findByRole('heading', { name: 'My Vim setup' });
  expect(screen.getByRole('status')).toHaveTextContent('2 mappings');
});

test('invalid imports show an actionable error and create no snapshots', async () => {
  workspaceUI();
  await waitFor(() => expect(screen.getByRole('button', { name: 'Import text or file' })).toBeEnabled());
  fireEvent.click(screen.getByRole('button', { name: 'Import text or file' }));
  fireEvent.change(screen.getByLabelText('Exported mappings'), { target: { value: 'nnoremap x y' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save and explore →' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('No Vim mappings found');
  expect(localStorage.length).toBe(0);
});

test('saved literal Vim triggers remain visible and match complete keyboard sequences', async () => {
  const mappings = parseVimMaplist(JSON.stringify({ scripts: [], mappings: [
    { mode: 'i', lhs: '{}', lhsNotation: '{}', rhs: '<Esc>' },
    { mode: 'n', lhs: '<CR>', lhsNotation: '<lt>CR>', rhs: 'literal-cr' },
    { mode: 'n', lhs: '<CR>', lhsNotation: '<CR>', rhs: 'special-cr' },
  ] }));
  localStorage.setItem('keycraft.workspace.v1', JSON.stringify({ version: 1, profiles: [
    { id: 'literal-vim', name: 'Literal Vim', kind: 'vim', mappings },
  ] }));
  const mounted = workspaceUI('/snapshots/literal-vim');
  await screen.findByRole('heading', { name: 'Literal Vim' });
  expect(screen.getByRole('status')).toHaveTextContent('3 mappings');
  fireEvent.keyDown(window, { key: '{', code: 'BracketLeft', shiftKey: true });
  fireEvent.keyDown(window, { key: '}', code: 'BracketRight', shiftKey: true });
  expect(screen.getByRole('status')).toHaveTextContent('1 mappings');
  fireEvent.keyDown(window, { key: 'Backspace', code: 'Backspace' });
  for (const [key, code] of [['<', 'Comma'], ['C', 'KeyC'], ['R', 'KeyR'], ['>', 'Period']]) {
    fireEvent.keyDown(window, { key, code, shiftKey: true });
  }
  expect(screen.getByRole('status')).toHaveTextContent('1 mappings');
  expect(screen.getByText('literal-cr')).toBeInTheDocument();
  expect(screen.queryByText('special-cr')).not.toBeInTheDocument();
  mounted.unmount();
  workspaceUI('/snapshots/literal-vim');
  await screen.findByRole('heading', { name: 'Literal Vim' });
  fireEvent.keyDown(window, { key: 'Enter', code: 'Enter' });
  expect(screen.getByRole('status')).toHaveTextContent('1 mappings');
  expect(screen.getByText('special-cr')).toBeInTheDocument();
  expect(screen.queryByText('literal-cr')).not.toBeInTheDocument();
});

test('older tmux snapshots show both prefixes and guide capture, reset and table filtering', async () => {
  localStorage.setItem('keycraft.workspace.v1', JSON.stringify({ version: 1, profiles: [{
    id: 'old-tmux', name: 'Existing tmux', kind: 'tmux', mappings: [
      { table: 'prefix', cmd: 'prefix', lhs: '<C-a>c', rhs: 'new-window', setting_source: 'tmux', verbose: 'tmux key table: prefix · prefix: C-a' },
      { table: 'prefix', cmd: 'prefix', lhs: '<C-b>c', rhs: 'new-window', setting_source: 'tmux', verbose: 'tmux key table: prefix · prefix: C-b' },
      { table: 'root', cmd: 'root', lhs: '<M-Left>', rhs: 'previous-window', setting_source: 'tmux' },
    ],
  }] }));
  workspaceUI('/snapshots/old-tmux');
  const prefixPanel = within(await screen.findByRole('region', { name: 'tmux prefix' }));
  expect(prefixPanel.getByText('Ctrl + A')).toBeInTheDocument();
  expect(prefixPanel.getByText('Ctrl + B')).toBeInTheDocument();
  expect(prefixPanel.getByText('Press a prefix, release it, then press a command key.')).toBeInTheDocument();
  fireEvent.keyDown(window, { key: 'b', code: 'KeyB', ctrlKey: true });
  expect(prefixPanel.getByText('Prefix received — press the next key.')).toBeInTheDocument();
  expect(screen.getByRole('status')).toHaveTextContent('1 mappings');
  fireEvent.keyDown(window, { key: 'c', code: 'KeyC' });
  expect(prefixPanel.getByText('Sequence entered · Backspace resets it.')).toBeInTheDocument();
  fireEvent.keyDown(window, { key: 'Backspace', code: 'Backspace' });
  expect(prefixPanel.getByText('Press a prefix, release it, then press a command key.')).toBeInTheDocument();
  expect(screen.getByRole('status')).toHaveTextContent('3 mappings');
  fireEvent.click(screen.getByRole('button', { name: 'prefix', exact: true }));
  expect(prefixPanel.getByText('Select the prefix table to explore these bindings.')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Keyboard capture on' }));
  expect(prefixPanel.getByText('Keyboard capture is off.')).toBeInTheDocument();
});

test('tmux import retains a configured prefix even when only root bindings are exported', async () => {
  workspaceUI();
  await waitFor(() => expect(screen.getByRole('button', { name: 'Paste tmux bindings →' })).toBeEnabled());
  fireEvent.click(screen.getByRole('button', { name: 'Paste tmux bindings →' }));
  fireEvent.change(screen.getByLabelText('Prefix'), { target: { value: 'C-z' } });
  fireEvent.change(screen.getByLabelText('Exported mappings'), { target: { value: 'bind-key -T root M-Left previous-window' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save and explore →' }));
  const prefixPanel = within(await screen.findByRole('region', { name: 'tmux prefix' }));
  expect(prefixPanel.getByText('Ctrl + Z')).toBeInTheDocument();
  expect(prefixPanel.getByText('This snapshot has no prefix-table bindings.')).toBeInTheDocument();
  expect(JSON.parse(localStorage.getItem('keycraft.workspace.v1')).profiles[0].tmuxPrefixes).toEqual(['C-z']);
});

test('text imports save the Vim leader, highlight it, and show completion after capture', async () => {
  const mounted = workspaceUI();
  await waitFor(() => expect(screen.getByRole('button', { name: 'Import text or file' })).toBeEnabled());
  fireEvent.click(screen.getByRole('button', { name: 'Import text or file' }));
  fireEvent.change(screen.getByLabelText('Snapshot name'), { target: { value: 'Leader Vim' } });
  fireEvent.change(screen.getByLabelText('Leader key (optional)'), { target: { value: '<Space>' } });
  fireEvent.change(screen.getByLabelText('Exported mappings'), { target: { value: 'n  <Space>w    * :write<CR>' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save and explore →' }));
  const panel = within(await screen.findByRole('region', { name: 'Vim leader' }));
  expect(panel.getByText('Space')).toBeInTheDocument();
  expect(screen.getByTitle('Vim leader key')).toHaveClass('key--space', 'vim-leader-key');
  expect(JSON.parse(localStorage.getItem('keycraft.workspace.v1')).profiles[0].vimLeader).toBe('<Space>');
  fireEvent.keyDown(window, { key: ' ', code: 'Space' });
  expect(panel.getByText(/Leader received/)).toBeInTheDocument();
  expect(screen.queryByTitle('Vim leader key')).not.toBeInTheDocument();
  fireEvent.keyDown(window, { key: 'w', code: 'KeyW' });
  expect(screen.getByRole('status')).toHaveTextContent('1 mappings');
  fireEvent.keyDown(window, { key: 'Backspace', code: 'Backspace' });
  expect(screen.getByTitle('Vim leader key')).toHaveClass('key--space');
  fireEvent.click(screen.getByRole('button', { name: 'Keyboard capture on' }));
  expect(screen.queryByTitle('Vim leader key')).not.toBeInTheDocument();
  mounted.unmount();
  workspaceUI('/snapshots/test-snapshot');
  await screen.findByRole('heading', { name: 'Leader Vim' });
  expect(screen.getByTitle('Vim leader key')).toHaveClass('key--space');
});

test('older Vim snapshots can set a leader without changing mappings and recover from failed saves', async () => {
  const original = seedSnapshots();
  const mounted = workspaceUI('/snapshots/private');
  const panel = within(await screen.findByRole('region', { name: 'Vim leader' }));
  expect(panel.getByText('Not recorded')).toBeInTheDocument();
  expect(screen.queryByTitle('Vim leader key')).not.toBeInTheDocument();
  fireEvent.click(panel.getByRole('button', { name: 'Set leader' }));
  fireEvent.change(panel.getByLabelText('Leader key'), { target: { value: ',' } });
  const write = jest.spyOn(Storage.prototype, 'setItem').mockImplementationOnce(() => { throw new Error('Disk unavailable'); });
  fireEvent.click(panel.getByRole('button', { name: 'Save leader' }));
  expect(await panel.findByRole('alert')).toHaveTextContent('Could not save leader: Disk unavailable');
  expect(JSON.parse(localStorage.getItem('keycraft.workspace.v1'))).toEqual(original);
  write.mockRestore();
  fireEvent.click(panel.getByRole('button', { name: 'Save leader' }));
  await panel.findByRole('button', { name: 'Edit leader' });
  expect(screen.getByTitle('Vim leader key')).toHaveTextContent(',');
  const saved = JSON.parse(localStorage.getItem('keycraft.workspace.v1'));
  expect(saved.profiles[0]).toEqual({ ...original.profiles[0], vimLeader: ',' });
  expect(saved.profiles[1]).toEqual(original.profiles[1]);
  mounted.unmount();
  workspaceUI('/snapshots/private');
  await screen.findByRole('heading', { name: 'Private Vim' });
  expect(screen.getByTitle('Vim leader key')).toHaveTextContent(',');
});
