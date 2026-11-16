/** vw-saveiro-gl-1994: career car acceptance (data, sources, dyno, standing start, art). */
import { CAR_VW_SAVEIRO_GL_1994, SAVEIRO_GL_1994_DOC, SAVEIRO_GL_1994_MASS, SAVEIRO_GL_1994_PROVENANCE } from '../../../src/data/cars/vwSaveiroGl1994';
import { AP1800_GAS_1994_DOC, AP1800_GAS_1994_TORQUE_CURVE } from '../../../src/data/engines/vwAp1800Gasoline1994';
import { campaignCarSuite } from './campaignCarSuite';

campaignCarSuite({
  car: CAR_VW_SAVEIRO_GL_1994,
  doc: SAVEIRO_GL_1994_DOC,
  engineDoc: AP1800_GAS_1994_DOC,
  curve: AP1800_GAS_1994_TORQUE_CURVE,
  provenance: SAVEIRO_GL_1994_PROVENANCE,
  mass: SAVEIRO_GL_1994_MASS,
  drive: 'front',
  body: 'pickup',
  badge: 'GL',
});
