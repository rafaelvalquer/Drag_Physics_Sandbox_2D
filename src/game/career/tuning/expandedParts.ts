import type { ExpandedPart, MechanicalMods, UnlockId } from './parts';

/**
 * Catalogue extension. Each entry describes hardware changes, not a direct horsepower bonus.
 * `description` is the shop text (what the part is and what it is for); the "Efeito físico" text is
 * generated from the very numbers the resolver applies (describeMods), plus an optional note, so it
 * can never disagree with the physics.
 */
type Spec = [id: string, category: ExpandedPart['category'], name: string, chapter: 1 | 2 | 3, price: number, unlock: UnlockId, mod: MechanicalMods, description: string, note?: string];
const specs: Spec[] = [
  ['filter-cone', 'intake-filter', 'Filtro cônico premium', 2, 780, 'part-filter', { filterDropKPa: 0.6 }, 'Filtro cônico de algodão fora da caixa original: respira mais ar em plena carga.'],
  ['filter-direct', 'intake-filter', 'Admissão direta', 3, 1450, 'part-filter', { filterDropKPa: 0.35, throttleResponseScale: 0.96 }, 'Tomada de ar de competição com duto curto até a borboleta.', 'Mais ruído de admissão.'],
  ['manifold-highflow', 'intake-manifold', 'Coletor de alto fluxo', 2, 1700, 'part-manifold', { runnerLengthScale: 0.75, runnerDiameterAddMm: 5, plenumScale: 1.42 }, 'Coletor de admissão de dutos curtos e largos, plenum grande.', 'A ressonância sobe de rotação: ganha em cima, perde um pouco embaixo.'],
  ['throttle-rework', 'intake-throttle', 'Borboleta retrabalhada', 1, 530, 'part-manifold', { throttleDiameterAddMm: 2, throttleResponseScale: 0.96 }, 'Corpo de borboleta original alargado e polido.'],
  ['throttle-large', 'intake-throttle', 'Borboleta ampliada', 2, 1280, 'part-manifold', { throttleDiameterAddMm: 6, throttleResponseScale: 0.93 }, 'Corpo de borboleta de diâmetro maior, com eixo afinado.'],
  ['airbox-performance', 'intake-airbox', 'Caixa de ar esportiva', 1, 460, 'part-filter', { filterDropReductionKPa: 0.3, airboxVolumeScale: 1.12 }, 'Caixa de ar original com bocal maior e entrada direcionada ao ar frio.'],
  ['airbox-race', 'intake-airbox', 'Caixa de ar competição', 3, 1450, 'part-filter', { filterDropReductionKPa: 0.5, airboxVolumeScale: 1.35 }, 'Caixa de fibra de grande volume, alimentada pelo para-choque.'],
  ['cam-street-strong', 'camshaft', 'Comando street forte', 2, 1580, 'part-cam', { camIvoDeltaDeg: -8, camIvcDeltaDeg: 16, camEvoDeltaDeg: -10, camEvcDeltaDeg: 11, camLiftAddMm: 1.65, revLimitAddRpm: 500 }, 'Comando de rua bravo, para quem quer giro alto sem abrir mão de andar na cidade.', 'Ganha da média rotação para cima; a marcha lenta fica irregular e perde um pouco embaixo.'],
  ['cam-na-race', 'camshaft', 'Comando aspirado agressivo', 3, 2500, 'part-cam', { camIvoDeltaDeg: -12, camIvcDeltaDeg: 23, camEvoDeltaDeg: -13, camEvcDeltaDeg: 15, camLiftAddMm: 2.1, revLimitAddRpm: 650 }, 'Comando de competição para motor aspirado preparado.', 'Muito cruzamento: forte em alta, fraco abaixo da faixa de torque.'],
  ['cam-turbo', 'camshaft', 'Comando turbo', 3, 2350, 'part-cam', { camIvoDeltaDeg: -3, camIvcDeltaDeg: 9, camEvoDeltaDeg: -6, camEvcDeltaDeg: 5, camLiftAddMm: 1.4, revLimitAddRpm: 450 }, 'Comando de pouco cruzamento, feito para motor sobrealimentado.', 'Pouco cruzamento: não deixa o ar pressurizado escapar pela válvula de escape.'],
  ['head-street', 'engine-head', 'Cabeçote retrabalhado leve', 2, 1900, 'part-cam', { headFlowScale: 1.045 }, 'Dutos de admissão e escape limpos e casados com as juntas.'],
  ['head-race', 'engine-head', 'Cabeçote retrabalhado completo', 3, 3400, 'part-cam', { headFlowScale: 1.09 }, 'Cabeçote de competição: dutos alargados, sedes retrabalhadas e válvulas maiores.'],
  ['compression-high', 'engine-compression', 'Taxa alta aspirada', 3, 2200, 'part-cam', { compressionRatioDelta: 0.7 }, 'Cabeçote rebaixado para motor aspirado.', 'Ciclo Otto mais eficiente em toda a faixa; não aceita turbo com gasolina.'],
  ['compression-low', 'engine-compression', 'Taxa baixa turbo', 3, 2400, 'part-turbo', { compressionRatioDelta: -1.2, wastegateHoldAddBar: 0.12 }, 'Pistões de cabeça rebaixada para motor turbo de pressão alta.', 'Com menos taxa o motor aceita mais pressão sem detonar, e o mapa segura a pressão mais alta. Só para motor com kit turbo.'],
  ['rods-reinforced', 'engine-internals', 'Bielas reforçadas', 3, 3100, 'part-turbo', { internalTorqueLimitNm: 310, coolingFrictionScale: 0.985 }, 'Bielas forjadas com bronzinas de competição.', 'Base para turbo de pressão alta; sozinhas, só o atrito menor das bronzinas.'],
  ['pistons-forged', 'engine-internals', 'Pistões forjados', 3, 3500, 'part-turbo', { internalTorqueLimitNm: 340, coolingFrictionScale: 0.975 }, 'Pistões forjados leves com anéis de baixa tensão.', 'Base para turbo de pressão alta; sozinhos, ganham pelo atrito menor dos anéis.'],
  ['forged-kit', 'engine-internals', 'Kit forjado completo', 3, 6600, 'part-turbo', { internalTorqueLimitNm: 460, coolingFrictionScale: 0.96 }, 'Pistões, bielas e virabrequim forjados e balanceados.', 'Base para os kits turbo fortes; sozinho, ganha pelo conjunto balanceado e de baixo atrito.'],
  ['flywheel-light', 'engine-flywheel', 'Volante aliviado leve', 1, 800, 'part-clutch', { flywheelInertiaScale: 0.93 }, 'Volante original usinado para tirar massa da borda.'],
  ['flywheel-sport', 'engine-flywheel', 'Volante aliviado esportivo', 3, 1750, 'part-clutch', { flywheelInertiaScale: 0.88 }, 'Volante de aço forjado leve.', 'Sobe de giro rápido; guarda menos energia para a largada.'],
  ['header-4x1', 'exhaust-header', 'Coletor 4×1', 1, 700, 'part-exhaust', { backPressureReductionKPa: 1.3, headerDiameterScale: 1.05 }, 'Coletor de escape de tubos de aço com os quatro primários juntando num só.'],
  ['header-421', 'exhaust-header', 'Coletor 4×2×1', 2, 1200, 'part-exhaust', { backPressureReductionKPa: 2, headerDiameterScale: 1.07 }, 'Coletor em dois estágios, que junta os cilindros aos pares antes do tubo único.'],
  ['pipe-sport', 'exhaust-pipe', 'Tubulação esportiva', 1, 610, 'part-exhaust', { backPressureReductionKPa: 1.2, exhaustDiameterScale: 1.06 }, 'Tubulação de escape de diâmetro maior, com curvas de raio longo.'],
  ['pipe-race', 'exhaust-pipe', 'Tubulação dimensionada', 3, 1750, 'part-exhaust', { backPressureReductionKPa: 2.2, exhaustDiameterScale: 1.15 }, 'Tubulação de competição em inox, dimensionada para a vazão do motor.'],
  ['muffler-sport', 'exhaust-muffler', 'Abafador esportivo', 1, 390, 'part-exhaust', { backPressureReductionKPa: 1, exhaustAbsorptionScale: 0.75 }, 'Abafador de fluxo direto com lã de rocha.', 'O ronco fica mais aberto.'],
  ['muffler-straight', 'exhaust-muffler', 'Escape direto', 3, 780, 'part-exhaust', { backPressureReductionKPa: 1.8, exhaustAbsorptionScale: 0.28 }, 'Tubo reto sem abafador.', 'Muito alto: som de competição.'],
  ['clutch-ceramic-street', 'clutch', 'Embreagem cerâmica leve', 2, 1650, 'part-clutch', { clutchCapacityScale: 1.85, clutchEngageRateScale: 1.55, clutchLaunchAddRpm: 280, clutchEngineInertiaScale: 0.94 }, 'Disco de cerâmica de rua com platô reforçado.'],
  ['clutch-ceramic-race', 'clutch', 'Embreagem cerâmica competição', 3, 2850, 'part-clutch', { clutchCapacityScale: 2.4, clutchEngageRateScale: 2, clutchLaunchAddRpm: 400, clutchEngineInertiaScale: 0.92 }, 'Disco multidisco de cerâmica e platô de competição.'],
  ['diff-short-strong', 'differential', 'Relação final curta forte', 2, 1700, 'part-differential', { finalDriveScale: 1.22, drivelineEfficiencyAdd: 0.012 }, 'Coroa e pinhão bem mais curtos, escolhidos para o carro.', 'A oficina fica com a relação que leva o carro mais rápido aos 402 m: mais força nas rodas sem uma troca a mais antes da linha.'],
  ['diff-long', 'differential', 'Relação final longa', 2, 1500, 'part-differential', { finalDriveScale: 0.92, drivelineEfficiencyAdd: 0.01 }, 'Coroa e pinhão mais longos, escolhidos para o carro.', 'A oficina fica com a relação que leva o carro mais rápido aos 402 m, de preferência com uma troca a menos.'],
  ['gearbox-street', 'transmission-gearbox', 'Câmbio escalonado street', 2, 2300, 'workshop-transmission', { gearSpreadScale: 0.94, drivelineEfficiencyAdd: 0.01 }, 'Engrenagens intermediárias de relação mais próxima.'],
  ['gearbox-race', 'transmission-gearbox', 'Câmbio escalonado arrancada', 3, 4000, 'workshop-transmission', { gearSpreadScale: 0.84, drivelineEfficiencyAdd: 0.015 }, 'Jogo de engrenagens de arrancada, com as intermediárias bem próximas.'],
  ['tires-slick-light', 'tires', 'Slick leve', 3, 3200, 'part-tires-semislick', { tireMuScale: 1.55, tireInertiaAddKgM2: -0.05, tireOptimalTempC: 95, tireTempSensitivity: 0.004 }, 'Slick de arrancada em roda leve.', 'Aderência máxima quando quente.'],
  ['tires-width-1', 'tires-width', 'Largura +1', 1, 1000, 'part-tires-sport', { tireMuScale: 1.035, tireInertiaAddKgM2: 0.01, tireRollingScale: 0.97 }, 'Pneu e roda um número mais largos.'],
  ['tires-width-2', 'tires-width', 'Largura +2', 2, 2000, 'part-tires-sport', { tireMuScale: 1.075, tireInertiaAddKgM2: 0.02, tireRollingScale: 0.95 }, 'Pneu e roda dois números mais largos.'],
  ['tires-pressure-street', 'tires-pressure', 'Pressão ajustada rua', 1, 250, 'part-tires-sport', { tireStiffnessScale: 1.05, tireTempSensitivityScale: 0.95, tireRollingScale: 0.93 }, 'Calibragem dos pneus feita para arrancada de rua.'],
  ['tires-pressure-track', 'tires-pressure', 'Pressão ajustada pista', 3, 460, 'part-tires-semislick', { tireStiffnessScale: 1.1, tireTempSensitivityScale: 0.85, tireRollingScale: 0.9 }, 'Calibragem de pista, feita para composto quente.'],
  ['turbo-street', 'turbo', 'Kit turbo street', 2, 7200, 'part-turbo', { turboBoostBar: 0.75, turboSpoolScale: 1.12, turboMassAddKg: 22, intercoolerEffectiveness: 0.65 }, 'Kit turbo de rua com turbina maior que a do kit básico.', 'Exige embreagem reforçada.'],
  ['turbo-medium', 'turbo', 'Kit turbo médio', 3, 11000, 'part-turbo', { turboBoostBar: 1.05, turboSpoolScale: 1.32, turboMassAddKg: 25, intercoolerEffectiveness: 0.7 }, 'Kit turbo de preparação média.', 'Exige embreagem forte, bicos maiores e internos reforçados.'],
  ['turbo-strong', 'turbo', 'Kit turbo forte', 3, 17000, 'part-turbo', { turboBoostBar: 1.35, turboSpoolScale: 1.58, turboMassAddKg: 30, intercoolerEffectiveness: 0.75 }, 'Kit turbo de competição de grande vazão.', 'Exige kit forjado, bomba de combustível, embreagem de competição e taxa baixa.'],
  ['turbine-small', 'turbo-turbine', 'Turbina pequena', 1, 1350, 'part-turbo', { turboSpoolScale: 0.92, turboFlowScale: 1.05, intercoolerEffectivenessAdd: 0.03 }, 'Turbina de rotor pequeno e leve, com compressor de alta eficiência na faixa de pressão do kit.', 'A pressão chega um pouco mais cedo e o ar sai do compressor mais frio.'],
  ['turbine-medium', 'turbo-turbine', 'Turbina média', 2, 2600, 'part-turbo', { turboSpoolScale: 1.08, turboFlowScale: 0.95, backPressureReductionKPa: 2.5 }, 'Turbina de carcaça maior.', 'Enche um pouco mais tarde e respira melhor no alto giro.'],
  ['turbine-medium-high', 'turbo-turbine', 'Turbina média/alta', 3, 3850, 'part-turbo', { turboSpoolScale: 1.16, turboFlowScale: 0.89, backPressureReductionKPa: 4 }, 'Turbina intermediária de alto fluxo.', 'Enche mais tarde e alivia bem a contrapressão no alto giro.'],
  ['turbine-large', 'turbo-turbine', 'Turbina grande', 3, 5200, 'part-turbo', { turboSpoolScale: 1.25, turboFlowScale: 0.82, backPressureReductionKPa: 6 }, 'Turbina grande de competição.', 'Enche tarde; no alto giro o motor respira muito melhor.'],
  ['ic-small', 'turbo-intercooler', 'Intercooler pequeno', 1, 1100, 'part-turbo', { intercoolerEffectivenessAdd: 0.045, intercoolerMassAddKg: 3 }, 'Colmeia frontal um pouco maior que a do kit.'],
  ['ic-medium', 'turbo-intercooler', 'Intercooler médio', 2, 2300, 'part-turbo', { intercoolerEffectivenessAdd: 0.1, intercoolerMassAddKg: 6 }, 'Colmeia frontal de área média.'],
  ['ic-large', 'turbo-intercooler', 'Intercooler grande', 3, 3850, 'part-turbo', { intercoolerEffectivenessAdd: 0.16, intercoolerMassAddKg: 9 }, 'Colmeia frontal grande, de competição.'],
  ['wastegate-basic', 'turbo-wastegate', 'Wastegate básica', 1, 650, 'part-turbo', { wastegateRangeAddBar: 0.02, wastegateHoldAddBar: 0.03, turboSpoolScale: 0.97 }, 'Válvula de alívio externa com mola mais firme.'],
  ['wastegate-adjust', 'turbo-wastegate', 'Wastegate ajustável', 2, 1500, 'part-turbo', { wastegateRangeAddBar: 0.18, wastegateHoldAddBar: 0.06, turboSpoolScale: 0.95 }, 'Válvula de alívio externa com mola regulável.'],
  ['wastegate-race', 'turbo-wastegate', 'Wastegate performance', 3, 2850, 'part-turbo', { wastegateRangeAddBar: 0.35, wastegateHoldAddBar: 0.1, turboSpoolScale: 0.92 }, 'Válvula de alívio de competição, de grande passagem.'],
  ['boost-street', 'turbo-boost', 'Pressão street 0,65 bar', 2, 1150, 'part-turbo', { boostTargetBar: 0.65 }, 'Ajuste da pressão de trabalho para 0,65 bar.', 'Um pouco acima dos 0,6 bar do kit básico: mais ar por ciclo e mais torque, com um pouco mais de atraso contra detonação.'],
  ['boost-race', 'turbo-boost', 'Pressão competição 1,0 bar', 3, 1900, 'part-turbo', { boostTargetBar: 1.0 }, 'Ajuste da pressão de trabalho para 1,0 bar.', 'Exige bicos maiores ou bomba reforçada.'],
  ['ecu-remap', 'electronics-ecu', 'Remap leve', 1, 850, 'engine-tuners', { knockRetardScale: 0.97, burnDurationScale: 0.99 }, 'Reprogramação do mapa original de ignição.'],
  ['ecu-street', 'electronics-ecu', 'ECU programável street', 2, 3300, 'engine-tuners', { knockRetardScale: 0.88, burnDurationScale: 0.975 }, 'Central programável acertada no dinamômetro para rua.'],
  ['ecu-race', 'electronics-ecu', 'ECU programável competição', 3, 5700, 'engine-tuners', { knockRetardScale: 0.79, burnDurationScale: 0.955 }, 'Central programável de competição com sensor de detonação.'],
  ['injectors', 'electronics-fuel', 'Bicos maiores', 2, 1400, 'engine-tuners', { fuelBoostLimitBar: 1.05, burnDurationScale: 0.985 }, 'Bicos injetores de maior vazão e melhor atomização.', 'Liberam pressões acima de 0,95 bar.'],
  ['fuel-pump', 'electronics-fuel', 'Bomba reforçada', 3, 2100, 'engine-tuners', { fuelBoostLimitBar: 1.5, burnDurationScale: 0.975 }, 'Bomba de combustível de alta vazão com regulador ajustável.', 'Libera pressões até 1,5 bar.'],
  ['ignition-street', 'electronics-ignition', 'Ignição melhorada', 1, 1050, 'engine-tuners', { knockRetardScale: 0.975, burnDurationScale: 0.985 }, 'Bobina de alta energia, cabos e velas novos.'],
  ['ignition-race', 'electronics-ignition', 'Ignição performance', 3, 2400, 'engine-tuners', { knockRetardScale: 0.88, burnDurationScale: 0.97 }, 'Ignição de descarga capacitiva com bobinas individuais.'],
  ['radiator-large', 'cooling-radiator', 'Radiador maior', 2, 1450, 'part-cam', { coolingFrictionScale: 0.985, coolingKnockScale: 0.98 }, 'Radiador de alumínio de colmeia mais grossa.'],
  ['oil-cooler', 'cooling-oil', 'Sistema de óleo melhorado', 2, 1700, 'part-cam', { coolingFrictionScale: 0.965 }, 'Radiador de óleo e óleo sintético de baixa viscosidade.'],
  ['fan-upgrade', 'cooling-fan', 'Ventoinha melhorada', 1, 780, 'part-cam', { coolingFrictionScale: 0.986 }, 'Ventoinha elétrica comandada por termostato, no lugar da mecânica.'],
  ['weight-light', 'chassis-weight', 'Alívio de peso leve', 1, 1350, 'workshop-basic', { massRemoveKg: 18 }, 'Retirada de estepe, macaco, tapetes e bancos traseiros.', 'Menos massa para acelerar e menos resistência ao rolamento; o motor não muda.'],
  ['weight-medium', 'chassis-weight', 'Alívio de peso médio', 2, 2800, 'workshop-basic', { massRemoveKg: 48 }, 'Retirada do acabamento interno e banco de fibra.', 'Menos massa para acelerar e menos resistência ao rolamento; o motor não muda.'],
  ['weight-race', 'chassis-weight', 'Alívio de peso forte', 3, 5500, 'workshop-basic', { massRemoveKg: 83 }, 'Preparação de competição: vidros de policarbonato, capô de fibra e interior vazio.', 'Menos massa para acelerar e menos resistência ao rolamento; o motor não muda.'],
  ['suspension-drag', 'chassis-suspension', 'Suspensão de arrancada', 2, 2800, 'workshop-basic', { launchCgDeltaM: 0.04, massRemoveKg: 5 }, 'Molas e amortecedores de arrancada em alumínio, acertados para o eixo de tração do carro.'],
];

