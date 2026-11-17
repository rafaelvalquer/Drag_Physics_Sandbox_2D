/**
 * Bounded velocity-constraint solver for 1-D degrees of freedom.
 *
 * ORIGIN (MIT): adapted from ange-yaghi/simple-2d-constraint-solver (the `atg_scs` library used by
 * ange-yaghi/engine-sim), commit e009f4ff1c9c4c5874e865e893cdb62e208fb2b3:
 *   - `ClutchConstraint`, `RotationFrictionConstraint`, `StarterMotor`, `Dynamometer`,
 *     `VehicleDragConstraint` all describe a Jacobian row, a velocity bias and torque limits
 *     [m_minTorque, m_maxTorque]; see third_party/simple-2d-constraint-solver/src/*.cpp.
 *   - `GaussSeidelSleSolver::solveWithLimits` solves J·W·Jᵀ·λ = rhs with projected Gauss–Seidel,
 *     clamping every λ to its limits.
 * CHANGES: engine-sim solves 2-D rigid bodies at acceleration level with Baumgarte terms (ks, kd).
 * Our drivetrain only needs scalar DOFs (crank ω, driveline ω, vehicle v), so the solver works at
 * velocity level inside a semi-implicit Euler step and adds constraint-force mixing (CFM) so that
 * a row can also represent a linearized compliant force (used by the tire model).
 *
 *   v⁺ = v* + h·M⁻¹·Jᵀ·λ,     J·v⁺ + cfm·λ = bias,     lo ≤ λ ≤ hi
 *
 * λ is a force (N) or torque (N·m) applied during the step.
 */

export class Dof {
  /** Velocity (rad/s for rotational DOFs, m/s for linear DOFs). */
  v = 0;
  invMass: number;
  constructor(
    public readonly name: string,
    massOrInertia: number,
  ) {
    this.invMass = massOrInertia > 0 ? 1 / massOrInertia : 0;
  }
  setMass(massOrInertia: number): void {
    this.invMass = massOrInertia > 0 ? 1 / massOrInertia : 0;
  }
}

export class ConstraintRow {
  enabled = true;
  dofA: Dof | null = null;
  jA = 0;
  dofB: Dof | null = null;
  jB = 0;
  /** Optional third DOF (a differential: one input shared by two outputs). */
  dofC: Dof | null = null;
  jC = 0;
  bias = 0;
  cfm = 0;
  lo = -Infinity;
  hi = Infinity;
  /** Solved force/torque of the last step. */
  lambda = 0;
  private effMassInv = 0;

  constructor(public readonly name: string) {}

  set1(dof: Dof, j: number): this {
    this.dofA = dof;
    this.jA = j;
    this.dofB = null;
    this.jB = 0;
    this.dofC = null;
    this.jC = 0;
    return this;
  }

  set2(a: Dof, ja: number, b: Dof, jb: number): this {
    this.dofA = a;
    this.jA = ja;
    this.dofB = b;
    this.jB = jb;
    this.dofC = null;
    this.jC = 0;
    return this;
  }

  set3(a: Dof, ja: number, b: Dof, jb: number, c: Dof, jc: number): this {
    this.dofA = a;
    this.jA = ja;
    this.dofB = b;
    this.jB = jb;
    this.dofC = c;
    this.jC = jc;
    return this;
  }

  /** J·v */
  jv(): number {
    let s = 0;
    if (this.dofA) s += this.jA * this.dofA.v;
    if (this.dofB) s += this.jB * this.dofB.v;
    if (this.dofC) s += this.jC * this.dofC.v;
    return s;
  }

  /**
   * @internal Computes the effective mass and applies the warm-start force (previous solution
   * clamped to the new limits), like `GaussSeidelSleSolver::solveWithLimits(…, previous)`.
   */
  prepare(h: number, warmStart: boolean): void {
    let k = 0;
    if (this.dofA) k += this.jA * this.jA * this.dofA.invMass;
    if (this.dofB) k += this.jB * this.jB * this.dofB.invMass;
    if (this.dofC) k += this.jC * this.jC * this.dofC.invMass;
    const denom = h * k + this.cfm;
    this.effMassInv = denom > 1e-12 ? 1 / denom : 0;
    let l = warmStart && Number.isFinite(this.lambda) ? this.lambda : 0;
    if (l < this.lo) l = this.lo;
    else if (l > this.hi) l = this.hi;
    this.lambda = l;
    if (l !== 0) {
      if (this.dofA) this.dofA.v += h * this.dofA.invMass * this.jA * l;
      if (this.dofB) this.dofB.v += h * this.dofB.invMass * this.jB * l;
      if (this.dofC) this.dofC.v += h * this.dofC.invMass * this.jC * l;
    }
  }

  /** @internal one projected Gauss–Seidel update, returns |Δλ| */
  iterate(h: number): number {
    if (this.effMassInv === 0) return 0;
    const residual = this.bias - (this.jv() + this.cfm * this.lambda);
    const prev = this.lambda;
    let next = prev + residual * this.effMassInv;
    if (next < this.lo) next = this.lo;
    else if (next > this.hi) next = this.hi;
    const d = next - prev;
    if (d !== 0) {
      this.lambda = next;
      if (this.dofA) this.dofA.v += h * this.dofA.invMass * this.jA * d;
      if (this.dofB) this.dofB.v += h * this.dofB.invMass * this.jB * d;
      if (this.dofC) this.dofC.v += h * this.dofC.invMass * this.jC * d;
    }
    return Math.abs(d);
  }
}

export class ConstraintSolver {
  maxIterations = 400;
  /** Convergence threshold on |Δλ| (N or N·m). */
  minDelta = 1e-4;
  warmStart = true;
  lastIterations = 0;
  lastConverged = true;

  solve(rows: readonly ConstraintRow[], h: number): boolean {
    for (const r of rows) {
      if (r.enabled) r.prepare(h, this.warmStart);
      else r.lambda = 0;
    }
    this.lastConverged = this.iterate(rows, h);
    return this.lastConverged;
  }

  private iterate(rows: readonly ConstraintRow[], h: number): boolean {
    for (let it = 0; it < this.maxIterations; it++) {
      let maxDelta = 0;
      for (const r of rows) {
        if (!r.enabled) continue;
        const d = r.iterate(h);
        if (d > maxDelta) maxDelta = d;
      }
      if (maxDelta < this.minDelta) {
        this.lastIterations = it + 1;
        return true;
      }
    }
    this.lastIterations = this.maxIterations;
    return false;
  }
}
