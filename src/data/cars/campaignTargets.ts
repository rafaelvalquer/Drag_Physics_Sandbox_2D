import { CAR_VW_GOL_GTS_1988, GOL_GTS_1988_FACTORY } from './vwGolGts1988';
import { UNO_MILLE_1995_DOC } from './fiatUnoMille1995';
import { CELTA_2003_DOC } from './gmCelta2003';
import { CORSA_GL_1996_DOC } from './gmCorsaGl1996';
import { KADETT_SL_1992_DOC } from './gmKadettSl1992';
import { CHEVETTE_SL_1988_DOC } from './gmChevetteSl1988';
import { SAVEIRO_GL_1994_DOC } from './vwSaveiroGl1994';
import { FIASA_10_1995_DOC } from '../engines/fiatFiasa10_1995';
import { FAMILIA1_VHC_10_2003_DOC } from '../engines/gmFamilia1Vhc10_2003';
import { FAMILIA1_EFI_14_1996_DOC } from '../engines/gmFamilia1Efi14_1996';
import { FAMILIA2_18_1992_DOC } from '../engines/gmFamilia2_18_1992';
import { CHEVETTE_16S_1988_DOC } from '../engines/gmChevette16S_1988';
import { AP1800_GAS_1994_DOC } from '../engines/vwAp1800Gasoline1994';

/**
 * Documented performance targets of every campaign car and the tolerances the calibration tests
 * accept, with their justification:
 *  - power and torque peaks: < 5 % (the curve passes through the documented points; the dyno
 *    measures the physics, so the residual is the model's steady-state error);
 *  - 0–100 km/h: the sheets do not say how their figures were measured (driver, surface, payload,
 *    weather), and the game's automatic clutch launches more consistently than a human with a
 *    pedal: ± 15 % (secondary sources) and ± 12 % for the Gol's manual figure;
 *  - top speed: ± 6 % (aerodynamic data are partly estimated; one sheet gives two values for the
 *    Uno, 144 and 149 km/h).
 */
export interface CampaignTarget {
  powerCv: number;
  powerRpm: number;
  torqueNm: number;
  torqueRpm: number;
  accel0to100S: number;
  topSpeedKmh: number;
  tolerances: { peaks: number; accel: number; topSpeed: number };
  /** Payload of the acceleration test (kg): 0 for factory figures, 90 for period press tests. */
  testPayloadKg: number;
  /** Why a tolerance differs from the default, when it does. */
  note?: string;
}

const TOL = { peaks: 0.05, accel: 0.15, topSpeed: 0.06 };
const FACTORY_TOL = { peaks: 0.05, accel: 0.12, topSpeed: 0.06 };
/** Second occupant (75 kg) + instrumentation (15 kg) of a period press test. */
const PRESS = 90;

export const CAMPAIGN_TARGETS: Record<string, CampaignTarget> = {
  [CAR_VW_GOL_GTS_1988.id]: {
    powerCv: 99,
    powerRpm: 5600,
    torqueNm: 146,
    torqueRpm: 3200,
    accel0to100S: GOL_GTS_1988_FACTORY.performance.accel0to100S,
    topSpeedKmh: GOL_GTS_1988_FACTORY.performance.topSpeedKmh,
    tolerances: FACTORY_TOL,
    testPayloadKg: 0, // factory figures (owner's manual)
  },
  'fiat-uno-mille-1995': {
    powerCv: FIASA_10_1995_DOC.power.cv,
    powerRpm: FIASA_10_1995_DOC.power.rpm,
    torqueNm: FIASA_10_1995_DOC.torque.nm,
    torqueRpm: FIASA_10_1995_DOC.torque.rpm,
    accel0to100S: UNO_MILLE_1995_DOC.performance.accel0to100S,
    topSpeedKmh: UNO_MILLE_1995_DOC.performance.topSpeedKmh,
    tolerances: TOL,
    testPayloadKg: PRESS,
  },
  'gm-celta-2003': {
    powerCv: FAMILIA1_VHC_10_2003_DOC.power.cv,
    powerRpm: FAMILIA1_VHC_10_2003_DOC.power.rpm,
    torqueNm: FAMILIA1_VHC_10_2003_DOC.torque.nm,
    torqueRpm: FAMILIA1_VHC_10_2003_DOC.torque.rpm,
    accel0to100S: CELTA_2003_DOC.performance.accel0to100S,
    topSpeedKmh: CELTA_2003_DOC.performance.topSpeedKmh,
    tolerances: TOL,
    testPayloadKg: PRESS,
  },
  'gm-corsa-gl-1996': {
    powerCv: FAMILIA1_EFI_14_1996_DOC.power.cv,
    powerRpm: FAMILIA1_EFI_14_1996_DOC.power.rpm,
    torqueNm: FAMILIA1_EFI_14_1996_DOC.torque.nm,
    torqueRpm: FAMILIA1_EFI_14_1996_DOC.torque.rpm,
    accel0to100S: CORSA_GL_1996_DOC.performance.accel0to100S,
    topSpeedKmh: CORSA_GL_1996_DOC.performance.topSpeedKmh,
    tolerances: TOL,
    testPayloadKg: PRESS,
  },
  'gm-kadett-sl-1992': {
    powerCv: FAMILIA2_18_1992_DOC.power.cv,
    powerRpm: FAMILIA2_18_1992_DOC.power.rpm,
    torqueNm: FAMILIA2_18_1992_DOC.torque.nm,
    torqueRpm: FAMILIA2_18_1992_DOC.torque.rpm,
    accel0to100S: KADETT_SL_1992_DOC.performance.accel0to100S,
    topSpeedKmh: KADETT_SL_1992_DOC.performance.topSpeedKmh,
    tolerances: { ...TOL, topSpeed: 0.15 },
    note:
      'Divergência não resolvida: 98 cv a 5800 rpm com Cx 0,32 × 1,96 m² fecham o balanço de potência perto de 185–190 km/h, não 167 km/h. Pelo menos um dos três dados da ficha está errado; o torque não foi alterado para esconder isso.',
    testPayloadKg: PRESS,
  },
  'gm-chevette-sl-1988': {
    powerCv: CHEVETTE_16S_1988_DOC.power.cv,
    powerRpm: CHEVETTE_16S_1988_DOC.power.rpm,
    torqueNm: CHEVETTE_16S_1988_DOC.torque.nm,
    torqueRpm: CHEVETTE_16S_1988_DOC.torque.rpm,
    accel0to100S: CHEVETTE_SL_1988_DOC.performance.accel0to100S,
    topSpeedKmh: CHEVETTE_SL_1988_DOC.performance.topSpeedKmh,
    tolerances: TOL,
    testPayloadKg: PRESS,
  },
  'vw-saveiro-gl-1994': {
    powerCv: AP1800_GAS_1994_DOC.power.cv,
    powerRpm: AP1800_GAS_1994_DOC.power.rpm,
    torqueNm: AP1800_GAS_1994_DOC.torque.nm,
    torqueRpm: AP1800_GAS_1994_DOC.torque.rpm,
    accel0to100S: SAVEIRO_GL_1994_DOC.performance.accel0to100S,
    topSpeedKmh: SAVEIRO_GL_1994_DOC.performance.topSpeedKmh,
    tolerances: TOL,
    testPayloadKg: PRESS,
  },
};
