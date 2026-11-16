import type { ExhaustConfig } from './schema';

/**
 * Exhaust acoustic presets. They change geometry (lengths → propagation delays, diameters →
 * reflection coefficients at area changes), muffler chambers and absorption – i.e. the acoustic
 * response, not just the output volume.
 */
export type ExhaustPresetId = 'stock' | 'sport' | 'straight';

export function exhaustPreset(id: ExhaustPresetId, base: Pick<ExhaustConfig, 'layout' | 'headerPrimaryLengthM' | 'headerDiameterMm'>): ExhaustConfig {
  switch (id) {
    case 'stock':
      return {
        presetId: 'stock',
        layout: base.layout,
        headerPrimaryLengthM: base.headerPrimaryLengthM,
        headerDiameterMm: base.headerDiameterMm,
        collectorLengthM: 1.6,
        collectorDiameterMm: 55,
        mufflerChambersM: [0.11, 0.17, 0.23, 0.31],
        mufflerAbsorption: 0.62,
        resonatorLengthM: 0.42,
        tailpipeLengthM: 0.55,
        tailpipeDiameterMm: 50,
        wallLossDbPerM: 3.5,
        tailTempFraction: 0.45,
        outputGain: 1.3,
      };
    case 'sport':
      return {
        presetId: 'sport',
        layout: base.layout,
        headerPrimaryLengthM: base.headerPrimaryLengthM,
        headerDiameterMm: base.headerDiameterMm * 1.06,
        collectorLengthM: 1.3,
        collectorDiameterMm: 63,
        mufflerChambersM: [0.14, 0.26],
        mufflerAbsorption: 0.3,
        resonatorLengthM: 0.3,
        tailpipeLengthM: 0.4,
        tailpipeDiameterMm: 76,
        wallLossDbPerM: 2.2,
        tailTempFraction: 0.55,
        outputGain: 0.95,
      };
    case 'straight':
      return {
        presetId: 'straight',
        layout: base.layout,
        headerPrimaryLengthM: base.headerPrimaryLengthM,
        headerDiameterMm: base.headerDiameterMm * 1.1,
        collectorLengthM: 0.9,
        collectorDiameterMm: 70,
        mufflerChambersM: [],
        mufflerAbsorption: 0,
        resonatorLengthM: 0,
        tailpipeLengthM: 0.25,
        tailpipeDiameterMm: 89,
        wallLossDbPerM: 1.2,
        tailTempFraction: 0.65,
        outputGain: 0.75,
      };
  }
}
