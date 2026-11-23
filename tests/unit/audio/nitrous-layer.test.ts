/** The N₂O sound layer: hiss follows the flow, solenoid clicks at start/end, nothing leaks after dispose. */
import { describe, expect, it } from 'vitest';
import { NitrousLayer } from '../../../src/audio/core/NitrousLayer';

function fakeCtx() {
  const created = { sources: 0, started: 0, stopped: 0, disconnected: 0, targets: [] as number[] };
  const param = (): Record<string, unknown> => ({
    value: 0,
    setTargetAtTime: (v: number) => created.targets.push(v),
    setValueAtTime: () => undefined,
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
