/* Tests del núcleo de cálculo de SmartGota.
 * Ejecutar con: npm test   (node --test, sin dependencias)
 */
const test = require('node:test');
const assert = require('node:assert/strict');

const {
  CATALOGO,
  TASAS_FUGA,
  PROMEDIOS,
  baseUso,
  repartirCuota,
  generarCasoFuga,
  normalizarCasoFuga,
  fugaEnCurso,
  inicioFugaDesde,
  flujoDe,
  litrosConFlujo,
  normalizarPerfil,
  evaluarAhorro,
  UMBRAL_AHORRO,
  FACTOR_AHORRO,
  ENTRADA_MADRUGADA_LMIN,
  ENTREGA_DIA_FRACCION,
  CORTE_GRAVE_HORAS,
  DURACIONES_CORTE,
  metaNoche,
  enMadrugada,
  corteDelDia,
  enCorte,
  flujoDiaLps,
} = require('./dominio.js');

const banoPrincipal = { tipo: 'bano', rol: 'principal' };
const banoSecundario = { tipo: 'bano', rol: 'secundario' };
const cocina = { tipo: 'cocina', rol: 'principal' };
const sala = { tipo: 'sala', rol: 'principal' };

/* --- repartirCuota: una sola cuota por uso --------------------------- */

test('reparte la ducha 3:1 entre baño principal y secundario sin perder litros', () => {
  assert.deepEqual(repartirCuota(35, [3, 1]), [26, 9]);
  assert.equal(
    repartirCuota(35, [3, 1]).reduce((a, b) => a + b, 0),
    35
  );
});

test('dos aparatos iguales se reparten la cuota a la mitad', () => {
  assert.deepEqual(repartirCuota(10, [1, 1]), [5, 5]);
});

test('un solo aparato se queda con toda la cuota', () => {
  assert.deepEqual(repartirCuota(17, [3]), [17]);
});

test('el reparto es entero y nunca pierde ni inventa unidades', () => {
  for (const total of [1, 7, 13, 35, 99, 250]) {
    for (const pesos of [[1], [1, 1], [3, 1], [3, 2, 1], [1, 1, 1]]) {
      const cuotas = repartirCuota(total, pesos);
      assert.equal(cuotas.length, pesos.length);
      assert.ok(
        cuotas.every((n) => Number.isInteger(n) && n >= 0),
        `cuotas no enteras en ${total}/${pesos}`
      );
      assert.equal(
        cuotas.reduce((a, b) => a + b, 0),
        total,
        `se perdió cuota en ${total}/${pesos}`
      );
    }
  }
});

test('el resto va a quien tenga mayor fracción', () => {
  // 7 entre pesos 1 y 1: 3.5 y 3.5 -> el primero, por orden de resto
  assert.deepEqual(repartirCuota(7, [1, 1]), [4, 3]);
});

test('pesos en cero devuelven ceros y lista vacía devuelve lista vacía', () => {
  assert.deepEqual(repartirCuota(10, [0, 0]), [0, 0]);
  assert.deepEqual(repartirCuota(10, []), []);
});

/* --- baseUso: cuota por uso, no por aparato -------------------------- */

test('la ducha crece con los habitantes y pesa por rol', () => {
  const r = baseUso('ducha', banoPrincipal, { perfil: 'medio', habitantes: 4 });
  assert.equal(r.clave, 'ducha');
  assert.equal(r.uso, PROMEDIOS.medio.ducha * 4);
  assert.equal(r.peso, 3);
});

test('el baño secundario recibe el mismo uso pero menos peso', () => {
  const principal = baseUso('ducha', banoPrincipal, { perfil: 'medio', habitantes: 4 });
  const secundario = baseUso('ducha', banoSecundario, { perfil: 'medio', habitantes: 4 });
  assert.equal(principal.uso, secundario.uso);
  assert.equal(secundario.peso, 1);
});

test('el lavabo de cocina usa su propia clave y no se multiplica por personas', () => {
  const r = baseUso('lavabo', cocina, { perfil: 'alto', habitantes: 5 });
  assert.equal(r.clave, 'lavaboCocina');
  assert.equal(r.uso, PROMEDIOS.alto.lavaboCocina);
});

test('el lavabo de baño sí se multiplica por habitantes', () => {
  const r = baseUso('lavabo', banoPrincipal, { perfil: 'alto', habitantes: 5 });
  assert.equal(r.clave, 'lavabo');
  assert.equal(r.uso, PROMEDIOS.alto.lavabo * 5);
});

