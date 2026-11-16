/** gm-kadett-sl-1992: career car acceptance (data, sources, dyno, standing start, art). */
import { CAR_GM_KADETT_SL_1992, KADETT_SL_1992_DOC, KADETT_SL_1992_MASS, KADETT_SL_1992_PROVENANCE } from '../../../src/data/cars/gmKadettSl1992';
import { FAMILIA2_18_1992_DOC, FAMILIA2_18_1992_TORQUE_CURVE } from '../../../src/data/engines/gmFamilia2_18_1992';
import { campaignCarSuite } from './campaignCarSuite';

campaignCarSuite({
  car: CAR_GM_KADETT_SL_1992,
  doc: KADETT_SL_1992_DOC,
  engineDoc: FAMILIA2_18_1992_DOC,
  curve: FAMILIA2_18_1992_TORQUE_CURVE,
  provenance: KADETT_SL_1992_PROVENANCE,
  mass: KADETT_SL_1992_MASS,
  drive: 'front',
  body: 'hatch',
  badge: 'SL',
});
