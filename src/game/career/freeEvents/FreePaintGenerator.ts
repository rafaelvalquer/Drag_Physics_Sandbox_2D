import type { Prng } from '../../../core/prng';
import { pick } from './FreeEventCatalog';

const PAINTS = [
  ['Vermelho rubi', '#bb2338'], ['Vermelho vivo', '#d7383c'], ['Verde metálico', '#2b964b'],
  ['Verde jade', '#3c8a74'], ['Azul oceano', '#267ec0'], ['Azul meia-noite', '#243458'],
  ['Amarelo dourado', '#ffe17b'], ['Branco gelo', '#f1f1e9'], ['Prata metálico', '#b6c6d4'],
  ['Preto grafite', '#222a38'], ['Roxo ametista', '#ad5fcb'], ['Laranja cobre', '#ee7f39'],
  ['Bronze', '#935c43'], ['Bege champanhe', '#eac6a5'], ['Cinza ardósia', '#616876'],
] as const;
const ACCENTS = ['#191f2c', '#f4f2e9', '#d8dfe8', '#383b42', '#b6c6d4', '#823247', '#f2d68f'];

function luminance(hex: string): number {
  return [0.2126, 0.7152, 0.0722].reduce((sum, weight, i) => {
    const v = parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16) / 255;
    return sum + weight * (v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4));
  }, 0);
}

export function paintContrast(color: string, accent: string): number {
  const a = luminance(color) + 0.05;
  const b = luminance(accent) + 0.05;
  return Math.max(a, b) / Math.min(a, b);
}

export function generateFreePaint(rng: Prng, previousColor?: string) {
  const [name, color] = pick(PAINTS.filter(([, hex]) => hex !== previousColor), rng);
  return { name, paint: { color, accent: pick(ACCENTS.filter((hex) => paintContrast(color, hex) >= 3), rng) } };
}
