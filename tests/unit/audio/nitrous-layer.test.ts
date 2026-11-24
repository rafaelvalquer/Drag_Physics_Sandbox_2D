/** The N₂O sound layer: hiss follows the flow, solenoid clicks at start/end, nothing leaks after dispose. */
import { describe, expect, it } from 'vitest';
import { NITRO_EXHAUST_GAIN, NITRO_RPM_BUMP, NITRO_SHELF_DB, NitrousLayer, NitrousVoiceState } from '../../../src/audio/core/NitrousLayer';

function fakeCtx() {
  const created = { sources: 0, started: 0, stopped: 0, disconnected: 0, targets: [] as number[] };
  const param = (): Record<string, unknown> => ({
    value: 0,
    setTargetAtTime: (v: number) => created.targets.push(v),
    setValueAtTime: () => undefined,
    cancelAndHoldAtTime: () => undefined,
    exponentialRampToValueAtTime: () => undefined,
  });
  const node = (): Record<string, unknown> => {
    const n: Record<string, unknown> = { gain: param(), frequency: param(), Q: param(), type: '', disconnect: () => created.disconnected++ };
    n.connect = (x: unknown) => x;
    return n;
  };
  const ctx = {
    sampleRate: 8000,
    currentTime: 0,
    createBuffer: (_c: number, n: number) => ({ getChannelData: () => new Float32Array(n) }),
    createBufferSource: () => {
      created.sources++;
      const n = node();
      n.start = () => created.started++;
      n.stop = () => created.stopped++;
      return n;
    },
    createBiquadFilter: node,
    createGain: node,
  };
  return { ctx: ctx as unknown as BaseAudioContext, created };
}

describe('NitrousLayer', () => {
  it('the hiss level follows the flow and is capped well under the engine', () => {
    const { ctx, created } = fakeCtx();
    const l = new NitrousLayer(ctx, {} as AudioNode);
    l.setFlow(0);
    l.setFlow(0.5);
    l.setFlow(5); // out of range is clamped
    expect(created.targets[0]).toBe(0);
    expect(created.targets[1]).toBeGreaterThan(0);
    expect(created.targets[2]).toBeGreaterThan(created.targets[1]!);
    expect(created.targets[2]).toBeLessThanOrEqual(0.15);
  });

  it('each solenoid click is one short source; dispose stops the hiss and ignores later calls', () => {
    const { ctx, created } = fakeCtx();
    const l = new NitrousLayer(ctx, {} as AudioNode);
    const before = created.sources;
    l.click(true);
    l.click(false);
    expect(created.sources - before).toBe(2);
    l.dispose();
    l.dispose();
    expect(created.stopped).toBe(3); // the two clicks end by themselves, plus the hiss
    const after = created.sources;
    l.click(true);
    l.setFlow(1);
    expect(created.sources).toBe(after);
  });
});

describe('NitrousLayer whoosh', () => {
  it('keeps at most one jet alive and releases it when the solenoid closes', () => {
    const { ctx, created } = fakeCtx();
    const l = new NitrousLayer(ctx, {} as AudioNode);
    const before = created.sources;
    l.whoosh(1);
    l.whoosh(0);
    expect(created.sources - before).toBe(1);
    l.click(false);
    expect(created.targets.at(-1)).toBe(0);
    l.dispose();
    const after = created.sources;
    l.whoosh(1);
    expect(created.sources).toBe(after);
  });
});

describe('NitrousVoiceState', () => {
  it('the attack bumps the apparent engine speed and the bump dies away', () => {
    const v = new NitrousVoiceState();
    expect(v.update(1 / 60, true, 0.5)).toBe(true); // an injection starts
    expect(v.bump).toBeCloseTo(NITRO_RPM_BUMP, 5);
    expect(v.update(1 / 60, true, 0.5)).toBe(false); // only once per injection
    for (let i = 0; i < 120; i++) v.update(1 / 60, true, 0.5);
    expect(v.bump).toBeLessThan(NITRO_RPM_BUMP * 0.05);
    for (let i = 0; i < 300; i++) v.update(1 / 60, true, 0.5);
    expect(v.bump).toBe(0);
  });

  it('the exhaust gets louder and brighter with the flow and goes back to neutral without it', () => {
    const v = new NitrousVoiceState();
    for (let i = 0; i < 120; i++) v.update(1 / 60, true, 1);
    expect(v.exhaustMul).toBeCloseTo(1 + NITRO_EXHAUST_GAIN, 2);
    expect(v.shelfDb).toBeCloseTo(NITRO_SHELF_DB, 1);
    for (let i = 0; i < 240; i++) v.update(1 / 60, false, 0);
    expect(v.exhaustMul).toBeCloseTo(1, 2);
    expect(v.shelfDb).toBeCloseTo(0, 1);
  });

  it('a new injection bumps again', () => {
    const v = new NitrousVoiceState();
    v.update(1 / 60, true, 1);
    for (let i = 0; i < 400; i++) v.update(1 / 60, true, 1);
    v.update(1 / 60, false, 0);
    expect(v.update(1 / 60, true, 1)).toBe(true);
    expect(v.bump).toBeGreaterThan(0);
  });

  it('survives bad input', () => {
    const v = new NitrousVoiceState();
    v.update(Number.NaN, true, Number.NaN);
    expect(Number.isFinite(v.bump) && Number.isFinite(v.flow)).toBe(true);
  });
});
