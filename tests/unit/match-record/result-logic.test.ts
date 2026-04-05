/**
 * 单元测试: match-record 模块 — 胜负判定和个人战绩结果判定
 *
 * 覆盖逻辑:
 * - determineMatchResult (§6.1 胜负判定算法)
 * - determineUserResult (§6.2 个人战绩结果判定)
 */
import { describe, it, expect } from 'vitest';
import { determineMatchResult, determineUserResult } from '@server/modules/match-record/service.js';

// ===========================================================================
// determineMatchResult — §6.1 胜负判定算法
// ===========================================================================

describe('determineMatchResult', () => {
  it('should return A_WIN when A wins majority of games', () => {
    expect(
      determineMatchResult([
        { scoreA: 21, scoreB: 18 },
        { scoreA: 21, scoreB: 15 },
      ]),
    ).toBe('A_WIN');
  });

  it('should return B_WIN when B wins majority of games', () => {
    expect(
      determineMatchResult([
        { scoreA: 15, scoreB: 21 },
        { scoreA: 18, scoreB: 21 },
      ]),
    ).toBe('B_WIN');
  });

  it('should return DRAW when both sides win equal number of games', () => {
    expect(
      determineMatchResult([
        { scoreA: 21, scoreB: 18 },
        { scoreA: 18, scoreB: 21 },
      ]),
    ).toBe('DRAW');
  });

  it('should not count tied games towards either side', () => {
    // A wins 1, B wins 1, 1 tie → DRAW
    expect(
      determineMatchResult([
        { scoreA: 21, scoreB: 18 },
        { scoreA: 20, scoreB: 20 },
        { scoreA: 18, scoreB: 21 },
      ]),
    ).toBe('DRAW');
  });

  it('should handle single game A_WIN', () => {
    expect(determineMatchResult([{ scoreA: 21, scoreB: 15 }])).toBe('A_WIN');
  });

  it('should handle single game B_WIN', () => {
    expect(determineMatchResult([{ scoreA: 15, scoreB: 21 }])).toBe('B_WIN');
  });

  it('should handle single tied game as DRAW', () => {
    expect(determineMatchResult([{ scoreA: 20, scoreB: 20 }])).toBe('DRAW');
  });

  it('should handle best-of-3 with A winning 2-1', () => {
    expect(
      determineMatchResult([
        { scoreA: 21, scoreB: 18 },
        { scoreA: 18, scoreB: 21 },
        { scoreA: 21, scoreB: 17 },
      ]),
    ).toBe('A_WIN');
  });

  it('should handle best-of-3 with B winning 2-1', () => {
    expect(
      determineMatchResult([
        { scoreA: 15, scoreB: 21 },
        { scoreA: 21, scoreB: 18 },
        { scoreA: 18, scoreB: 21 },
      ]),
    ).toBe('B_WIN');
  });

  it('should handle many games with ties mixed in', () => {
    // A wins 2, B wins 1, 2 ties → A_WIN
    expect(
      determineMatchResult([
        { scoreA: 21, scoreB: 18 },
        { scoreA: 20, scoreB: 20 },
        { scoreA: 18, scoreB: 21 },
        { scoreA: 20, scoreB: 20 },
        { scoreA: 21, scoreB: 15 },
      ]),
    ).toBe('A_WIN');
  });

  it('should handle score boundaries (0 vs 1)', () => {
    expect(determineMatchResult([{ scoreA: 0, scoreB: 1 }])).toBe('B_WIN');
  });

  it('should handle score boundaries (30 vs 29)', () => {
    expect(determineMatchResult([{ scoreA: 30, scoreB: 29 }])).toBe('A_WIN');
  });
});

// ===========================================================================
// determineUserResult — §6.2 个人战绩结果判定
// ===========================================================================

describe('determineUserResult', () => {
  it('should return WIN when A_WIN and user is on side A', () => {
    expect(determineUserResult('A_WIN', 'A')).toBe('WIN');
  });

  it('should return LOSE when A_WIN and user is on side B', () => {
    expect(determineUserResult('A_WIN', 'B')).toBe('LOSE');
  });

  it('should return LOSE when B_WIN and user is on side A', () => {
    expect(determineUserResult('B_WIN', 'A')).toBe('LOSE');
  });

  it('should return WIN when B_WIN and user is on side B', () => {
    expect(determineUserResult('B_WIN', 'B')).toBe('WIN');
  });

  it('should return DRAW when DRAW regardless of side A', () => {
    expect(determineUserResult('DRAW', 'A')).toBe('DRAW');
  });

  it('should return DRAW when DRAW regardless of side B', () => {
    expect(determineUserResult('DRAW', 'B')).toBe('DRAW');
  });
});