test('el aire es carga puntual: no se reparte y depende del rol de la sala', () => {
  const principal = baseUso('aire', sala, { perfil: 'medio', habitantes: 4 });
  const secundario = baseUso(
    'aire',
    { tipo: 'recamara', rol: 'secundario' },
    {
      perfil: 'medio',
      habitantes: 4,
    }
  );
  assert.equal(principal.clave, null);
  assert.equal(principal.uso, PROMEDIOS.medio.aire);
  assert.equal(secundario.uso, PROMEDIOS.medio.aireSecundario);
  assert.notEqual(principal.uso, secundario.uso / 2);
});

test('la fuga es caudal fijo y nunca se divide entre aparatos', () => {
  const r = baseUso('fuga', banoPrincipal, { perfil: 'medio', habitantes: 4 });
  assert.equal(r.clave, null);
  assert.equal(r.uso, CATALOGO.fuga.sugerido);
  assert.equal(r.peso, 1);
});

test('un tipo desconocido no rompe el cálculo', () => {
  assert.deepEqual(baseUso('inexistente', null, {}), { clave: null, uso: 0, peso: 1 });
});

test('la lavadora se prorratea entre cuatro personas', () => {
  const r = baseUso('lavadora', null, { perfil: 'medio', habitantes: 4 });
  assert.equal(r.uso, PROMEDIOS.medio.lavadora);
});

/* --- litros: flujo por modo y frecuencia ----------------------------- */

test('el modo ecológico reduce los litros del aparato', () => {
  const d = { tipo: 'ducha', modo: 'estandar', frecuencia: 'dia', uso_personalizado: 10 };
  const litrosEstandar = litrosConFlujo(d, flujoDe(d));
  const ecologica = { ...d, modo: 'ecologica' };
  const litrosEcologico = litrosConFlujo(ecologica, flujoDe(ecologica));
  assert.equal(litrosEstandar, 150);
  assert.equal(litrosEcologico, 70);
});

test('la frecuencia semanal divide entre siete', () => {
  const diaria = { tipo: 'tina', modo: 'estandar', frecuencia: 'dia', uso_personalizado: 7 };
  const semanal = { ...diaria, frecuencia: 'semana' };
  assert.equal(
    litrosConFlujo(semanal, flujoDe(semanal)) * 7,
    litrosConFlujo(diaria, flujoDe(diaria))
  );
});

test('los aparatos de caudal fijo ignoran el uso y la frecuencia', () => {
  const a = { tipo: 'fuga', modo: 'estandar', frecuencia: 'semana', uso_personalizado: 1 };
  const b = { tipo: 'fuga', modo: 'estandar', frecuencia: 'dia', uso_personalizado: 99 };
  assert.equal(litrosConFlujo(a, flujoDe(a)), CATALOGO.fuga.flujo);
  assert.equal(litrosConFlujo(b, flujoDe(b)), CATALOGO.fuga.flujo);
});

/* --- caso de fuga sorpresa: determinista ----------------------------- */

test('el mismo código siempre produce el mismo caso', () => {
  const ids = ['d1', 'd2', 'd3', 'd4'];
  const a = generarCasoFuga(4821, ids);
  const b = generarCasoFuga(4821, ids);
  assert.deepEqual(a.ids, b.ids);
  assert.deepEqual([...a.horas], [...b.horas]);
});

test('el último dígito 8 o 9 provoca dos fugas; el resto, una', () => {
  const ids = ['d1', 'd2', 'd3', 'd4'];
  assert.equal(generarCasoFuga(4821, ids).ids.length, 1);
  assert.equal(generarCasoFuga(4828, ids).ids.length, 2);
  assert.equal(generarCasoFuga(4829, ids).ids.length, 2);
});

test('la hora de inicio cae siempre entre las 08:00 y las 18:00', () => {
  const ids = ['d1', 'd2', 'd3'];
  for (let codigo = 1000; codigo <= 9999; codigo += 7) {
    for (const hora of generarCasoFuga(codigo, ids).horas.values()) {
      assert.ok(hora >= 8 && hora <= 18, `hora fuera de rango: ${hora} (código ${codigo})`);
    }
  }
});

test('sin aparatos elegibles no hay caso', () => {
  const caso = generarCasoFuga(4821, []);
  assert.deepEqual(caso.ids, []);
  assert.equal(caso.horas.size, 0);
});

test('cada aparato elegible puede salir sorteado', () => {
  const ids = ['a', 'b', 'c'];
  const vistos = new Set();
  for (let codigo = 1000; codigo < 1300; codigo++) {
    vistos.add(generarCasoFuga(codigo, ids).ids[0]);
  }
  assert.equal(vistos.size, ids.length);
});

/* --- la fuga solo corre con el interruptor encendido ------------------ */

test('con el interruptor apagado la fuga no corre aunque sea su hora', () => {
  assert.equal(fugaEnCurso(false, 8 * 3600, 20 * 3600), false);
});

