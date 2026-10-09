import { describe, expect, it } from 'vitest';
import { defaultConfig, resolveConfig } from '../../src/config/defaultConfig';
import {
  blockFactor, dayEnergy, effectiveBetween, effectiveMinutes, energyFactor, sleepBefore, slotFactor, timeOfDayMultiplier,
} from '../../src/domain/energy';
import { MON, TUE, WED, block, data, h, session, shift, timeline } from '../helpers';

describe('energy factor', () => {
  it('uses the documented table: 1 -> 0.35, 2 -> 0.55, 3 -> 0.75, 4 -> 0.90, 5 -> 1.00', () => {
    expect([1, 2, 3, 4, 5].map((l) => energyFactor(l as 1, defaultConfig))).toEqual([0.35, 0.55, 0.75, 0.9, 1.0]);
  });

  it('energy logged as missing falls back to the baseline level (3 -> 0.75)', () => {
    expect(energyFactor(null, defaultConfig)).toBe(0.75);
    expect(energyFactor(undefined, defaultConfig)).toBe(0.75);
  });

  it('a 3 h block at energy 2 counts as 3 x 0.55 = 1.65 focused hours (99 min)', () => {
    const tl = timeline(data({ blocks: [block(MON, h(20), 180, { energy: 2, status: 'done' })] }));
    expect(effectiveMinutes(tl, tl.blocks[0])).toBeCloseTo(99);
  });

  it('logged energy on a block beats the prediction, even in a late slot', () => {
    // 22:00 would predict 0.75 x 0.70 = 0.525, but the user logged 5.
    const tl = timeline(data({ blocks: [block(MON, h(21, 30), 60, { energy: 5, status: 'done' })] }));
    expect(blockFactor(tl, tl.blocks[0])).toBe(1.0);
  });

  it('factors are configurable without touching logic', () => {
    const config = resolveConfig({ energy: { factors: { 2: 0.5 } } });
    expect(energyFactor(2, config)).toBe(0.5);
    expect(energyFactor(4, config)).toBe(0.9); // untouched values keep their defaults
  });
});

describe('time of day', () => {
  it('morning 1.00, afternoon 0.90, evening 0.85, late 0.70 (the late band wraps past midnight)', () => {
    expect(timeOfDayMultiplier(h(9), defaultConfig)).toBe(1.0);
    expect(timeOfDayMultiplier(h(14), defaultConfig)).toBe(0.9);
    expect(timeOfDayMultiplier(h(19), defaultConfig)).toBe(0.85);
    expect(timeOfDayMultiplier(h(23), defaultConfig)).toBe(0.7);
    expect(timeOfDayMultiplier(h(2), defaultConfig)).toBe(0.7);
  });

  it('an unlogged block is predicted from its midpoint: Mon 09:00-12:00 -> 0.75 x 1.00, 3 h counts as 2.25 h', () => {
    const tl = timeline(data({ blocks: [block(MON, h(9), 180)] }));
    expect(effectiveMinutes(tl, tl.blocks[0])).toBeCloseTo(135);
  });
});

describe('fatigue carryover', () => {
  it('hard training on Monday multiplies Tuesday by 0.90: 0.75 -> 0.675', () => {
    const tl = timeline(data({ trainingSessions: [session(MON, h(18), { intensity: 3, name: 'Legs' })] }));
    const tue = dayEnergy(tl, 1);
    expect(tue.factor).toBeCloseTo(0.675);
    expect(tue.parts.map((p) => p.label)).toContain('Legs yesterday');
    expect(dayEnergy(tl, 2).factor).toBeCloseTo(0.75); // one day deep: Wednesday is back to baseline
  });

  it('moderate training carries x0.97 and light training carries nothing', () => {
    expect(dayEnergy(timeline(data({ trainingSessions: [session(MON, h(18), { intensity: 2 })] })), 1).factor).toBeCloseTo(0.7275);
    expect(dayEnergy(timeline(data({ trainingSessions: [session(MON, h(18), { intensity: 1 })] })), 1).factor).toBeCloseTo(0.75);
  });

  it('late night: a shift to 01:00 leaves 6 h of the 23:00-07:00 window, under 6.5 h -> x0.85', () => {
    const tl = timeline(data({ shifts: [shift(MON, h(19), h(1))] }));
    expect(sleepBefore(tl, 1).minutes).toBe(360);
    expect(dayEnergy(tl, 1).factor).toBeCloseTo(0.75 * 0.85);
  });

  it('hard training and a short night stack: 0.75 x 0.90 x 0.85 = 0.574', () => {
    const tl = timeline(data({
      trainingSessions: [session(MON, h(17), { intensity: 3 })],
      shifts: [shift(MON, h(19), h(1))],
    }));
    expect(dayEnergy(tl, 1).factor).toBeCloseTo(0.57375);
  });

  it('carryover never drops below the floor (0.60 of baseline)', () => {
    const config = resolveConfig({ carryover: { trainingMultiplier: { 3: 0.5 }, shortNightMultiplier: 0.5 } });
    const tl = timeline(
      data({ trainingSessions: [session(MON, h(17), { intensity: 3 })], shifts: [shift(MON, h(19), h(1))] }),
      undefined,
      config,
    );
    expect(dayEnergy(tl, 1).factor).toBeCloseTo(0.75 * 0.6);
  });

  it('a morning check-in replaces the prediction, so fatigue is not counted twice', () => {
    const d = data({
      trainingSessions: [session(MON, h(17), { intensity: 3 })],
      dayLogs: [{ id: 'l1', date: TUE, energy: 5, sleepHours: null }],
    });
    const tue = dayEnergy(timeline(d), 1);
    expect(tue.factor).toBe(1.0);
    expect(tue.logged).toBe(true);
  });

  it('logged sleep hours beat the estimate in both directions', () => {
    const lateShift = [shift(MON, h(19), h(1))];
    const sleptFine = data({ shifts: lateShift, dayLogs: [{ id: 'l1', date: TUE, energy: null, sleepHours: 8 }] });
    expect(dayEnergy(timeline(sleptFine), 1).factor).toBeCloseTo(0.75);
    const sleptBadly = data({ dayLogs: [{ id: 'l2', date: TUE, energy: null, sleepHours: 5 }] });
    expect(dayEnergy(timeline(sleptBadly), 1).factor).toBeCloseTo(0.75 * 0.85);
  });

  it('the two hours after a hard session are dipped by 0.85', () => {
    const tl = timeline(data({ trainingSessions: [session(WED, h(9), { intensity: 3 })] }));
    expect(slotFactor(tl, 2 * 1440 + h(10, 30))).toBeCloseTo(0.75 * 1.0 * 0.85);
    expect(slotFactor(tl, 2 * 1440 + h(12, 30))).toBeCloseTo(0.75 * 0.9); // dip over, afternoon band
  });
});

describe('effective hours over a period', () => {
  it('splits done from planned', () => {
    const tl = timeline(data({
      blocks: [block(MON, h(9), 120, { status: 'done', energy: 4 }), block(TUE, h(9), 60)],
    }));
    const totals = effectiveBetween(tl, 0, 7 * 1440);
    expect(totals.doneMin).toBeCloseTo(108); // 120 x 0.90
    expect(totals.plannedMin).toBeCloseTo(45); // 60 x 0.75
  });
});
