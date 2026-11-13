import { describe, expect, it } from 'vitest';
import { ConstraintRow, ConstraintSolver, Dof } from '../../../src/physics/solver/ConstraintSolver';

const H = 1 / 120;

/** Two inertias coupled by a clutch with bounded torque (engine-sim ClutchConstraint). */
function clutchPair(capacity: number) {
  const a = new Dof('engine', 0.2);
  const b = new Dof('load', 1.0);
  const row = new ConstraintRow('clutch').set2(a, 1, b, -1);
  row.lo = -capacity;
  row.hi = capacity;
  return { a, b, row, solver: new ConstraintSolver() };
}

describe('bounded velocity constraint solver', () => {
  it('locks two shafts when the capacity is sufficient and conserves momentum', () => {
    const { a, b, row, solver } = clutchPair(1e6);
    a.v = 300;
    b.v = 0;
    const L0 = 0.2 * a.v + 1.0 * b.v;
    solver.solve([row], H);
    expect(a.v - b.v).toBeCloseTo(0, 6);
    expect(0.2 * a.v + 1.0 * b.v).toBeCloseTo(L0, 6);
  });

  it('transmits at most the capacity while slipping (T = clamp(T_req, −T_cap, T_cap))', () => {
    const cap = 50;
    const { a, b, row, solver } = clutchPair(cap);
    a.v = 300;
    b.v = 0;
    solver.solve([row], H);
    // torque applied this step equals the capacity
    expect(-row.lambda).toBeCloseTo(cap, 6);
    expect(a.v).toBeCloseTo(300 - (cap * H) / 0.2, 6);
    expect(b.v).toBeCloseTo((cap * H) / 1.0, 6);
  });

  it('never adds kinetic energy through a friction constraint', () => {
    const { a, b, row, solver } = clutchPair(80);
    a.v = 250;
    b.v = 10;
    let e = 0.5 * 0.2 * a.v ** 2 + 0.5 * b.v ** 2;
    for (let i = 0; i < 600; i++) {
      solver.solve([row], H);
      const e1 = 0.5 * 0.2 * a.v ** 2 + 0.5 * b.v ** 2;
      expect(e1).toBeLessThanOrEqual(e + 1e-9);
      e = e1;
    }
    expect(Math.abs(a.v - b.v)).toBeLessThan(1e-6);
  });

  it('a one-sided friction row stops a body exactly at rest (no reversal)', () => {
    const d = new Dof('body', 1000);
    const roll = new ConstraintRow('rolling').set1(d, 1);
    roll.lo = -200;
    roll.hi = 200;
    d.v = 0.05;
    const s = new ConstraintSolver();
    // the bound removes at most 200 N · h / 1000 kg per step
    s.solve([roll], H);
    expect(d.v).toBeCloseTo(0.05 - (200 * H) / 1000, 12);
    for (let i = 0; i < 60; i++) {
      s.solve([roll], H);
      expect(d.v).toBeGreaterThanOrEqual(0);
    }
    expect(d.v).toBe(0);
  });

  it('soft constraint (CFM) behaves like a damper of coefficient 1/cfm', () => {
    const d = new Dof('x', 2);
    const row = new ConstraintRow('damper').set1(d, 1);
    const c = 40; // N·s/m
    row.cfm = 1 / c;
    d.v = 1;
    new ConstraintSolver().solve([row], H);
    // implicit damper: v1 = v0 / (1 + h·c/m)
    expect(d.v).toBeCloseTo(1 / (1 + (H * c) / 2), 6);
  });
});
