/** gm-corsa-gl-1996: career car acceptance (data, sources, dyno, standing start, art). */
import { CAR_GM_CORSA_GL_1996, CORSA_GL_1996_DOC, CORSA_GL_1996_MASS, CORSA_GL_1996_PROVENANCE } from '../../../src/data/cars/gmCorsaGl1996';
import { FAMILIA1_EFI_14_1996_DOC, FAMILIA1_EFI_14_1996_TORQUE_CURVE } from '../../../src/data/engines/gmFamilia1Efi14_1996';
import { campaignCarSuite } from './campaignCarSuite';

campaignCarSuite({
  car: CAR_GM_CORSA_GL_1996,
  doc: CORSA_GL_1996_DOC,
  engineDoc: FAMILIA1_EFI_14_1996_DOC,
  curve: FAMILIA1_EFI_14_1996_TORQUE_CURVE,
  provenance: CORSA_GL_1996_PROVENANCE,
  mass: CORSA_GL_1996_MASS,
  drive: 'front',
  body: 'hatch',
  badge: 'GL',
});
