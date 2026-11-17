import type { CarConfig } from '../schema';
import { CAR_VW_GOL_GTS_1988 } from './vwGolGts1988';
import { CAR_FIAT_UNO_MILLE_1995 } from './fiatUnoMille1995';
import { CAR_GM_CELTA_2003 } from './gmCelta2003';
import { CAR_GM_CORSA_GL_1996 } from './gmCorsaGl1996';
import { CAR_GM_KADETT_SL_1992 } from './gmKadettSl1992';
import { CAR_GM_CHEVETTE_SL_1988 } from './gmChevetteSl1988';
import { CAR_VW_SAVEIRO_GL_1994 } from './vwSaveiroGl1994';
import { CHAPTER2_CARS } from './chapter2/index';

export { CAR_FIAT_UNO_MILLE_1995, CAR_GM_CELTA_2003, CAR_GM_CORSA_GL_1996, CAR_GM_KADETT_SL_1992, CAR_GM_CHEVETTE_SL_1988, CAR_VW_SAVEIRO_GL_1994 };

/**
 * Catalogue of the real cars of the campaign (factory configuration, never mutated). The Gol GTS
 * 1988 is the same object the Sandbox uses (no duplicate). These cars are kept out of the Sandbox
 * lists so the existing modes stay exactly as they were.
 */
export const CAMPAIGN_CARS: readonly CarConfig[] = [
  CAR_VW_GOL_GTS_1988,
  CAR_FIAT_UNO_MILLE_1995,
  CAR_GM_CHEVETTE_SL_1988,
  CAR_GM_CELTA_2003,
  CAR_GM_CORSA_GL_1996,
  CAR_GM_KADETT_SL_1992,
  CAR_VW_SAVEIRO_GL_1994,
];

/** Chapter 1 "Madrugada Zero" cars (career only). */
export const CHAPTER1_CARS: readonly CarConfig[] = CAMPAIGN_CARS;

/** Every career car of every chapter (lookup by id for saves, rivals and the garage). */
export const CAREER_CARS: readonly CarConfig[] = [...CAMPAIGN_CARS, ...CHAPTER2_CARS];

export function findCampaignCar(id: string): CarConfig | undefined {
  return CAREER_CARS.find((c) => c.id === id);
}