test('la fuga espera a su hora', () => {
  assert.equal(fugaEnCurso(true, 12 * 3600, 12 * 3600 - 1), false);
  assert.equal(fugaEnCurso(true, 12 * 3600, 12 * 3600), true);
});

test('sin hora conocida la fuga cuenta como iniciada solo si está activa', () => {
  assert.equal(fugaEnCurso(true, undefined, 0), true);
  assert.equal(fugaEnCurso(false, undefined, 0), false);
});

test('el inicio absoluto sobrevive al cambio de día', () => {
  assert.equal(fugaEnCurso(true, 86400 + 18 * 3600, 86400 + 8 * 3600), false);
  assert.equal(fugaEnCurso(true, 86400 + 18 * 3600, 86400 + 18 * 3600), true);
});

/* --- el caso se ancla al momento de encenderlo ------------------------ */

test('encenderla de noche programa la fuga para el día siguiente', () => {
  assert.equal(inicioFugaDesde(8, 20 * 3600), 86400 + 8 * 3600);
});

test('encenderla de madrugada la deja para esa misma mañana', () => {
  assert.equal(inicioFugaDesde(8, 7 * 3600), 8 * 3600);
  assert.equal(inicioFugaDesde(18, 5 * 3600), 18 * 3600);
});

test('si el ancla cae justo en la hora del caso, arranca en el acto', () => {
  assert.equal(inicioFugaDesde(8, 8 * 3600), 8 * 3600);
});

test('sin hora de caso arranca en el ancla', () => {
  assert.equal(inicioFugaDesde(undefined, 12345), 12345);
});

/* --- normalización de entradas --------------------------------------- */

test('los códigos inválidos vuelven al valor por defecto', () => {
  assert.equal(normalizarCasoFuga('48a21'), 4821);
  assert.equal(normalizarCasoFuga(500), 4821);
  assert.equal(normalizarCasoFuga('abc'), 4821);
  assert.equal(normalizarCasoFuga(99999), 9999);
});

test('el perfil antiguo se traduce al nuevo sin romper las tablas', () => {
  assert.equal(normalizarPerfil('basica'), 'bajo');
  assert.equal(normalizarPerfil('familiar'), 'medio');
  assert.equal(normalizarPerfil('amplia'), 'alto');
  assert.equal(normalizarPerfil('cualquiera'), 'bajo');
  assert.ok(PROMEDIOS[normalizarPerfil('familiar')]);
});

/* --- ahorro con el tinaco al 20 % ------------------------------------ */

test('el ahorro se activa al 20 % del tinaco y deja el consumo a la mitad', () => {
  assert.equal(UMBRAL_AHORRO, 0.2);
  assert.equal(FACTOR_AHORRO, 0.5);
  assert.deepEqual(evaluarAhorro(90, 450), { activo: true, factor: 0.5 });
});

test('por encima del 20 % el consumo vuelve a ser normal', () => {
  assert.deepEqual(evaluarAhorro(91, 450), { activo: false, factor: 1 });
  assert.deepEqual(evaluarAhorro(450, 450), { activo: false, factor: 1 });
});

test('una vez activo, el ahorro aguanta hasta superar el 25 %', () => {
  assert.equal(evaluarAhorro(100, 450, true).factor, 0.5, '22 % con ahorro previo');
  assert.equal(evaluarAhorro(112, 450, true).factor, 0.5, '24,9 % con ahorro previo');
  assert.equal(evaluarAhorro(113, 450, true).factor, 1, '25,1 % con ahorro previo');
});

test('sin ahorro previo, el 22 % no activa nada', () => {
  assert.equal(evaluarAhorro(100, 450, false).factor, 1);
});

test('una capacidad inválida o un nivel desconocido no activan el ahorro', () => {
  assert.deepEqual(evaluarAhorro(0, 0), { activo: false, factor: 1 });
  assert.deepEqual(evaluarAhorro(null, 450), { activo: false, factor: 1 });
  assert.deepEqual(evaluarAhorro(90, 'x'), { activo: false, factor: 1 });
});

/* --- coherencia del catálogo ----------------------------------------- */

test('todo tipo con tasa de fuga existe en el catálogo', () => {
  for (const tipo of Object.keys(TASAS_FUGA)) {
    assert.ok(CATALOGO[tipo], `falta ${tipo} en CATALOGO`);
  }
});

test('todo modo declarado tiene flujo numérico positivo', () => {
  for (const [tipo, c] of Object.entries(CATALOGO)) {
    if (!c.modos) {
      continue;
    }
    for (const [modo, def] of Object.entries(c.modos)) {
      assert.ok(def.flujo > 0, `${tipo}.${modo} sin flujo válido`);
    }
  }
});

