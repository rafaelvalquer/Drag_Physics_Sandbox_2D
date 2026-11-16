/** fiat-uno-mille-1995: career car acceptance (data, sources, dyno, standing start, art). */
import { CAR_FIAT_UNO_MILLE_1995, UNO_MILLE_1995_DOC, UNO_MILLE_1995_MASS, UNO_MILLE_1995_PROVENANCE } from '../../../src/data/cars/fiatUnoMille1995';
import { FIASA_10_1995_DOC, FIASA_10_1995_TORQUE_CURVE } from '../../../src/data/engines/fiatFiasa10_1995';
import { campaignCarSuite } from './campaignCarSuite';

campaignCarSuite({
  car: CAR_FIAT_UNO_MILLE_1995,
  doc: UNO_MILLE_1995_DOC,
  engineDoc: FIASA_10_1995_DOC,
  curve: FIASA_10_1995_TORQUE_CURVE,
  provenance: UNO_MILLE_1995_PROVENANCE,
  mass: UNO_MILLE_1995_MASS,
  drive: 'front',
  body: 'hatch',
  badge: 'Mille',
});
