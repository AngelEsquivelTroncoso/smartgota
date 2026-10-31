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
  flujoDe,
  litrosConFlujo,
  normalizarPerfil,
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
