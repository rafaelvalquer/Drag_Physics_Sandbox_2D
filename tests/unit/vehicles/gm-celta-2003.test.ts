/** gm-celta-2003: career car acceptance (data, sources, dyno, standing start, art). */
import { CAR_GM_CELTA_2003, CELTA_2003_DOC, CELTA_2003_MASS, CELTA_2003_PROVENANCE } from '../../../src/data/cars/gmCelta2003';
import { FAMILIA1_VHC_10_2003_DOC, FAMILIA1_VHC_10_2003_TORQUE_CURVE } from '../../../src/data/engines/gmFamilia1Vhc10_2003';
import { campaignCarSuite } from './campaignCarSuite';

campaignCarSuite({
  car: CAR_GM_CELTA_2003,
  doc: CELTA_2003_DOC,
  engineDoc: FAMILIA1_VHC_10_2003_DOC,
  curve: FAMILIA1_VHC_10_2003_TORQUE_CURVE,
  provenance: CELTA_2003_PROVENANCE,
  mass: CELTA_2003_MASS,
  drive: 'front',
  body: 'hatch',
  badge: 'Celta',
});