const n = (v: number, d = 0): string => v.toFixed(d).replace('.', ',');
const pct = (scale: number): string => n(Math.abs(scale - 1) * 100, Math.abs(scale - 1) * 100 < 10 && Math.round(Math.abs(scale - 1) * 1000) % 10 !== 0 ? 1 : 0);

/** The physical changes of a part in pt-BR, with the numbers the resolver applies. */
export function describeMods(m: MechanicalMods): string {
  const out: string[] = [];
  if (m.filterDropKPa !== undefined) out.push(`perda no filtro de ${n(m.filterDropKPa, 2)} kPa no fluxo nominal`);
  if (m.filterDropReductionKPa) out.push(`perda de carga na admissão −${n(m.filterDropReductionKPa, 1)} kPa`);
  if (m.airboxVolumeScale) out.push(`caixa de ar ${pct(m.airboxVolumeScale)} % maior`);
  if (m.runnerLengthScale) out.push(`dutos ${pct(m.runnerLengthScale)} % mais curtos`);
  if (m.runnerDiameterAddMm) out.push(`dutos ${n(m.runnerDiameterAddMm)} mm mais largos`);
  if (m.plenumScale) out.push(`plenum ${pct(m.plenumScale)} % maior`);
  if (m.throttleDiameterAddMm) out.push(`borboleta ${n(m.throttleDiameterAddMm)} mm maior`);
  if (m.throttleResponseScale) out.push(`acelerador responde ${pct(m.throttleResponseScale)} % mais rápido`);
  if (m.camIvcDeltaDeg || m.camLiftAddMm) {
    const overlap = (m.camEvcDeltaDeg ?? 0) - (m.camIvoDeltaDeg ?? 0);
    out.push(`admissão fecha ${n(m.camIvcDeltaDeg ?? 0)}° mais tarde, cruzamento +${n(overlap)}°, levantamento +${n(m.camLiftAddMm ?? 0, 2)} mm`);
  }
  if (m.revLimitAddRpm) out.push(`corte de giro +${n(m.revLimitAddRpm)} rpm`);
  if (m.headFlowScale) out.push(`vazão do cabeçote +${pct(m.headFlowScale)} % em alta rotação`);
  if (m.compressionRatioDelta) out.push(`taxa de compressão ${m.compressionRatioDelta > 0 ? '+' : '−'}${n(Math.abs(m.compressionRatioDelta), 1)}`);
  if (m.internalTorqueLimitNm) out.push(`internos aguentam ${n(m.internalTorqueLimitNm)} N·m`);
  if (m.flywheelInertiaScale) out.push(`inércia do volante −${pct(m.flywheelInertiaScale)} %`);
  if (m.backPressureReductionKPa) out.push(`contrapressão −${n(m.backPressureReductionKPa, 1)} kPa no fluxo nominal`);
  if (m.headerDiameterScale) out.push(`primários ${pct(m.headerDiameterScale)} % mais largos`);
  if (m.exhaustDiameterScale) out.push(`tubos ${pct(m.exhaustDiameterScale)} % mais largos`);
  if (m.exhaustAbsorptionScale) out.push(`abafamento −${pct(m.exhaustAbsorptionScale)} %`);
  if (m.clutchCapacityScale) out.push(`capacidade da embreagem ×${n(m.clutchCapacityScale, 2)}`);
  if (m.clutchEngageRateScale) out.push(`engate ${pct(m.clutchEngageRateScale)} % mais rápido`);
  if (m.clutchLaunchAddRpm) out.push(`largada +${n(m.clutchLaunchAddRpm)} rpm`);
  if (m.clutchEngineInertiaScale) out.push(`disco e platô mais leves: inércia do motor −${pct(m.clutchEngineInertiaScale)} %`);
  if (m.finalDriveScale) out.push(m.finalDriveScale > 1 ? `relação final escolhida para o carro, de 3 % mais longa até ${pct(m.finalDriveScale)} % mais curta` : `relação final escolhida para o carro, de 3 % mais curta até ${pct(m.finalDriveScale)} % mais longa`);
  if (m.gearSpreadScale) out.push(`marchas intermediárias até ${pct(m.gearSpreadScale)} % mais próximas da 1ª, escalonadas para o carro; 1ª e última iguais`);
  if (m.drivelineEfficiencyAdd) out.push(`engrenagens e rolamentos novos: eficiência da transmissão +${n(m.drivelineEfficiencyAdd * 100, 1)} ponto`);
  if (m.tireMuScale) out.push(`aderência de pico +${pct(m.tireMuScale)} %`);
  if (m.tireInertiaAddKgM2) out.push(m.tireInertiaAddKgM2 > 0 ? `roda +${n(m.tireInertiaAddKgM2, 2)} kg·m²` : `roda mais leve: −${n(-m.tireInertiaAddKgM2, 2)} kg·m²`);
  if (m.tireOptimalTempC) out.push(`temperatura ideal ${n(m.tireOptimalTempC)} °C`);
  if (m.tireStiffnessScale) out.push(`rigidez do pneu +${pct(m.tireStiffnessScale)} %`);
  if (m.tireTempSensitivityScale) out.push(`sensibilidade à temperatura −${pct(m.tireTempSensitivityScale)} %`);
  if (m.tireRollingScale) out.push(`resistência ao rolamento −${pct(m.tireRollingScale)} %`);
  if (m.turboBoostBar) out.push(`pressão de ${n(m.turboBoostBar, 2)} bar`);
  if (m.turboSpoolScale) out.push(m.turboSpoolScale < 1 ? `enche ${pct(m.turboSpoolScale)} % mais rápido` : `enche ${pct(m.turboSpoolScale)} % mais devagar`);
  if (m.turboMassAddKg) out.push(`+${n(m.turboMassAddKg)} kg`);
  if (m.intercoolerEffectiveness) out.push(`intercooler remove ${n(m.intercoolerEffectiveness * 100)} % do calor da compressão`);
  if (m.intercoolerEffectivenessAdd) out.push(`ar admitido mais frio: +${n(m.intercoolerEffectivenessAdd * 100, 1)} pontos do calor da compressão removidos`);
  if (m.intercoolerMassAddKg) out.push(`+${n(m.intercoolerMassAddKg)} kg`);
  if (m.wastegateHoldAddBar) out.push(`segura +${n(m.wastegateHoldAddBar, 2)} bar no alto giro`);
  if (m.wastegateRangeAddBar) out.push(`faixa de ajuste +${n(m.wastegateRangeAddBar, 2)} bar`);
  if (m.boostTargetBar) out.push(`pressão alvo de ${n(m.boostTargetBar, 2)} bar`);
  if (m.fuelBoostLimitBar) out.push(`combustível para até ${n(m.fuelBoostLimitBar, 2)} bar`);
  if (m.knockRetardScale) out.push(`atraso contra detonação −${pct(m.knockRetardScale)} %`);
  if (m.burnDurationScale) out.push(`combustão ${pct(m.burnDurationScale)} % mais rápida`);
  if (m.coolingFrictionScale) out.push(`atrito interno −${pct(m.coolingFrictionScale)} %`);
  if (m.coolingKnockScale) out.push(`detonação −${pct(m.coolingKnockScale)} % com o motor mais frio`);
  if (m.massRemoveKg) out.push(`massa do carro −${n(m.massRemoveKg)} kg`);
  if (m.launchCgDeltaM) out.push(`transferência de carga para o eixo de tração (CG efetivo ${n(m.launchCgDeltaM * 1000)} mm, no sentido da tração)`);
  const s = out.join('; ');
  return s ? s[0]!.toUpperCase() + s.slice(1) + '.' : '';
}

export const EXPANDED_PARTS: readonly ExpandedPart[] = specs.map(([id, category, name, chapter, price, unlock, mod, description, note]) => ({
  id, category, name, chapter, price, unlock, mod, description,
  physics: note ? `${describeMods(mod)} ${note}` : describeMods(mod),
  requiresTurbo: category === 'turbo-turbine' || category === 'turbo-intercooler' ||
    category === 'turbo-wastegate' || category === 'turbo-boost' || id === 'compression-low',
  // car hardware that also fits the modern engine families, opened along Chapter 2
  ...(category === 'tires-width' || category === 'tires-pressure'
    ? { modernUnlock: 'c2-generic-tires' as const }
    : category === 'chassis-weight' || category.startsWith('cooling-')
      ? { modernUnlock: 'c2-generic-chassis' as const }
      : {}),
}));
