import type { CarConfig } from '../../schema';
import { CAR_GM_ASTRA_2011 } from './gmAstra2011';
import { CAR_PEUGEOT_208GT_2017 } from './peugeot208Gt2017';
import { CAR_VW_GOLF_GTI_2003 } from './vwGolfGti2003';
import { CAR_AUDI_A3_2005 } from './audiA3Turbo2005';
import { CAR_BMW_320I_2014 } from './bmw320i2014';
import { CAR_MERCEDES_C200_2015 } from './mercedesC2002015';
import { CAR_HONDA_CIVIC_SI_2008 } from './hondaCivicSi2008';
import { CAR_VW_JETTA_TSI_2012 } from './vwJettaTsi2012';
import { CAR_MITSUBISHI_EVO_X_2012 } from './mitsubishiEvoX2012';
import { CAR_BMW_335I_2013 } from './bmw335i2013';

export {
  CAR_GM_ASTRA_2011,
  CAR_PEUGEOT_208GT_2017,
  CAR_VW_GOLF_GTI_2003,
  CAR_AUDI_A3_2005,
  CAR_BMW_320I_2014,
  CAR_MERCEDES_C200_2015,
  CAR_HONDA_CIVIC_SI_2008,
  CAR_VW_JETTA_TSI_2012,
  CAR_MITSUBISHI_EVO_X_2012,
  CAR_BMW_335I_2013,
};

/** The ten cars of Chapter 2 "Liga da Madrugada" (factory configuration, never mutated). */
export const CHAPTER2_CARS: readonly CarConfig[] = [
  CAR_GM_ASTRA_2011,
  CAR_PEUGEOT_208GT_2017,
  CAR_VW_GOLF_GTI_2003,
  CAR_AUDI_A3_2005,
  CAR_MERCEDES_C200_2015,
  CAR_BMW_320I_2014,
  CAR_HONDA_CIVIC_SI_2008,
  CAR_VW_JETTA_TSI_2012,
  CAR_MITSUBISHI_EVO_X_2012,
  CAR_BMW_335I_2013,
];
