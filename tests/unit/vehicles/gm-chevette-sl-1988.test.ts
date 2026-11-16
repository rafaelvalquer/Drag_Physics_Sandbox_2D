/** gm-chevette-sl-1988: career car acceptance (data, sources, dyno, standing start, art). */
import { CAR_GM_CHEVETTE_SL_1988, CHEVETTE_SL_1988_DOC, CHEVETTE_SL_1988_MASS, CHEVETTE_SL_1988_PROVENANCE } from '../../../src/data/cars/gmChevetteSl1988';
import { CHEVETTE_16S_1988_DOC, CHEVETTE_16S_1988_TORQUE_CURVE } from '../../../src/data/engines/gmChevette16S_1988';
import { campaignCarSuite } from './campaignCarSuite';

campaignCarSuite({
  car: CAR_GM_CHEVETTE_SL_1988,
  doc: CHEVETTE_SL_1988_DOC,
  engineDoc: CHEVETTE_16S_1988_DOC,
  curve: CHEVETTE_16S_1988_TORQUE_CURVE,
  provenance: CHEVETTE_SL_1988_PROVENANCE,
  mass: CHEVETTE_SL_1988_MASS,
  drive: 'rear',
  body: 'sedan',
  badge: 'SL',
});
