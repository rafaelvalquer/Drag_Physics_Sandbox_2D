import { CAREER_CARS } from '../../data/cars/campaign';
import { transmissionKindOf } from '../career/tuning/BuildResolverV2';
import { listPrice } from '../career/chapter2/dealer';

export const ONLINE_MARKET = CAREER_CARS.map((car) => ({
  id: car.id,
  name: car.name,
  induction: car.engine.induction,
  drive: car.drivenAxle,
  transmission: transmissionKindOf(car),
  price: listPrice(car.id) ?? 2_600, // The campaign grants the Saveiro in a story event.
}));
