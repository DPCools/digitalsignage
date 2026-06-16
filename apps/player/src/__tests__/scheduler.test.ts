import { describe, it, expect } from 'vitest';
import { resolveActivePlaylist } from '../engine/scheduler';
import type { PlayerConfig, PlaylistConfig, ScheduleConfig } from '@signflow/types';

const makePlaylist = (id: string, isDefault = false): PlaylistConfig => ({
  id, name: `Playlist ${id}`, isDefault, items: [],
});

const makeSchedule = (
  overrides: Partial<ScheduleConfig> & { playlistId: string }
): ScheduleConfig => ({
  id: 'sched-1',
  startDate: '2026-01-01T00:00:00.000Z',
  recurrence: 'DAILY',
  daysOfWeek: [],
  screenIds: [],
  groupIds: [],
  priority: 0,
  isActive: true,
  ...overrides,
});

const makeConfig = (
  playlists: PlaylistConfig[],
  schedules: ScheduleConfig[],
  activeAlert = null
): PlayerConfig => ({
  screenId: 'screen-1',
  orgSlug: 'test',
  playlists,
  schedules,
  activeAlert,
  timezone: 'UTC',
  locale: 'en',
});

describe('resolveActivePlaylist', () => {
  it('returns null when there are no playlists', () => {
    const result = resolveActivePlaylist(makeConfig([], []), new Date());
    expect(result).toBeNull();
  });

  it('returns the default playlist when no schedules match', () => {
    const def = makePlaylist('default', true);
    const other = makePlaylist('other');
    const result = resolveActivePlaylist(makeConfig([def, other], []), new Date());
    expect(result?.id).toBe('default');
  });

  it('returns the scheduled playlist over the default when schedule is active', () => {
    const def = makePlaylist('default', true);
    const scheduled = makePlaylist('scheduled');
    const sched = makeSchedule({
      id: 'sched-1',
      playlistId: 'scheduled',
      startDate: '2026-01-01T00:00:00.000Z',
      recurrence: 'DAILY',
      daysOfWeek: [],
      priority: 1,
    });
    const now = new Date('2026-06-14T10:00:00.000Z');
    const result = resolveActivePlaylist(makeConfig([def, scheduled], [sched]), now);
    expect(result?.id).toBe('scheduled');
  });

  it('returns the highest-priority schedule when multiple match', () => {
    const p1 = makePlaylist('p1');
    const p2 = makePlaylist('p2');
    const sched1 = makeSchedule({ id: 's1', playlistId: 'p1', priority: 1, recurrence: 'DAILY' });
    const sched2 = makeSchedule({ id: 's2', playlistId: 'p2', priority: 5, recurrence: 'DAILY' });
    const now = new Date('2026-06-14T10:00:00.000Z');
    const result = resolveActivePlaylist(makeConfig([p1, p2], [sched1, sched2]), now);
    expect(result?.id).toBe('p2');
  });

  it('respects startTime/endTime window', () => {
    const p = makePlaylist('p1');
    const sched = makeSchedule({
      playlistId: 'p1',
      recurrence: 'DAILY',
      startTime: '09:00',
      endTime: '17:00',
    });
    const inWindow = new Date('2026-06-14T12:00:00.000Z');
    const outOfWindow = new Date('2026-06-14T20:00:00.000Z');
    expect(resolveActivePlaylist(makeConfig([p], [sched]), inWindow)?.id).toBe('p1');
    expect(resolveActivePlaylist(makeConfig([p], [sched]), outOfWindow)).toBeNull();
  });

  it('respects daysOfWeek filter', () => {
    const p = makePlaylist('p1');
    // Sunday = 0, daysOfWeek: [1] means Monday only
    const sched = makeSchedule({ playlistId: 'p1', recurrence: 'WEEKLY', daysOfWeek: [1] });
    const monday = new Date('2026-06-15T10:00:00.000Z');   // Monday
    const sunday = new Date('2026-06-14T10:00:00.000Z');   // Sunday
    expect(resolveActivePlaylist(makeConfig([p], [sched]), monday)?.id).toBe('p1');
    expect(resolveActivePlaylist(makeConfig([p], [sched]), sunday)).toBeNull();
  });

  it('respects endDate — schedule inactive after end date', () => {
    const p = makePlaylist('p1');
    const sched = makeSchedule({
      playlistId: 'p1',
      recurrence: 'DAILY',
      startDate: '2026-01-01T00:00:00.000Z',
      endDate: '2026-03-01T00:00:00.000Z',
    });
    const before = new Date('2026-02-15T10:00:00.000Z');
    const after = new Date('2026-06-14T10:00:00.000Z');
    expect(resolveActivePlaylist(makeConfig([p], [sched]), before)?.id).toBe('p1');
    expect(resolveActivePlaylist(makeConfig([p], [sched]), after)).toBeNull();
  });

  it('ignores inactive schedules', () => {
    const def = makePlaylist('default', true);
    const p = makePlaylist('p1');
    const sched = makeSchedule({ playlistId: 'p1', recurrence: 'DAILY', isActive: false });
    const result = resolveActivePlaylist(makeConfig([def, p], [sched]), new Date());
    expect(result?.id).toBe('default');
  });
});
