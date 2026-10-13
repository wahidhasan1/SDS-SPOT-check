import { describe, expect, it } from 'vitest';
import { analyseText, countWords, eloDelta, isAnswerCorrect, nextSrsState, overallBand, rawToBand, SRS_INITIAL, thetaToCefr, updateTheta, wordLimitOk } from '../src';

describe('IELTS scoring helpers', () => {
  it('converts raw scores to bands using the 40-question tables', () => {
    expect(rawToBand('listening', 30, 40).band).toBe(7);
    expect(rawToBand('reading_academic', 23, 40).band).toBe(6);
    expect(rawToBand('reading_general', 34, 40).band).toBe(7);
    expect(rawToBand('listening', 40, 40).band).toBe(9);
  });
  it('scales short practice sets and flags them as estimates', () => {
    const r = rawToBand('reading_academic', 10, 13);
    expect(r.scaled).toBe(true);
    expect(r.scaledRaw).toBe(31);
    expect(r.band).toBe(7);
  });
  it('rounds overall bands the IELTS way', () => {
    expect(overallBand([6.5, 6.5, 5, 7])).toBe(6.5); // 6.25 -> 6.5
    expect(overallBand([7, 7, 6.5, 6.5])).toBe(7); // 6.75 -> 7
    expect(overallBand([6, 6, 6, 6.5])).toBe(6); // 6.125 -> 6
  });
  it('accepts alternatives, optional words and ignores case/currency', () => {
    expect(isAnswerCorrect('Hollow Stems', ['hollow stems'])).toBe(true);
    expect(isAnswerCorrect('permit', ['[a] permit|[a] parking permit'])).toBe(true);
    expect(isAnswerCorrect('a parking permit', ['[a] permit|[a] parking permit'])).toBe(true);
    expect(isAnswerCorrect('£50', ['50|fifty'])).toBe(true);
    expect(isAnswerCorrect('the density', ['density'])).toBe(false);
    expect(isAnswerCorrect('', ['x'])).toBe(false);
  });
  it('enforces word limits', () => {
    expect(wordLimitOk('car park', 2)).toBe(true);
    expect(wordLimitOk('the front car park', 2)).toBe(false);
  });
});

describe('spaced repetition', () => {
  it('grows intervals on success and resets on failure', () => {
    let s = nextSrsState(SRS_INITIAL, 4);
    expect(s.intervalDays).toBe(1);
    s = nextSrsState(s, 4);
    expect(s.intervalDays).toBe(3);
    s = nextSrsState(s, 5);
    expect(s.intervalDays).toBeGreaterThan(6);
    s = nextSrsState(s, 1);
    expect(s.intervalDays).toBe(1);
    expect(s.repetitions).toBe(0);
    expect(s.easeFactor).toBeGreaterThanOrEqual(1.3);
  });
});

describe('adaptive placement maths', () => {
  it('moves ability up after correct answers and down after wrong ones', () => {
    expect(updateTheta(3, 3, true, 0)).toBeGreaterThan(3);
    expect(updateTheta(3, 3, false, 0)).toBeLessThan(3);
  });
  it('maps ability to CEFR levels', () => {
    expect(thetaToCefr(1)).toBe('A1');
    expect(thetaToCefr(3)).toBe('B1');
    expect(thetaToCefr(6.2)).toBe('C2');
  });
});

describe('battle rating', () => {
  it('awards more points for beating a stronger player', () => {
    expect(eloDelta(1000, 1200, 1, 20)).toBeGreaterThan(eloDelta(1200, 1000, 1, 20));
    expect(eloDelta(1000, 1000, 0.5, 20)).toBe(0);
  });
});

describe('text metrics', () => {
  it('counts words like IELTS (hyphenated and contracted words count once)', () => {
    expect(countWords("It's a well-known fact that 25 people came.")).toBe(8);
  });
  it('detects linking devices and fillers', () => {
    const m = analyseText('However, it rained. Um, I mean, we stayed. As a result, we read.');
    expect(m.linkingDevices.map((l) => l.phrase)).toEqual(expect.arrayContaining(['however', 'as a result']));
    expect(m.fillerWords.map((f) => f.phrase)).toEqual(expect.arrayContaining(['um', 'i mean']));
  });
});
