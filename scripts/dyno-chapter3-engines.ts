/** Dyno peaks of the eight Chapter 3 engines against the documented figures. Usage: npx tsx scripts/dyno-chapter3-engines.ts */
import * as E from '../src/data/engines/chapter3/index';
import { EngineSchema } from '../src/data/schema';
import { EngineDyno } from '../src/physics/engine/EngineDyno';

const ROWS = [
  [E.ENGINE_NISSAN_VQ35DE, E.VQ35DE_DOC],
  [E.ENGINE_TOYOTA_2GR_FSE, E.GR2_FSE_DOC],
  [E.ENGINE_NISSAN_VQ37VHR, E.VQ37VHR_DOC],
  [E.ENGINE_MERCEDES_M276, E.M276_BITURBO_DOC],
  [E.ENGINE_KIA_LAMBDA_33, E.LAMBDA_33_TGDI_DOC],
  [E.ENGINE_MASERATI_F160, E.F160_DOC],
  [E.ENGINE_ALFA_690T, E.ALFA_690T_DOC],
  [E.ENGINE_NISSAN_VR38DETT, E.VR38DETT_DOC],
] as const;

for (const [eng, doc] of ROWS) {
  const v = EngineSchema.safeParse(eng);
  if (!v.success) {
    console.log(eng.id, 'INVALID', v.error.issues.map((i) => i.path.join('.') + ': ' + i.message));
    continue;
  }
  const d = new EngineDyno(eng);
  d.start();
  let t = { rpm: 0, v: 0 };
  let p = { rpm: 0, v: 0 };
  for (let rpm = 1200; rpm <= eng.revLimitRpm; rpm += 100) {
    const m = d.measure(rpm, 1, 1 / 120, eng.induction === 'turbo' ? 1.5 : 0.6, 0.15);
    if (m.torqueNm > t.v) t = { rpm, v: m.torqueNm };
    if (m.powerCv > p.v) p = { rpm, v: m.powerCv };
  }
  const dp = (p.v / doc.power.cv - 1) * 100;
  const dt = (t.v / doc.torque.nm - 1) * 100;
  console.log(
    `${eng.id.padEnd(28)} doc ${doc.power.cv.toFixed(1)}cv@${doc.power.rpm} ${doc.torque.nm.toFixed(0)}Nm@${doc.torque.rpm} | dyno ${p.v.toFixed(1)}cv@${p.rpm} ${t.v.toFixed(0)}Nm@${t.rpm} | ${dp >= 0 ? '+' : ''}${dp.toFixed(1)}% / ${dt >= 0 ? '+' : ''}${dt.toFixed(1)}%`,
  );
}