/* --- suministro: madrugada, día proporcional y cortes ---------------- */

test('la madrugada cubre de 00:00 a 04:59', () => {
  assert.equal(enMadrugada(0), true);
  assert.equal(enMadrugada(4), true);
  assert.equal(enMadrugada(5), false);
  assert.equal(enMadrugada(23), false);
  assert.ok(ENTRADA_MADRUGADA_LMIN > flujoDiaLps(1000) * 60);
});

test('la meta de la noche es determinista y cae entre 0 y 1', () => {
  for (let dia = 0; dia < 200; dia += 1) {
    const a = metaNoche(dia, 7314);
    assert.equal(a, metaNoche(dia, 7314));
    assert.ok(a >= 0 && a <= 1, `meta fuera de rango: ${a}`);
  }
});

test('una de cada dieciséis noches se queda sin agua', () => {
  let secas = 0;
  let seguidas = 0;
  for (let dia = 1; dia < 700; dia += 1) {
    if (metaNoche(dia, 7314) === 0) {
      secas += 1;
      if (metaNoche(dia - 1, 7314) === 0) seguidas += 1;
    }
  }
  assert.ok(secas >= 30 && secas <= 70, `noches secas: ${secas}`);
  assert.ok(seguidas >= 1, 'debe haber al menos una sequía de dos noches');
});

test('la noche llena más veces que a medias', () => {
  let suma = 0;
  for (let dia = 0; dia < 700; dia += 1) suma += metaNoche(dia, 4821);
  assert.ok(suma / 700 > 0.78, `media: ${(suma / 700).toFixed(2)}`);
});

test('los cortes se sortean por semana, con semanas limpias', () => {
  let semanasSinCorte = 0;
  for (let semana = 0; semana < 30; semana += 1) {
    const cortes = [];
    for (let d = 0; d < 7; d += 1) {
      const c = corteDelDia(semana * 7 + d, 7314);
      if (c) cortes.push(c);
    }
    assert.ok(cortes.length <= 3, `semana ${semana}: ${cortes.length} cortes`);
    if (cortes.length === 0) semanasSinCorte += 1;
  }
  assert.ok(semanasSinCorte >= 5, `semanas sin corte: ${semanasSinCorte}`);
});

test('el corte es determinista, dura 2–12 h y el grave 26–36 h', () => {
  let graves = 0;
  for (let dia = 0; dia < 400; dia += 1) {
    const a = corteDelDia(dia, 7314);
    assert.deepEqual(a, corteDelDia(dia, 7314));
    if (!a) continue;
    const horas = a.hasta - a.desde;
    if (a.grave) {
      graves += 1;
      assert.ok(horas >= 26 && horas <= 36, `grave de ${horas} h`);
      assert.ok(a.desde >= 18 && a.desde <= 20);
    } else {
      assert.ok(DURACIONES_CORTE.includes(horas), `duración rara: ${horas}`);
    }
  }
  assert.ok(graves >= 1, 'en 400 días debe caer algún corte grave');
});

test('enCorte respeta el inicio y el final, y el grave cruza la medianoche', () => {
  for (let dia = 0; dia < 400; dia += 1) {
    const c = corteDelDia(dia, 7314);
    if (!c) continue;
    assert.equal(enCorte(dia * 24 + c.desde, 7314), true);
    assert.equal(enCorte(dia * 24 + c.hasta, 7314), false);
    if (c.grave) {
      assert.ok(c.hasta > 24, 'el grave debe pasar la medianoche');
      assert.equal(enCorte(dia * 24 + 23.5, 7314), true);
      assert.equal(enCorte((dia + 1) * 24 + 1, 7314), true);
    }
  }
});

test('la semilla cambia el corte pero no su forma', () => {
  const distinto = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13].filter(
    (dia) => JSON.stringify(corteDelDia(dia, 100)) !== JSON.stringify(corteDelDia(dia, 200))
  );
  assert.ok(distinto.length > 0);
});

test('el día entrega una fracción de la demanda que supera el ahorro', () => {
  for (const humanoDia of [184, 448, 935]) {
    const lps = flujoDiaLps(humanoDia);
    assert.ok(lps > (FACTOR_AHORRO * humanoDia) / 86400, `estancado con ${humanoDia} L/día`);
    assert.ok(lps < humanoDia / 86400);
    assert.ok(Math.abs(lps * 86400 - humanoDia * ENTREGA_DIA_FRACCION) < 1e-9);
  }
});

test('sin demanda de día no entra agua de día', () => {
  assert.equal(flujoDiaLps(0), 0);
  assert.equal(flujoDiaLps(-10), 0);
  assert.equal(flujoDiaLps(NaN), 0);
});
