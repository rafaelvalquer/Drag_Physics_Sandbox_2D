/** 16-bit PCM WAV encoder (mono or interleaved stereo). Used by the recorder and offline tools. */
export function encodeWav(channels: Float32Array[], sampleRate: number): Uint8Array {
  const nCh = channels.length;
  const frames = channels[0]?.length ?? 0;
  const dataBytes = frames * nCh * 2;
  const buf = new ArrayBuffer(44 + dataBytes);
  const v = new DataView(buf);
  const str = (o: number, s: string): void => {
    for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i));
  };
  str(0, 'RIFF');
  v.setUint32(4, 36 + dataBytes, true);
  str(8, 'WAVE');
  str(12, 'fmt ');
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true);
  v.setUint16(22, nCh, true);
  v.setUint32(24, sampleRate, true);
  v.setUint32(28, sampleRate * nCh * 2, true);
  v.setUint16(32, nCh * 2, true);
  v.setUint16(34, 16, true);
  str(36, 'data');
  v.setUint32(40, dataBytes, true);
  let o = 44;
  for (let i = 0; i < frames; i++) {
    for (let c = 0; c < nCh; c++) {
      const x = Math.max(-1, Math.min(1, channels[c]![i]!));
      v.setInt16(o, Math.round(x * 32767), true);
      o += 2;
    }
  }
  return new Uint8Array(buf);
}

export function encodeWavMono(samples: Float32Array, sampleRate: number): Uint8Array {
  return encodeWav([samples], sampleRate);
}
