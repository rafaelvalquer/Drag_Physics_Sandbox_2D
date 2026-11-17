/** Pure logic behind the redesigned campaign screens (no DOM). */
import { describe, expect, it } from 'vitest';
import { chapterArt } from '../../../src/ui/career/screens/CareerChaptersScreen';
import { SYSTEMS, systemOf } from '../../../src/ui/career/screens/CareerGarageScreen';
import { summarize, type HistoryRow } from '../../../src/ui/career/screens/CareerHistoryScreen';
import { betterSide } from '../../../src/ui/career/screens/CareerResultScreen';
import { activeNavId } from '../../../src/ui/career/screens/CareerShell';
import { ALL_PARTS } from '../../../src/game/career/tuning/parts';

const row = (o: Partial<HistoryRow>): HistoryRow => ({ id: 'x', date: '', chapter: 'chapter-1', event: '', rival: '', outcome: 'win', rt: 0.5, et: 10, total: 10.5, trapKmh: 100, rivalEt: 11, credits: 100, reputation: 5, launchRpm: null, maxSlip: null, ...o });

describe('career screens: pure helpers', () => {
  it('every workshop category belongs to one of the garage systems', () => {
    const cats = new Set(ALL_PARTS.map((p) => p.category));
    for (const c of cats) expect(SYSTEMS).toContain(systemOf(c));
    expect(systemOf('turbo-boost')).toBe('Turbo');
    expect(systemOf('intake-filter')).toBe('Admissão');
    expect(systemOf('exhaust-muffler')).toBe('Escape');
    expect(systemOf('clutch')).toBe('Transmissão');
    expect(systemOf('camshaft')).toBe('Motor');
  });

  it('history summary counts only the listed runs and never invents a best ET', () => {
    expect(summarize([])).toMatchObject({ total: 0, wins: 0, losses: 0, bestEt: null });
    const s = summarize([row({ et: 10.2 }), row({ et: 9.8 }), row({ outcome: 'loss', et: 9.0 }), row({ outcome: 'red-light', et: null, credits: 0, reputation: 0 })]);
    expect(s).toMatchObject({ total: 4, wins: 2, losses: 2, bestEt: 9.8, credits: 300, reputation: 15 });
  });

  it('comparison rows mark the better side (lower is better for times, higher for speed)', () => {
    expect(betterSide({ player: 0.5, rival: 0.7, better: 'low' })).toBe('player');
    expect(betterSide({ player: 0.9, rival: 0.7, better: 'low' })).toBe('rival');
    expect(betterSide({ player: 120, rival: 100, better: 'high' })).toBe('player');
    expect(betterSide({ player: 90, rival: 100, better: 'high' })).toBe('rival');
    expect(betterSide({ player: null, rival: 1, better: 'low' })).toBeNull();
    expect(betterSide({ player: 1, rival: 1, better: 'low' })).toBeNull();
  });

  it('the navigation highlights the entry a screen belongs to', () => {
    expect(activeNavId('garage')).toBe('garage');
    expect(activeNavId('rival')).toBe('events');
    expect(activeNavId('result')).toBe('events');
    expect(activeNavId('workshop')).toBe('workshop');
    expect(activeNavId('unknown')).toBe('overview');
  });

  it('chapter artwork is procedural and deterministic, and differs per chapter', () => {
    expect(chapterArt(1)).toBe(chapterArt(1));
    expect(chapterArt(1)).not.toBe(chapterArt(2));
    expect(chapterArt(2)).toContain('<svg');
  });
});
