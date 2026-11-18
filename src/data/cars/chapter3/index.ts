import type { CarConfig } from '../../schema';
import { CAR_NISSAN_350Z_2006 } from './nissan350z2006';
import { CAR_LEXUS_IS350_2015 } from './lexusIs3502015';
import { CAR_NISSAN_370Z_2014 } from './nissan370z2014';
import { CAR_MERCEDES_AMG_C43_2017 } from './mercedesAmgC432017';
import { CAR_KIA_STINGER_GT_2019 } from './kiaStingerGt2019';
import { CAR_MASERATI_GHIBLI_SQ4_2015 } from './maseratiGhibliSq42015';
import { CAR_ALFA_GIULIA_QV_2017 } from './alfaGiuliaQuadrifoglio2017';
import { CAR_NISSAN_GTR_R35_2015 } from './nissanGtrR352015';

export {
  CAR_NISSAN_350Z_2006,
  CAR_LEXUS_IS350_2015,
  CAR_NISSAN_370Z_2014,
  CAR_MERCEDES_AMG_C43_2017,
  CAR_KIA_STINGER_GT_2019,
  CAR_MASERATI_GHIBLI_SQ4_2015,
  CAR_ALFA_GIULIA_QV_2017,
  CAR_NISSAN_GTR_R35_2015,
};

/** The eight cars of Chapter 3 "Elite da Madrugada" (factory configuration, never mutated). */
export const CHAPTER3_CARS: readonly CarConfig[] = [
  CAR_NISSAN_350Z_2006,
  CAR_LEXUS_IS350_2015,
  CAR_NISSAN_370Z_2014,
  CAR_MERCEDES_AMG_C43_2017,
  CAR_KIA_STINGER_GT_2019,
  CAR_MASERATI_GHIBLI_SQ4_2015,
  CAR_ALFA_GIULIA_QV_2017,
  CAR_NISSAN_GTR_R35_2015,
];
