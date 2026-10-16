/* SmartGota — app.js (v13)
   Secciones: Modelo/Estado · Dashboard · Pisos · Habitaciones · Layout (Grid Spans) · Drag & Drop · Papelera · Clones · Editor · Simulación (consumo + red) · Arranque
   Reactividad: todo cambio en Estado (Proxy) repinta el dashboard y guarda en localStorage. */
'use strict';
/* ===========================================================
   MODELO (todo por ID):
   Estado.pisos[id]  <--  Estado.habitaciones[id].piso  <--  Estado.dispositivos[id].sala
   Cambiar de pestaña solo alterna `hidden`: los nodos (y el tamaño que dejó el
   resize nativo en su style) siguen vivos en el DOM.
   =========================================================== */

const COSTO_POR_LITRO = 0.025,
  DIAS_MES = 30,
  TAM = 44,
  LITROS_OMS = 100,
  REF_EFICIENTE = 80,
  REF_ALTO = 180;

const CATALOGO = {
  ducha: {
    nombre: 'Ducha',
    icono: '🚿',
    flujo: 15,
    medida: 'L/min',
    unidad: 'Minutos',
    sugerido: 10,
    frecuenciaInicial: 'dia',
    modoInicial: 'estandar',
    porHabitante: true,
    modos: {
      estandar: { nombre: 'Estándar (15 L/min)', flujo: 15 },
      ecologica: { nombre: 'Ecológica / Ahorradora (7 L/min)', flujo: 7 },
      antigua: { nombre: 'Antigua / Sin restrictor (20 L/min)', flujo: 20 },
    },
  },
  inodoro: {
    nombre: 'Inodoro',
    icono: '🚽',
    flujo: 6,
    medida: 'L/descarga',
    unidad: 'Descargas',
    sugerido: 5,
    frecuenciaInicial: 'dia',
    modoInicial: 'estandar',
    porHabitante: true,
    modos: {
      antiguo: { nombre: 'Antiguo (12 L/descarga)', flujo: 12 },
      estandar: { nombre: 'Estándar (6 L/descarga)', flujo: 6 },
      ecologico: { nombre: 'Ecológico / Dual (4.5 L/descarga)', flujo: 4.5 },
    },
  },
  lavabo: {
    nombre: 'Lavabo',
    icono: '🚰',
    flujo: 6,
    medida: 'L/min',
    unidad: 'Minutos',
    sugerido: 3,
    frecuenciaInicial: 'dia',
    modoInicial: 'estandar',
    porHabitante: true,
    modos: {
      estandar: { nombre: 'Estándar (6 L/min)', flujo: 6 },
      ecologico: { nombre: 'Con aireador ahorrador (3.5 L/min)', flujo: 3.5 },
    },
  },
  tina: {
    nombre: 'Tina de baño',
    icono: '🛁',
    flujo: 150,
    medida: 'L/uso',
    unidad: 'Usos',
    sugerido: 1,
    frecuenciaInicial: 'semana',
    modoInicial: 'estandar',
    porHabitante: false,
    modos: {
      estandar: { nombre: 'Estándar llena (150 L/uso)', flujo: 150 },
      compacta: { nombre: 'Medio llenado (100 L/uso)', flujo: 100 },
    },
  },
  lavadora: {
    nombre: 'Lavadora',
    icono: '🧺',
    flujo: 50,
    medida: 'L/carga',
    unidad: 'Cargas',
    sugerido: 3,
    frecuenciaInicial: 'semana',
    modoInicial: 'estandar',
    porHabitante: false,
    modos: {
      antigua: { nombre: 'Antigua / Ciclo pesado (80 L/carga)', flujo: 80 },
      estandar: { nombre: 'Estándar (50 L/carga)', flujo: 50 },
      eficiente: {
        nombre: 'Eficiente / Carga frontal (35 L/carga)',
        flujo: 35,
      },
    },
  },
  lavavajillas: {
    nombre: 'Lavavajillas',
    icono: '🍽️',
    flujo: 15,
    medida: 'L/carga',
    unidad: 'Cargas',
    sugerido: 1,
    frecuenciaInicial: 'dia',
    modoInicial: 'estandar',
    porHabitante: false,
    modos: {
      estandar: { nombre: 'Estándar (15 L/carga)', flujo: 15 },
      eco: { nombre: 'Ciclo Eco (10 L/carga)', flujo: 10 },
    },
  },
  grifo: {
    nombre: 'Grifo (Manguera)',
    icono: '🪴',
    flujo: 20,
    medida: 'L/min',
    unidad: 'Minutos',
    sugerido: 15,
    frecuenciaInicial: 'semana',
    modoInicial: 'estandar',
    porHabitante: false,
    modos: {
      estandar: { nombre: 'Manguera abierta (20 L/min)', flujo: 20 },
      ahorrador: { nombre: 'Pistola / Riego eficiente (10 L/min)', flujo: 10 },
    },
  },
  aire: {
    nombre: 'Aire lavado',
    icono: '💨',
    flujo: 10,
    medida: 'L/hora',
    unidad: 'Horas',
    sugerido: 10,
    frecuenciaInicial: 'dia',
    modoInicial: 'estandar',
    porHabitante: false,
    modos: {
      estandar: { nombre: 'Estándar residencial (10 L/hora)', flujo: 10 },
      compacto: { nombre: 'Compacto / Bajo flujo (6 L/hora)', flujo: 6 },
    },
  },
  filtro: {
    nombre: 'Filtro de agua potable',
    icono: '🧫',
    flujo: 3,
    medida: 'L/L filtrado',
    unidad: 'Litros filtrados',
    sugerido: 5,
    frecuenciaInicial: 'dia',
    modoInicial: 'rechazo',
    porHabitante: true,
    modos: {
      rechazo: { nombre: 'Ósmosis con rechazo (3 L/L)', flujo: 3 },
      sin_rechazo: {
        nombre: 'Sin rechazo / Ultrafiltración (1 L/L)',
        flujo: 1,
      },
    },
  },
  fuga: {
    nombre: 'Fuga',
    icono: '💧',
    flujo: 100,
    medida: 'L/día',
    unidad: '',
    sugerido: 1,
    fijo: true,
  },
};

/* ---------- Estado reactivo (Proxy) + persistencia ---------- */
const CLAVE_LS = 'smartgota:estado:v1';
let pausado = false,
  pendiente = false;

// Varias mutaciones dentro de un mismo evento => UN solo repintado y UN solo guardado
function notificar() {
  if (pausado || pendiente) {
    return;
  }
  pendiente = true;
  queueMicrotask(() => {
    pendiente = false;
    renderDashboard();
    guardarEstado();
  });
}

// Handler común: cualquier set/delete que cambie algo avisa
const manejador = {
  set(t, k, v) {
    const igual = t[k] === v;
    t[k] = v;
    if (!igual) {
      notificar();
    }
    return true;
  },
  deleteProperty(t, k) {
    delete t[k];
    notificar();
    return true;
  },
};

// Un Map no avisa de set/delete por sí solo: esta subclase sí. Cada registro guardado
// se envuelve en un Proxy para que d.uso_personalizado = 5 también dispare la reacción.
class MapaReactivo extends Map {
  set(k, v) {
    super.set(k, new Proxy(v, manejador));
    notificar();
    return this;
  }
  delete(k) {
    const r = super.delete(k);
    if (r) {
      notificar();
    }
    return r;
  }
  clear() {
    super.clear();
    notificar();
  }
}

const Estado = new Proxy(
  {
    capacidad: 750,
    habitantes: 4,
    reciboSimas: 0, // lectura real opcional en m³/mes para validación cuasi-experimental
    pisoActivo: null,
    pisos: new MapaReactivo(), // id -> { id, nombre }
    habitaciones: new MapaReactivo(), // id -> { id, nombre, piso, cs, rs }
    dispositivos: new MapaReactivo(), // id -> { tipo, sala, fx, fy, uso_personalizado, frecuencia, modo }
    siguienteId: 1,
    siguienteSala: 1,
    siguientePiso: 1,
  },
  manejador
);

// Serialización: Map -> arreglo de pares [id, registro] (JSON no entiende Map)
function guardarEstado() {
  try {
    localStorage.setItem(
      CLAVE_LS,
      JSON.stringify({
        capacidad: Estado.capacidad,
        habitantes: Estado.habitantes,
        reciboSimas: Estado.reciboSimas,
        pisoActivo: Estado.pisoActivo,
        siguienteId: Estado.siguienteId,
        siguienteSala: Estado.siguienteSala,
        siguientePiso: Estado.siguientePiso,
        pisos: [...Estado.pisos],
        habitaciones: [...Estado.habitaciones],
        dispositivos: [...Estado.dispositivos],
      })
    );
  } catch (_) {
    /* almacenamiento lleno o bloqueado: la app sigue funcionando sin guardar */
  }
}

// Deserialización: arreglos -> Map reactivos + reconstrucción del DOM. Sin datos, siembra la casa de ejemplo.
function cargarEstado() {
  let g = null;
  try {
    g = JSON.parse(localStorage.getItem(CLAVE_LS));
  } catch (_) {
    // eslint-disable-next-line no-empty
    // Almacenamiento lleno o bloqueado: la app sigue funcionando sin guardar.
  }
  const valido =
    g && [g.pisos, g.habitaciones, g.dispositivos].every(Array.isArray) && g.pisos.length;

  pausado = true; // restaurar = muchas escrituras; se notifica una sola vez al final
  try {
    if (valido) {
      Estado.capacidad = [450, 750, 1100, 2500].includes(g.capacidad) ? g.capacidad : 750;
      Estado.habitantes = entero(g.habitantes, 1, 50);
      Estado.reciboSimas = Math.max(0, Math.min(Number(g.reciboSimas) || 0, 999));
      Estado.siguienteId = Number(g.siguienteId) || 1;
      Estado.siguienteSala = Number(g.siguienteSala) || 1;
      Estado.siguientePiso = Number(g.siguientePiso) || 1;
      g.pisos.forEach(([k, v]) => Estado.pisos.set(k, v));
      Estado.pisoActivo = Estado.pisos.has(g.pisoActivo)
        ? g.pisoActivo
        : Estado.pisos.keys().next().value;
      g.habitaciones.forEach(([k, v]) => {
        if (!Estado.pisos.has(v.piso)) {
          return;
        }
        Estado.habitaciones.set(k, v);
        montarHabitacion(Estado.habitaciones.get(k));
      });
      g.dispositivos.forEach(([k, v]) => {
        const c = CATALOGO[v.tipo];
        if (!Estado.habitaciones.has(v.sala) || !c) {
          return;
        }
        // Retrocompatibilidad para estados guardados con versiones previas
        if (!v.frecuencia) {
          v.frecuencia = 'dia';
        }
        if (!v.modo || (c.modos && !c.modos[v.modo])) {
          v.modo = c.modoInicial || 'estandar';
        }
        Estado.dispositivos.set(k, v);
        montarDispositivo(k);
      });
    } else {
      Estado.pisoActivo = crearPiso('Planta Baja');
      ['Cocina', 'Baño', 'Salón'].forEach((n) => crearHabitacion(n, Estado.pisoActivo));
    }
  } finally {
    pausado = false;
  }

  $('capacidad').value = Estado.capacidad;
  $('habitantes').value = Estado.habitantes;
  $('recibo-simas').value = Estado.reciboSimas > 0 ? Estado.reciboSimas : '';
  renderTabs();
  activarPiso(Estado.pisoActivo);
  notificar();
}

const $ = (id) => document.getElementById(id);
const salaEl = (id) => document.querySelector('.sala[data-sala="' + id + '"]');
const pesos = (n) => '$' + n.toFixed(2);
const entero = (v, min, max) => {
  let n = parseInt(v, 10);
  if (isNaN(n)) {
    n = min;
  }
  return Math.min(Math.max(n, min), max);
};
const limiteOMS = () => Estado.habitantes * LITROS_OMS;

function flujoDe(d) {
  const c = CATALOGO[d.tipo];
  if (!c) {
    return 0;
  }
  if (c.modos && d.modo && c.modos[d.modo]) {
    return c.modos[d.modo].flujo;
  }
  return c.flujo;
}

function litrosConFlujo(d, flujo) {
  const c = CATALOGO[d.tipo];
  if (c.fijo) {
    return c.flujo;
  }
  const divisor = d.frecuencia === 'semana' ? 7 : 1;
  return Math.round(((flujo * d.uso_personalizado) / divisor) * 10) / 10;
}

const litrosDe = (d) => litrosConFlujo(d, flujoDe(d));

const dispositivosDe = (salaId) =>
  [...Estado.dispositivos].filter(([, d]) => d.sala === salaId).map(([k]) => k);

function litrosTotales() {
  let t = 0;
  Estado.dispositivos.forEach((d) => (t += litrosDe(d)));
  return Math.round(t);
}

function resumenFugas() {
  let litros = 0,
    cantidad = 0;
  Estado.dispositivos.forEach((d) => {
    if (CATALOGO[d.tipo].fijo) {
      litros += litrosDe(d);
      cantidad++;
    }
  });
  return { litros: Math.round(litros), cantidad };
}

// Calcula el estado de validación cuasi-experimental frente al recibo físico SIMAS (m³/mes)
function calcularValidacionSimas(litrosDia) {
  const m3Simulado = (litrosDia * DIAS_MES) / 1000,
    m3Real = Estado.reciboSimas;
  if (!m3Real || m3Real <= 0) {
    return {
      activo: false,
      m3Simulado,
      m3Real: 0,
      errorPct: 0,
      exactitudPct: 0,
      difM3: 0,
    };
  }
  const difM3 = m3Simulado - m3Real,
    errorPct = (Math.abs(difM3) / m3Real) * 100,
    exactitudPct = Math.max(0, 100 - errorPct);
  return { activo: true, m3Simulado, m3Real, errorPct, exactitudPct, difM3 };
}

// Identifica el dispositivo de mayor impacto y genera una recomendación persuasiva accionable
function generarRecomendacion() {
  let mayor = null;
  Estado.dispositivos.forEach((d, id) => {
    const l = litrosDe(d);
    if (l > 0 && (!mayor || l > mayor.litros)) {
      mayor = { id, d, litros: l };
    }
  });
  if (!mayor) {
    return '';
  }

  const { d, litros } = mayor,
    c = CATALOGO[d.tipo],
    hab = (Estado.habitaciones.get(d.sala) || {}).nombre || 'la vivienda';

  if (c.fijo) {
    const mesL = Math.round(litros * DIAS_MES),
      mesPesos = pesos(mesL * COSTO_POR_LITRO);
    return (
      '💡 Acción prioritaria: Reparar la Fuga en «' +
      hab +
      '» ahorraría ' +
      mesL.toLocaleString('es-MX') +
      ' L/mes (' +
      mesPesos +
      ' MXN).'
    );
  }

  // Busca si existe una modalidad más eficiente que la actual
  const fActual = flujoDe(d);
  let mejorModo = null;
  if (c.modos) {
    Object.entries(c.modos).forEach(([clave, info]) => {
      if (info.flujo < fActual && (!mejorModo || info.flujo < mejorModo.flujo)) {
        mejorModo = { clave, ...info };
      }
    });
  }

  const ahorro20MesL = Math.round(litros * 0.2 * DIAS_MES),
    ahorro20Pesos = pesos(ahorro20MesL * COSTO_POR_LITRO);

  if (mejorModo) {
    const lEco = litrosConFlujo(d, mejorModo.flujo),
      ahorroEcoMesL = Math.round((litros - lEco) * DIAS_MES),
      ahorroEcoPesos = pesos(ahorroEcoMesL * COSTO_POR_LITRO);
    return (
      '💡 Recomendación: «' +
      c.nombre +
      '» en «' +
      hab +
      '» es tu mayor consumo (' +
      litros +
      ' L/día). Cambiar a «' +
      mejorModo.nombre +
      '» ahorraría ' +
      ahorroEcoMesL.toLocaleString('es-MX') +
      ' L/mes (' +
      ahorroEcoPesos +
      ' MXN), o reducir su uso un 20 % ahorraría ' +
      ahorro20MesL.toLocaleString('es-MX') +
      ' L/mes (' +
      ahorro20Pesos +
      ' MXN).'
    );
  }

  return (
    '💡 Recomendación: «' +
    c.nombre +
    '» en «' +
    hab +
    '» es tu mayor consumo (' +
    litros +
    ' L/día). Reducir su uso un 20 % ahorraría ' +
    ahorro20MesL.toLocaleString('es-MX') +
    ' L/mes (' +
    ahorro20Pesos +
    ' MXN).'
  );
}

/* ---------- Dashboard ---------- */
function animarCifra(el, fin, fmt) {
  const ini = el._v || 0,
    t0 = performance.now();
  cancelAnimationFrame(el._raf);
  (function paso(t) {
    const k = Math.min((t - t0) / 500, 1);
    el._v = ini + (fin - ini) * (1 - Math.pow(1 - k, 3));
    el.textContent = fmt(el._v);
    if (k < 1) {
      el._raf = requestAnimationFrame(paso);
    }
  })(t0);
}

function renderDashboard() {
  const L = litrosTotales(),
    cap = Estado.capacidad,
    lim = limiteOMS(),
    costo = L * COSTO_POR_LITRO;
  const pct = (L / cap) * 100,
    desborde = L > cap,
    fugas = resumenFugas();

  animarCifra($('m-litros'), L, (n) => Math.round(n) + ' L');
  animarCifra($('m-costo'), costo, pesos);
  animarCifra($('m-oms'), lim, (n) => Math.round(n) + ' L');
  animarCifra($('m-uso-oms'), (L / lim) * 100, (n) => Math.round(n) + ' %');
  animarCifra($('m-litros-mes'), L * DIAS_MES, (n) => {
    const litrosMes = Math.round(n),
      m3Mes = (litrosMes / 1000).toFixed(1);
    return litrosMes.toLocaleString('es-MX') + ' L (' + m3Mes + ' m³)';
  });
  animarCifra($('m-costo-mes'), costo * DIAS_MES, pesos);

  // Validación cuasi-experimental contra recibo físico de SIMAS Torreón
  const val = calcularValidacionSimas(L),
    elVal = $('val-simas');
  if (!val.activo) {
    elVal.className = 'val-simas';
    elVal.textContent =
      'Simulado: ' +
      val.m3Simulado.toFixed(2) +
      ' m³/mes. Ingresa los m³ de tu recibo SIMAS para calcular el error relativo del modelo.';
  } else {
    const claseVal = val.errorPct <= 15 ? 'exacto' : val.errorPct <= 30 ? 'moderado' : 'desviado';
    const signo = val.difM3 > 0 ? '+' : '';
    elVal.className = 'val-simas ' + claseVal;
    elVal.textContent =
      'Validación SIMAS: Simulado ' +
      val.m3Simulado.toFixed(2) +
      ' m³ vs. Recibo ' +
      val.m3Real.toFixed(1) +
      ' m³ (' +
      signo +
      val.difM3.toFixed(2) +
      ' m³) · Error relativo: ' +
      val.errorPct.toFixed(1) +
      ' % · Exactitud: ' +
      val.exactitudPct.toFixed(1) +
      ' %';
  }

  // Comparativa social normativa por habitante (estilo Dropcountr)
  const lHab = L / Estado.habitantes,
    pctNorm = Math.min((lHab / 220) * 100, 100),
    fillNorm = $('norm-fill');
  $('norm-valor').textContent = Math.round(lHab) + ' L/hab/día';
  fillNorm.style.width = pctNorm + '%';
  fillNorm.className =
    'normativa__fill' + (lHab > REF_ALTO ? ' rojo' : lHab > LITROS_OMS ? ' ambar' : '');

  if (L === 0) {
    $('norm-estado').textContent = 'Referencias Torreón: Eficiente 80 L · OMS 100 L · Alto 180 L';
  } else if (lHab <= REF_EFICIENTE) {
    $('norm-estado').textContent =
      '🌟 Nivel vecino eficiente en Torreón (≤ 80 L/hab/día). ¡Excelente cultura hídrica!';
  } else if (lHab <= LITROS_OMS) {
    $('norm-estado').textContent =
      '✅ Dentro del estándar OMS (100 L), a ' +
      Math.round(lHab - REF_EFICIENTE) +
      ' L/hab de igualar al vecino eficiente (80 L).';
  } else if (lHab <= REF_ALTO) {
    $('norm-estado').textContent =
      '⚠️ Supera el límite OMS (+ ' +
      Math.round(lHab - LITROS_OMS) +
      ' L/hab), pero debajo del promedio residencial alto (180 L).';
  } else {
    $('norm-estado').textContent =
      '🚨 Excede el promedio residencial alto de 180 L/hab/día en +' +
      Math.round(lHab - REF_ALTO) +
      ' L/hab.';
  }

  $('agua').style.height = Math.min(pct, 100) + '%';
  $('tanque-texto').innerHTML =
    Math.round(pct) +
    '%<small>' +
    (desborde ? '¡Desbordado! +' + (L - cap) + ' L' : L + ' de ' + cap + ' L consumidos') +
    '</small>';
  $('tanque').classList.toggle('critico', desborde);
  document.body.classList.toggle('emergencia', desborde);

  const marca = $('marca-oms');
  marca.hidden = lim >= cap;
  marca.style.bottom = Math.min((lim / cap) * 100, 100) + '%';

  let nivel = '',
    titulo,
    lineas = [];
  if (L === 0) {
    titulo = 'Plano vacío';
    lineas.push('Arrastra dispositivos a las habitaciones e indica cuánto se usan.');
  } else {
    if (desborde) {
      nivel = 'critica';
      titulo = '⚠️ ALERTA: Almacenamiento agotado.';
      lineas.push(
        'Riesgo de extracción de agua profunda (Peligro de exposición a HACRE / Arsénico) en el acuífero de la Comarca Lagunera.'
      );
    } else if (fugas.cantidad) {
      nivel = 'riesgo';
      titulo = 'Eficiencia comprometida';
    } else if (L > lim) {
      nivel = 'riesgo';
      titulo = 'Sobre el límite OMS';
    } else if (pct >= 80) {
      nivel = 'riesgo';
      titulo = 'Margen ajustado';
    } else {
      titulo = 'Consumo dentro de los límites';
    }

    if (fugas.cantidad) {
      lineas.push(
        'Hay ' +
          fugas.cantidad +
          ' fuga(s): se pierden ' +
          fugas.litros +
          ' L/día (' +
          Math.round((fugas.litros / L) * 100) +
          ' % del consumo) y la eficiencia del almacenamiento está comprometida.'
      );
    }
    if (L > lim) {
      lineas.push(
        'El consumo supera el límite OMS de ' +
          lim +
          ' L/día para ' +
          Estado.habitantes +
          ' habitante(s).'
      );
    }
    if (!nivel) {
      lineas.push('Queda ' + Math.round(100 - pct) + ' % de reserva y se respeta el límite OMS.');
    }
  }

  // Construcción segura de #alerta + recomendación accionable
  const alertaEl = $('alerta');
  alertaEl.className = 'alerta ' + nivel;
  alertaEl.innerHTML = '';
  const st = document.createElement('strong');
  st.textContent = titulo;
  alertaEl.appendChild(st);
  alertaEl.appendChild(document.createTextNode(lineas.join(' ')));

  const recTexto = generarRecomendacion();
  if (recTexto) {
    const recEl = document.createElement('span');
    recEl.className = 'alerta__rec';
    recEl.textContent = recTexto;
    alertaEl.appendChild(recEl);
  }

  // Litros por habitación (rótulo + mapa de calor) y por piso (pestaña)
  const porSala = {},
    fugaEnSala = {},
    porPiso = {};
  Estado.dispositivos.forEach((d) => {
    const n = litrosDe(d),
      hab = Estado.habitaciones.get(d.sala);
    porSala[d.sala] = Math.round(((porSala[d.sala] || 0) + n) * 10) / 10;
    if (CATALOGO[d.tipo].fijo) {
      fugaEnSala[d.sala] = true;
    }
    if (hab) {
      porPiso[hab.piso] = Math.round(((porPiso[hab.piso] || 0) + n) * 10) / 10;
    }
  });

  document.querySelectorAll('.sala').forEach((s) => {
    const sid = s.dataset.sala,
      n = porSala[sid] || 0;
    s.querySelector('b').textContent = n ? '· ' + Math.round(n) + ' L' : '';
    if (fugaEnSala[sid]) {
      s.dataset.nivel = 'fuga';
    } else if (!n || L === 0) {
      delete s.dataset.nivel;
    } else if (n / L > 0.35) {
      s.dataset.nivel = 'alto';
    } else if (n / L >= 0.18) {
      s.dataset.nivel = 'medio';
    } else {
      s.dataset.nivel = 'bajo';
    }
  });

  document.querySelectorAll('.tab[data-piso]').forEach((t) => {
    const n = porPiso[t.dataset.piso];
    t.querySelector('small').textContent = n ? Math.round(n) + ' L' : '';
  });

  if (editandoId) {
    actualizarCalculoEditor();
  }
  actualizarGrafico(porSala);
  simRender(); // el caudal y los tiempos dependen de los dispositivos
}

/* ---------- Analítica: gráfico (Chart.js) y reporte PDF (jsPDF) ---------- */
let grafico = null;
const COLORES = [
  '#34D399',
  '#38BDF8',
  '#FBBF24',
  '#A78BFA',
  '#F472B6',
  '#FB923C',
  '#2DD4BF',
  '#94A3B8',
];

// Se invoca desde renderDashboard(), que a su vez dispara el Proxy: el gráfico nunca se llama a mano
function actualizarGrafico(porSala) {
  const ids = Object.keys(porSala).filter((id) => porSala[id] > 0),
    vacio = ids.length === 0;
  $('grafico-vacio').hidden = !vacio;
  $('grafico-consumo').style.visibility = vacio ? 'hidden' : 'visible';

  if (typeof Chart === 'undefined') {
    return;
  } // CDN no disponible: el resto sigue funcionando
  const multiPiso = Estado.pisos.size > 1;
  const etiquetas = ids.map((id) => {
    const hab = Estado.habitaciones.get(id);
    if (!hab) {
      return id;
    }
    if (!multiPiso) {
      return hab.nombre;
    }
    const piso = Estado.pisos.get(hab.piso);
    return hab.nombre + ' (' + (piso ? piso.nombre : '') + ')';
  });
  const valores = ids.map((id) => Math.round(porSala[id]));

  if (!grafico) {
    grafico = new Chart($('grafico-consumo'), {
      type: 'doughnut',
      data: {
        labels: etiquetas,
        datasets: [
          {
            data: valores,
            backgroundColor: COLORES,
            borderColor: '#0F1B18',
            borderWidth: 2,
          },
        ],
      },
      options: {
        maintainAspectRatio: false,
        cutout: '62%',
        animation: { duration: 400 },
        plugins: {
          legend: {
            position: 'bottom',
            labels: { color: '#8AA098', boxWidth: 10, font: { size: 11 } },
          },
          tooltip: {
            callbacks: {
              label: (c) =>
                ' ' +
                c.label +
                ': ' +
                c.parsed +
                ' L (' +
                Math.round((c.parsed / c.dataset.data.reduce((a, b) => a + b, 0)) * 100) +
                ' %)',
            },
          },
        },
      },
    });
  } else {
    grafico.data.labels = etiquetas;
    grafico.data.datasets[0].data = valores;
    grafico.update();
  }
}

function exportarPDF() {
  if (!window.jspdf) {
    // eslint-disable-next-line no-alert
    alert('No se pudo cargar jsPDF (revisa tu conexión a internet).');
    return;
  }
  const doc = new window.jspdf.jsPDF();
  const L = litrosTotales(),
    litrosMes = L * DIAS_MES,
    m3Mes = (litrosMes / 1000).toFixed(2),
    costo = L * COSTO_POR_LITRO,
    lim = limiteOMS(),
    lHab = (L / Estado.habitantes).toFixed(1),
    fugas = resumenFugas(),
    val = calcularValidacionSimas(L),
    rec = generarRecomendacion();
  let y = 20;
  const linea = (txt, tam, negrita) => {
    doc.setFont('helvetica', negrita ? 'bold' : 'normal');
    doc.setFontSize(tam || 11);
    doc.splitTextToSize(txt, 175).forEach((l) => {
      if (y > 275) {
        doc.addPage();
        y = 20;
      }
      doc.text(l, 18, y);
      y += (tam || 11) * 0.5 + 2;
    });
  };

  linea('SmartGota - Reporte de consumo e impacto hídrico (Torreón, Coah.)', 15, true);
  linea('Generado: ' + new Date().toLocaleString('es-MX'), 9);
  y += 4;

  linea('Resumen general', 13, true);
  linea(
    'Habitantes: ' +
      Estado.habitantes +
      ' | Almacenamiento: ' +
      Estado.capacidad +
      ' L | Consumo per cápita: ' +
      lHab +
      ' L/hab/día'
  );
  linea(
    'Consumo diario: ' +
      L +
      ' L | Consumo mensual estimado: ' +
      litrosMes.toLocaleString('es-MX') +
      ' L (' +
      m3Mes +
      ' m³)'
  );
  linea(
    'Costo diario: ' +
      pesos(costo) +
      ' MXN | Costo mensual estimado: ' +
      pesos(costo * DIAS_MES) +
      ' MXN'
  );
  linea(
    'Límite OMS: ' +
      lim +
      ' L/día (' +
      Math.round((L / lim) * 100) +
      ' % utilizado) | Referencias Torreón: Eficiente 80 L/hab, OMS 100 L/hab, Alto 180 L/hab'
  );
  y += 4;

  linea('Validación cuasi-experimental contra recibo SIMAS', 13, true);
  if (val.activo) {
    linea(
      'Volumen mensual simulado: ' +
        val.m3Simulado.toFixed(2) +
        ' m³/mes | Lectura física SIMAS: ' +
        val.m3Real.toFixed(2) +
        ' m³/mes'
    );
    linea(
      'Desviación absoluta: ' +
        Math.abs(val.difM3).toFixed(2) +
        ' m³/mes | Error relativo: ' +
        val.errorPct.toFixed(2) +
        ' % | Exactitud del modelo: ' +
        val.exactitudPct.toFixed(2) +
        ' %'
    );
  } else {
    linea(
      'Volumen mensual simulado: ' +
        val.m3Simulado.toFixed(2) +
        ' m³/mes (No se ingresó lectura del recibo físico SIMAS para contraste).'
    );
  }
  y += 4;

  linea('Consumo por habitación', 13, true);
  const porSala = {};
  Estado.dispositivos.forEach((d) => (porSala[d.sala] = (porSala[d.sala] || 0) + litrosDe(d)));
  Estado.habitaciones.forEach((h) => {
    if (porSala[h.id]) {
      linea(
        '- ' +
          h.nombre +
          ' (' +
          (Estado.pisos.get(h.piso) || {}).nombre +
          '): ' +
          Math.round(porSala[h.id]) +
          ' L/día (' +
          Math.round((porSala[h.id] / L) * 100) +
          ' %)'
      );
    }
  });
  if (!L) {
    linea('Sin consumo registrado.');
  }
  y += 4;

  linea('Fugas y recomendaciones de ahorro', 13, true);
  if (!fugas.cantidad) {
    linea('Ninguna fuga activa registrada.');
  }
  Estado.dispositivos.forEach((d) => {
    if (CATALOGO[d.tipo].fijo) {
      linea(
        '- Fuga en ' +
          ((Estado.habitaciones.get(d.sala) || {}).nombre || '?') +
          ': ' +
          litrosDe(d) +
          ' L/día'
      );
    }
  });
  if (rec) {
    linea(rec);
  }

  if (L > lim || fugas.cantidad) {
    y += 4;
    linea('ADVERTENCIA AMBIENTAL (COMARCA LAGUNERA)', 13, true);
    linea(
      (L > lim ? 'El consumo supera el límite de la OMS (' + lim + ' L/día). ' : '') +
        (fugas.cantidad ? 'Hay fugas activas que desperdician ' + fugas.litros + ' L/día. ' : '') +
        'En la Comarca Lagunera el agua subterránea presenta arsénico de origen natural (HACRE) en parte del acuífero; ' +
        'el sobreconsumo y las fugas aumentan la presión sobre la extracción de agua profunda.'
    );
  }
  y += 6;
  linea(
    'Valores estimados con el simulador SmartGota; validación sujeta a contraste con medidor físico SIMAS.',
    9
  );
  doc.save('reporte-smartgota.pdf');
}
$('btn-pdf').addEventListener('click', exportarPDF);

/* ---------- Pisos ---------- */
function crearPiso(nombre) {
  const id = 'p' + Estado.siguientePiso++;
  Estado.pisos.set(id, { id, nombre });
  return id;
}

// Reconstruye SOLO las pestañas (no los cuartos) a partir de Estado.pisos
function renderTabs() {
  $('tabs').innerHTML = '';
  Estado.pisos.forEach((p) => {
    const t = document.createElement('div');
    t.className = 'tab';
    t.dataset.piso = p.id;
    t.setAttribute('role', 'tab');
    t.innerHTML = '<span class="tab__nombre"></span><small></small>';
    t.querySelector('.tab__nombre').textContent = p.nombre; // textContent: sin HTML del usuario
    if (Estado.pisos.size > 1) {
      // con un solo piso no hay X
      const x = document.createElement('button');
      x.type = 'button';
      x.className = 'tab__x';
      x.textContent = '✕';
      x.title = 'Eliminar piso';
      x.setAttribute('aria-label', 'Eliminar piso');
      x.addEventListener('click', (e) => {
        e.stopPropagation();
        eliminarPiso(p.id);
      });
      t.appendChild(x);
    }
    t.addEventListener('click', () => activarPiso(p.id));
    $('tabs').appendChild(t);
  });
}

function activarPiso(id) {
  cerrarEditor();
  Estado.pisoActivo = id;
  document
    .querySelectorAll('.tab[data-piso]')
    .forEach((t) => t.classList.toggle('activa', t.dataset.piso === id));
  // hidden (no remove): conserva clones y el width/height que dejó el resize nativo
  document
    .querySelectorAll('.sala')
    .forEach((s) => (s.hidden = Estado.habitaciones.get(s.dataset.sala).piso !== id));
}

/* ===========================================================
   BORRADO EN CASCADA:  Piso -> Habitaciones -> Dispositivos
   eliminarPiso(p)
     └─ por cada habitación h con h.piso === p     (busca en Estado.habitaciones)
          └─ destruirHabitacion(h)
               ├─ borra de Estado.dispositivos todo d con d.sala === h  (sale del cálculo)
               ├─ borra h de Estado.habitaciones
               └─ remove() del nodo .sala (arrastra a sus clones del DOM)
     └─ borra p de Estado.pisos, elige otra pestaña activa (el Proxy repinta y guarda solo)
   =========================================================== */
function destruirHabitacion(id) {
  dispositivosDe(id).forEach((k) => {
    if (k === editandoId) {
      cerrarEditor();
    }
    Estado.dispositivos.delete(k);
  });
  Estado.habitaciones.delete(id);
  salaEl(id).remove();
}

/* ---------- Modal UI (Promise: modalPrompt / modalConfirm) ---------- */
let resolverModal = null;

function abrirModal({ titulo, mensaje = '', inicial = '', confirmar = false }) {
  if (resolverModal) {
    resolverModal(confirmar ? false : null);
  }
  const modal = $('modal'),
    msgEl = $('modal-msg'),
    inp = $('modal-input');

  $('modal-titulo').textContent = titulo;
  msgEl.textContent = mensaje;
  msgEl.hidden = !mensaje;

  inp.hidden = confirmar;
  if (!confirmar) {
    inp.value = inicial || '';
  }

  modal.hidden = false;
  queueMicrotask(() => {
    if (confirmar) {
      $('modal-ok').focus();
    } else {
      inp.focus();
      inp.select();
    }
  });

  return new Promise((resolve) => {
    resolverModal = (val) => {
      resolverModal = null;
      modal.hidden = true;
      resolve(val);
    };
  });
}

const modalPrompt = (titulo, inicial = '') => abrirModal({ titulo, inicial, confirmar: false });

const modalConfirm = (mensaje, titulo = 'Confirmar acción') =>
  abrirModal({ titulo, mensaje, confirmar: true });

$('modal-form').addEventListener('submit', (e) => {
  e.preventDefault();
  if (!resolverModal) {
    return;
  }
  const esConfirm = $('modal-input').hidden;
  resolverModal(esConfirm ? true : $('modal-input').value.trim().slice(0, 28) || null);
});

$('modal-cancelar').addEventListener('click', () => {
  if (resolverModal) {
    resolverModal($('modal-input').hidden ? false : null);
  }
});

$('modal').addEventListener('click', (e) => {
  if (e.target === $('modal') && resolverModal) {
    resolverModal($('modal-input').hidden ? false : null);
  }
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !$('modal').hidden && resolverModal) {
    resolverModal($('modal-input').hidden ? false : null);
  }
});

async function eliminarPiso(id) {
  if (Estado.pisos.size <= 1) {
    return;
  } // siempre debe quedar un piso
  const salas = [...Estado.habitaciones.values()].filter((h) => h.piso === id).map((h) => h.id);
  const nDisp = salas.reduce((suma, sid) => suma + dispositivosDe(sid).length, 0);
  if (
    salas.length &&
    !(await modalConfirm(
      '«' +
        Estado.pisos.get(id).nombre +
        '» tiene ' +
        salas.length +
        ' habitación(es) y ' +
        nDisp +
        ' dispositivo(s). Todo se eliminará. ¿Continuar?',
      'Eliminar piso'
    ))
  ) {
    return;
  }

  salas.forEach((sid) => destruirHabitacion(sid)); // nivel 2 -> nivel 3
  Estado.pisos.delete(id);
  if (Estado.pisoActivo === id) {
    Estado.pisoActivo = Estado.pisos.keys().next().value;
  }
  renderTabs();
  activarPiso(Estado.pisoActivo);
}

/* ---------- Habitaciones ---------- */
function crearHabitacion(nombre, piso) {
  const id = 'h' + Estado.siguienteSala++;
  Estado.habitaciones.set(id, { id, nombre, piso, cs: 1, rs: 1 }); // cs/rs = columnas y filas que ocupa
  return montarHabitacion(Estado.habitaciones.get(id));
}

// Construye el nodo .sala desde su registro (al crearla y al restaurar desde localStorage)
function montarHabitacion(hab) {
  const { id, nombre, piso } = hab;

  const el = document.createElement('div');
  el.className = 'sala';
  el.dataset.sala = id;
  el.hidden = piso !== Estado.pisoActivo;
  el.innerHTML =
    '<span class="sala__mover" draggable="true" title="Arrastra para reordenar habitación" aria-label="Reordenar habitación">⠿</span>' +
    '<span class="sala__rotulo" title="Doble clic para renombrar"><em></em><b></b></span>' +
    '<button class="sala__x" type="button" title="Eliminar habitación" aria-label="Eliminar habitación">✕</button>' +
    '<span class="sala__asa" title="Arrastra para cambiar el tamaño"></span>';
  el.querySelector('em').textContent = nombre;

  const btnMover = el.querySelector('.sala__mover');
  btnMover.addEventListener('dragstart', (e) => {
    e.stopPropagation();
    cerrarEditor();
    empezarArrastre(e, { salaOrigen: id });
    if (e.dataTransfer.setDragImage) {
      e.dataTransfer.setDragImage(el, 16, 16);
    }
    setTimeout(() => el.classList.add('arrastrando-sala'));
  });
  btnMover.addEventListener('dragend', () => {
    arrastre = null;
    el.classList.remove('arrastrando-sala');
    document
      .querySelectorAll('.sala.destino-sala')
      .forEach((s) => s.classList.remove('destino-sala'));
  });

  el.querySelector('.sala__x').addEventListener('click', () => eliminarHabitacion(id));
  el.querySelector('.sala__rotulo').addEventListener('dblclick', () => renombrarHabitacion(id));
  activarSala(el);
  activarRedimension(el, id);
  aplicarSpans(el, hab);
  $('plano').appendChild(el);
  return el;
}

function reordenarHabitaciones(origenId, destinoId) {
  if (!origenId || !destinoId || origenId === destinoId) {
    return;
  }
  const elOrig = salaEl(origenId),
    elDest = salaEl(destinoId);
  if (!elOrig || !elDest) {
    return;
  }

  const siguiente =
    elOrig.compareDocumentPosition(elDest) & Node.DOCUMENT_POSITION_FOLLOWING
      ? elDest.nextElementSibling
      : elDest;
  $('plano').insertBefore(elOrig, siguiente);

  // Sincroniza el nuevo orden del DOM en Estado.habitaciones (persiste en localStorage)
  const nuevoOrden = [];
  document.querySelectorAll('#plano > .sala').forEach((s) => {
    const sid = s.dataset.sala,
      h = Estado.habitaciones.get(sid);
    if (h) {
      nuevoOrden.push([sid, { ...h }]);
    }
  });

  pausado = true;
  try {
    Estado.habitaciones.clear();
    nuevoOrden.forEach(([k, v]) => Estado.habitaciones.set(k, v));
  } finally {
    pausado = false;
  }
  notificar();
}

async function renombrarHabitacion(id) {
  const hab = Estado.habitaciones.get(id),
    nombre = await modalPrompt('Nuevo nombre de la habitación:', hab.nombre);
  if (!nombre) {
    return;
  }
  hab.nombre = nombre;
  salaEl(id).querySelector('em').textContent = nombre;
}

async function eliminarHabitacion(id) {
  const n = dispositivosDe(id).length,
    hab = Estado.habitaciones.get(id);
  if (
    n &&
    !(await modalConfirm(
      '«' +
        hab.nombre +
        '» tiene ' +
        n +
        ' dispositivo(s). Se eliminarán y dejarán de contar en el consumo. ¿Continuar?',
      'Eliminar habitación'
    ))
  ) {
    return;
  }
  destruirHabitacion(id);
}

/* ---------- Layout: redimensionado por celdas (Grid Spans) ---------- */
const limitar = (n, min, max) => Math.min(Math.max(n, min), max);
const MAX_FILAS = 6;

// Medidas reales de la grilla, leídas del CSS ya resuelto por el navegador
function medidasGrid() {
  const e = getComputedStyle($('plano')),
    pistas = e.gridTemplateColumns.split(' ');
  return {
    cols: pistas.length,
    ancho: parseFloat(pistas[0]),
    alto: parseFloat(e.gridAutoRows),
    hueco: parseFloat(e.columnGap),
  };
}

// Tamaño lógico (cs x rs celdas) -> variables CSS que consumen grid-column / grid-row: span
function aplicarSpans(sala, hab) {
  sala.style.setProperty('--cs', Math.min(hab.cs, medidasGrid().cols)); // nunca más columnas de las que caben
  sala.style.setProperty('--rs', hab.rs);
}

// Asa de la esquina: convierte píxeles arrastrados en nº de celdas ("pega" a la cuadrícula)
function activarRedimension(sala, id) {
  const asa = sala.querySelector('.sala__asa');
  asa.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    asa.setPointerCapture(e.pointerId);
    sala.classList.add('redimensionando');
    const hab = Estado.habitaciones.get(id);
    const mover = (ev) => {
      const m = medidasGrid(),
        caja = sala.getBoundingClientRect();
      hab.cs = limitar(
        Math.round((ev.clientX - caja.left + m.hueco) / (m.ancho + m.hueco)),
        1,
        m.cols
      );
      hab.rs = limitar(
        Math.round((ev.clientY - caja.top + m.hueco) / (m.alto + m.hueco)),
        1,
        MAX_FILAS
      );
      aplicarSpans(sala, hab);
    };
    const soltar = () => {
      sala.classList.remove('redimensionando');
      ['pointermove', 'pointerup', 'pointercancel'].forEach((t, i) =>
        asa.removeEventListener(t, [mover, soltar, soltar][i])
      );
    };
    asa.addEventListener('pointermove', mover);
    asa.addEventListener('pointerup', soltar);
    asa.addEventListener('pointercancel', soltar);
  });
}

// Si la ventana se estrecha y caben menos columnas, reajusta sin perder el tamaño lógico guardado
new ResizeObserver(() => Estado.habitaciones.forEach((h) => aplicarSpans(salaEl(h.id), h))).observe(
  $('plano')
);

/* ---------- Drag & Drop ---------- */
let arrastre = null; // dragover no puede leer getData(): recordamos aquí el arrastre en curso

function empezarArrastre(e, datos) {
  arrastre = datos;
  e.dataTransfer.setData('text/plain', JSON.stringify(datos));
  e.dataTransfer.effectAllowed = datos.id || datos.salaOrigen ? 'move' : 'copy';
}

function construirPaleta() {
  for (const tipo in CATALOGO) {
    const c = CATALOGO[tipo],
      el = document.createElement('div');
    el.className = 'item';
    el.draggable = true;
    el.dataset.tipo = tipo;
    el.innerHTML =
      '<span class="ico">' +
      c.icono +
      '</span><div><b>' +
      c.nombre +
      '</b><small>' +
      c.flujo +
      ' ' +
      c.medida +
      (c.fijo ? ' · fijo' : '') +
      '</small></div>';
    el.addEventListener('dragstart', (e) => empezarArrastre(e, { tipo }));
    el.addEventListener('dragend', () => (arrastre = null));
    el.addEventListener('click', () => seleccionarItem(seleccion === tipo ? null : tipo)); // flujo táctil
    $('paleta').appendChild(el);
  }
}

// Tap-to-place: 1) tocar un ítem de la paleta lo selecciona; 2) tocar una sala lo coloca al centro
let seleccion = null;
function seleccionarItem(tipo) {
  seleccion = tipo;
  document
    .querySelectorAll('.item')
    .forEach((i) => i.classList.toggle('seleccionado', i.dataset.tipo === tipo));
  document.body.classList.toggle('colocando', !!tipo);
}
function colocarSeleccion(e, sala) {
  if (!seleccion || e.target.closest('.clon, .sala__x, .sala__asa, .sala__rotulo, .sala__mover')) {
    return;
  }
  const id = agregarDispositivo(seleccion, sala, 0.5, 0.5); // 0.5/0.5 = centro de la habitación
  seleccionarItem(null);
  abrirEditor(id);
}

function activarSala(sala) {
  // una llamada por sala, incluidas las creadas en caliente
  sala.addEventListener('dragenter', (e) => {
    if (!arrastre) {
      return;
    }
    if (arrastre.salaOrigen) {
      if (arrastre.salaOrigen !== sala.dataset.sala) {
        e.preventDefault();
        sala.classList.add('destino-sala');
      }
      return;
    }
    e.preventDefault();
    sala.classList.add('sobre');
  });
  sala.addEventListener('dragover', (e) => {
    if (!arrastre) {
      return;
    }
    if (arrastre.salaOrigen) {
      if (arrastre.salaOrigen !== sala.dataset.sala) {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
      }
      return;
    }
    e.preventDefault();
    e.dataTransfer.dropEffect = arrastre.id ? 'move' : 'copy';
  });
  sala.addEventListener('dragleave', (e) => {
    if (!sala.contains(e.relatedTarget)) {
      sala.classList.remove('sobre', 'destino-sala');
    }
  });
  sala.addEventListener('drop', alSoltar);
  sala.addEventListener('click', (e) => colocarSeleccion(e, sala));
}

function coordenadasEnSala(e, sala) {
  const caja = sala.getBoundingClientRect();
  const x = e.clientX - caja.left - sala.clientLeft - TAM / 2;
  const y = e.clientY - caja.top - sala.clientTop - TAM / 2;
  const libre = (n, total) => limitar(n / Math.max(total - TAM, 1), 0, 1); // fracción del espacio libre
  return { x: libre(x, sala.clientWidth), y: libre(y, sala.clientHeight) };
}

function alSoltar(e) {
  e.preventDefault();
  const sala = e.currentTarget;
  sala.classList.remove('sobre', 'destino-sala');
  if (!arrastre) {
    return;
  }

  const datos = JSON.parse(e.dataTransfer.getData('text/plain'));
  if (datos.salaOrigen) {
    reordenarHabitaciones(datos.salaOrigen, sala.dataset.sala);
    return;
  }

  const { x, y } = coordenadasEnSala(e, sala);
  let nuevoId = null;

  if (datos.id) {
    moverDispositivo(datos.id, sala, x, y);
  } else {
    nuevoId = agregarDispositivo(datos.tipo, sala, x, y);
  }

  if (nuevoId) {
    abrirEditor(nuevoId);
  }
}

/* ---------- Clones ---------- */
// Se guarda la fracción del ESPACIO LIBRE (sala menos ícono) y CSS la resuelve con calc():
// al estirar o encoger la sala con resize, el clon se reubica solo y nunca se sale de la caja.
function posicionar(el, fx, fy) {
  el.style.left = 'calc((100% - ' + TAM + 'px) * ' + fx.toFixed(4) + ')';
  el.style.top = 'calc((100% - ' + TAM + 'px) * ' + fy.toFixed(4) + ')';
}

function refrescarClon(el) {
  const d = Estado.dispositivos.get(el.id),
    c = CATALOGO[d.tipo],
    litros = litrosDe(d),
    modoInfo = c.modos && d.modo && c.modos[d.modo] ? ' (' + c.modos[d.modo].nombre + ')' : '';
  el.querySelector('small').textContent = Math.round(litros);
  el.title =
    c.nombre +
    modoInfo +
    ': ' +
    litros +
    ' L/día' +
    (c.fijo ? ' (gasto fijo)' : ' · clic para ajustar · doble clic para quitar');
}

function crearClon(id, tipo) {
  const el = document.createElement('div');
  el.className = 'clon';
  el.id = id;
  el.draggable = true;
  if (CATALOGO[tipo].fijo) {
    el.dataset.fijo = '1';
  }
  el.appendChild(document.querySelector('.item[data-tipo="' + tipo + '"] .ico').cloneNode(true));
  el.insertAdjacentHTML('beforeend', '<small></small>');
  refrescarClon(el);

  el.addEventListener('dragstart', (e) => {
    cerrarEditor();
    empezarArrastre(e, { tipo, id });
    setTimeout(() => {
      if (!arrastre || arrastre.id !== id) {
        return;
      } // el arrastre ya terminó
      el.classList.add('arrastrando');
      document.body.classList.add('arrastrando-disp'); // muestra la papelera
    });
  });
  el.addEventListener('dragend', () => {
    arrastre = null;
    el.classList.remove('arrastrando');
    document.body.classList.remove('arrastrando-disp');
  });
  el.addEventListener('click', () => abrirEditor(id));
  el.addEventListener('dblclick', () => eliminarDispositivo(id));
  return el;
}

function agregarDispositivo(tipo, sala, fx, fy) {
  const id = 'd' + Estado.siguienteId++,
    c = CATALOGO[tipo];
  Estado.dispositivos.set(id, {
    tipo,
    sala: sala.dataset.sala,
    fx,
    fy,
    uso_personalizado: c.sugerido,
    frecuencia: c.frecuenciaInicial || 'dia',
    modo: c.modoInicial || 'estandar',
  });
  montarDispositivo(id);
  return id;
}

// Dibuja el clon desde su registro (al soltar, con tap-to-place y al restaurar)
function montarDispositivo(id) {
  const d = Estado.dispositivos.get(id),
    sala = salaEl(d.sala);
  if (!sala) {
    return;
  }
  const el = crearClon(id, d.tipo);
  sala.appendChild(el);
  posicionar(el, d.fx, d.fy);
}

function moverDispositivo(id, sala, fx, fy) {
  const d = Estado.dispositivos.get(id);
  if (!d) {
    return;
  }
  d.sala = sala.dataset.sala;
  d.fx = fx;
  d.fy = fy; // el Proxy detecta el cambio: repinta y guarda
  const el = $(id);
  sala.appendChild(el);
  posicionar(el, fx, fy);
}

function eliminarDispositivo(id) {
  if (editandoId === id) {
    cerrarEditor();
  }
  const el = $(id);
  if (el) {
    el.remove();
  }
  Estado.dispositivos.delete(id); // el Proxy repinta y guarda solo
}

/* ---------- Papelera: arrastrar un dispositivo ya colocado aquí lo elimina ---------- */
const papelera = $('papelera');
const idArrastrado = () => (arrastre && arrastre.id) || null; // los del catálogo no tienen id

papelera.addEventListener('dragenter', (e) => {
  if (!idArrastrado()) {
    return;
  }
  e.preventDefault();
  papelera.classList.add('sobre');
});
papelera.addEventListener('dragover', (e) => {
  if (!idArrastrado()) {
    return;
  }
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
});
papelera.addEventListener('dragleave', (e) => {
  if (!papelera.contains(e.relatedTarget)) {
    papelera.classList.remove('sobre');
  }
});
papelera.addEventListener('drop', (e) => {
  e.preventDefault();
  const id = idArrastrado();
  arrastre = null;
  papelera.classList.remove('sobre');
  document.body.classList.remove('arrastrando-disp');
  if (id) {
    eliminarDispositivo(id);
  }
});

/* ---------- Editor flotante paramétrico (uso, frecuencia, modalidad y habitantes) ---------- */
let editandoId = null;

function abrirEditor(id) {
  const d = Estado.dispositivos.get(id),
    c = d && CATALOGO[d.tipo];
  if (!d || c.fijo) {
    return cerrarEditor();
  }
  cerrarEditor();
  editandoId = id;
  $(id).classList.add('editando');
  $('ed-nombre').textContent = c.icono + ' ' + c.nombre;
  $('ed-etiqueta').textContent = c.unidad;
  $('ed-uso').value = d.uso_personalizado;
  $('ed-frecuencia').value = d.frecuencia || 'dia';

  const selModo = $('ed-modo'),
    grupoModo = $('ed-grupo-modo');
  selModo.innerHTML = '';
  if (c.modos) {
    grupoModo.hidden = false;
    Object.entries(c.modos).forEach(([clave, info]) => {
      const op = document.createElement('option');
      op.value = clave;
      op.textContent = info.nombre;
      selModo.appendChild(op);
    });
    selModo.value = d.modo || c.modoInicial;
  } else {
    grupoModo.hidden = true;
  }

  $('ed-btn-hab').hidden = !c.porHabitante;
  actualizarCalculoEditor();

  const ed = $('editor'),
    caja = $(id).getBoundingClientRect();
  ed.hidden = false;
  ed.style.left = Math.max(8, Math.min(caja.left, innerWidth - ed.offsetWidth - 12)) + 'px';
  ed.style.top = Math.max(8, Math.min(caja.bottom + 8, innerHeight - ed.offsetHeight - 12)) + 'px';
  $('ed-uso').focus();
  $('ed-uso').select();
}

function cerrarEditor() {
  if (editandoId && $(editandoId)) {
    $(editandoId).classList.remove('editando');
  }
  editandoId = null;
  $('editor').hidden = true;
}

function actualizarCalculoEditor() {
  if (!editandoId) {
    return;
  }
  const d = Estado.dispositivos.get(editandoId);
  if (!d) {
    return;
  }
  const c = CATALOGO[d.tipo],
    f = flujoDe(d),
    esSem = d.frecuencia === 'semana';

  $('ed-calculo').textContent =
    f +
    ' ' +
    c.medida +
    ' × ' +
    d.uso_personalizado +
    (esSem ? '/sem ÷ 7 = ' : '/día = ') +
    litrosDe(d) +
    ' L/día';

  if (c.porHabitante) {
    const mult = limitar(d.uso_personalizado * Estado.habitantes, 0, 999);
    $('ed-btn-hab').textContent =
      '👥 Multiplicar × ' +
      Estado.habitantes +
      ' hab. (→ ' +
      mult +
      ' ' +
      c.unidad.toLowerCase() +
      ')';
  }
}

$('ed-uso').addEventListener('input', (e) => {
  const d = Estado.dispositivos.get(editandoId);
  if (!d) {
    return;
  }
  d.uso_personalizado = entero(e.target.value, 0, 999);
  refrescarClon($(editandoId));
  actualizarCalculoEditor();
});
$('ed-uso').addEventListener('change', (e) => {
  const d = Estado.dispositivos.get(editandoId);
  if (d) {
    e.target.value = d.uso_personalizado;
  }
});
$('ed-frecuencia').addEventListener('change', (e) => {
  const d = Estado.dispositivos.get(editandoId);
  if (!d) {
    return;
  }
  d.frecuencia = e.target.value;
  refrescarClon($(editandoId));
  actualizarCalculoEditor();
});
$('ed-modo').addEventListener('change', (e) => {
  const d = Estado.dispositivos.get(editandoId);
  if (!d) {
    return;
  }
  d.modo = e.target.value;
  refrescarClon($(editandoId));
  actualizarCalculoEditor();
});
$('ed-btn-hab').addEventListener('click', () => {
  const d = Estado.dispositivos.get(editandoId);
  if (!d) {
    return;
  }
  d.uso_personalizado = limitar(d.uso_personalizado * Estado.habitantes, 0, 999);
  $('ed-uso').value = d.uso_personalizado;
  refrescarClon($(editandoId));
  actualizarCalculoEditor();
});

document.addEventListener('click', (e) => {
  if (!e.target.closest('#editor, .clon')) {
    cerrarEditor();
  }
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    cerrarEditor();
    seleccionarItem(null);
  }
});

/* ---------- Simulación en tiempo real ----------
   El tinaco de la simulación se vacía con el consumo de los dispositivos del plano y se
   llena con el agua que entra de la red (SIMAS). Vive FUERA de Estado a propósito: cambia
   ~60 veces por segundo y, dentro del Proxy, cada cambio repintaría el dashboard y
   escribiría en localStorage. */
const LIMITE_BOMBA = 0.2, // bajo el 20 % del tanque la bomba corre riesgo
  SEG_DIA = 86400;

// Pesos horarios w(0..23) cuya suma exacta es 24.00: garantiza que la integral de 24 h sea igual a litrosTotales()
const PESOS_HORA = [
  0.08,
  0.08,
  0.08,
  0.08,
  0.08, // 00:00–05:00 Madrugada (suma = 0.40)
  0.6, // 05:00–06:00 Inicio matutino (suma = 0.60)
  2.6,
  2.6,
  2.6, // 06:00–09:00 Hora pico matutina (suma = 7.80)
  0.7,
  0.7,
  0.7,
  0.7, // 09:00–13:00 Media mañana (suma = 2.80)
  2.1,
  2.1, // 13:00–15:00 Hora pico mediodía (suma = 4.20)
  0.65,
  0.65,
  0.65,
  0.65, // 15:00–19:00 Tarde normal (suma = 2.60)
  1.7,
  1.7,
  1.7, // 19:00–22:00 Hora pico nocturna (suma = 5.10)
  0.25,
  0.25, // 22:00–24:00 Noche baja (suma = 0.50)
]; // Suma exacta = 24.00

// Agua que entra de la red, en L/min.
const ENTRADAS_RED = {
  normal: { nombre: 'Presión normal', lmin: 6 },
  baja: { nombre: 'Presión baja', lmin: 1 },
  ninguna: { nombre: 'Sin entrada de agua', lmin: 0 },
};

const Sim = {
  corriendo: false,
  velocidad: 3600, // segundos simulados por segundo real
  red: 'ninguna', // clave de ENTRADAS_RED
  patron: 'realista', // "realista" (curva horaria con picos) | "continuo" (parejo 24 h)
  nivel: null, // litros que hay (null = se inicializa al primer render)
  tiempo: 0, // segundos simulados transcurridos
  ultimo: 0,
  raf: 0,
  estado: null,
};

const MENSAJES_SIM = {
  vacio: {
    nivel: 'critica',
    titulo: '⚠️ Tanque vacío',
    texto:
      'El agua se terminó. La bomba trabajaría en seco y puede dañarse. Rellena el tanque para continuar.',
  },
  critico: {
    nivel: 'critica',
    titulo: '⚠️ Nivel crítico: 20 % o menos',
    texto:
      'Con tan poca agua la bomba puede succionar los sedimentos del fondo o aspirar aire, y eso puede dañarla. Apágala o rellena el tanque.',
  },
  sinconsumo: {
    nivel: '',
    titulo: 'Sin consumo',
    texto: 'Agrega dispositivos al plano para ver cómo cambia el nivel del tanque.',
  },
  seguro: {
    nivel: '',
    titulo: 'Nivel seguro',
    texto: 'El tanque está por encima del 20 %: la bomba opera sin riesgo.',
  },
};

// Opciones del selector de red, generadas desde ENTRADAS_RED (única fuente de verdad)
Object.entries(ENTRADAS_RED).forEach(([clave, e]) => {
  const op = document.createElement('option');
  op.value = clave;
  op.textContent = e.nombre + (e.lmin ? ' · ' + e.lmin + ' L/min' : '');
  $('sim-red').appendChild(op);
});
$('sim-red').value = Sim.red;
$('sim-patron').value = Sim.patron;

function horaActualSim() {
  return Math.floor((Sim.tiempo % SEG_DIA) / 3600);
}

function etiquetaFranja(h) {
  if (Sim.patron === 'continuo') {
    return '⚖️ Flujo continuo (24 h)';
  }
  if (h < 5) {
    return '🌙 Madrugada (solo fugas / mín.)';
  }
  if (h < 6) {
    return '🌅 Inicio de actividad';
  }
  if (h < 9) {
    return '🚿 Hora pico matutina (2.6×)';
  }
  if (h >= 13 && h < 15) {
    return '☀️ Hora pico mediodía (2.1×)';
  }
  if (h >= 19 && h < 22) {
    return '🌆 Hora pico nocturna (1.7×)';
  }
  if (h >= 22) {
    return '🌙 Noche baja';
  }
  return '🕒 Horario normal';
}

// Segundos simulados -> "2 d 5 h", "3 h 20 min", "12 min"
function formatoDuracion(s) {
  if (!isFinite(s)) {
    return '—';
  }
  const min = Math.floor(s / 60),
    h = Math.floor(min / 60),
    d = Math.floor(h / 24);
  if (d >= 1) {
    return d + ' d ' + (h % 24) + ' h';
  }
  if (h >= 1) {
    return h + ' h ' + (min % 60) + ' min';
  }
  return min >= 1 ? min + ' min' : '< 1 min';
}

function formatoReloj(s) {
  const dia = Math.floor(s / SEG_DIA) + 1,
    hh = Math.floor((s % SEG_DIA) / 3600),
    mm = Math.floor((s % 3600) / 60);
  return 'Día ' + dia + ' · ' + String(hh).padStart(2, '0') + ':' + String(mm).padStart(2, '0');
}

// Flujos en litros por segundo simulado. En modo "realista", las fugas ocurren parejo 24 h
// y el gasto humano se modula según PESOS_HORA[h]. Con el tanque lleno, el flotador cierra la entrada.
function simFlujos() {
  const totalDia = litrosTotales(),
    fugasDia = resumenFugas().litros,
    humanoDia = Math.max(0, totalDia - fugasDia),
    factorHora = Sim.patron === 'realista' ? PESOS_HORA[horaActualSim()] : 1,
    consumo = (fugasDia + humanoDia * factorHora) / SEG_DIA,
    entrada = ENTRADAS_RED[Sim.red].lmin / 60;

  if (Sim.nivel >= Estado.capacidad && entrada >= consumo) {
    return { consumo, entrada: consumo, neto: 0, totalDia };
  }
  return { consumo, entrada, neto: entrada - consumo, totalDia };
}

function simRender() {
  const cap = Estado.capacidad;
  if (Sim.nivel === null || Sim.nivel > cap) {
    Sim.nivel = cap;
  }
  const f = simFlujos(),
    limite = cap * LIMITE_BOMBA,
    pct = (Sim.nivel / cap) * 100,
    lmin = (n) => (n * 60).toFixed(2) + ' L/min',
    neto = f.neto * 60;

  const estado =
    Sim.nivel <= 0
      ? 'vacio'
      : Sim.nivel <= limite
        ? 'critico'
        : f.totalDia === 0
          ? 'sinconsumo'
          : 'seguro';

  $('sim-agua').style.height = pct + '%';
  $('sim-pct').textContent = Math.round(pct) + '%';
  $('sim-litros').textContent =
    Math.round(Sim.nivel).toLocaleString('es-MX') + ' de ' + cap.toLocaleString('es-MX') + ' L';
  $('sim-tanque').classList.toggle('critico', estado === 'critico' || estado === 'vacio');

  $('sim-m-nivel').textContent = Math.round(Sim.nivel) + ' L';
  $('sim-m-consumo').textContent = lmin(f.consumo);
  $('sim-m-entrada').textContent = lmin(f.entrada);
  $('sim-m-balance').textContent =
    (neto > 0 ? '+' : neto < 0 ? '−' : '') + Math.abs(neto).toFixed(2) + ' L/min';
  $('sim-m-tiempo').textContent = formatoReloj(Sim.tiempo);
  $('sim-m-franja').textContent = etiquetaFranja(horaActualSim());
  $('sim-m-lleno').textContent =
    Sim.nivel >= cap ? 'Lleno' : f.neto > 0 ? formatoDuracion((cap - Sim.nivel) / f.neto) : '—';
  $('sim-m-limite').textContent =
    Sim.nivel <= limite
      ? 'Superado'
      : f.neto < 0
        ? formatoDuracion((Sim.nivel - limite) / -f.neto)
        : '—';
  $('sim-m-vacio').textContent =
    Sim.nivel <= 0 ? 'Vacío' : f.neto < 0 ? formatoDuracion(Sim.nivel / -f.neto) : '—';

  // El aviso solo se reescribe al cambiar de estado (no en cada fotograma)
  if (estado !== Sim.estado) {
    Sim.estado = estado;
    const m = MENSAJES_SIM[estado];
    $('sim-alerta').className = 'alerta ' + m.nivel;
    $('sim-alerta').innerHTML = '<strong>' + m.titulo + '</strong>' + m.texto;
  }
}

function simPaso(t) {
  if (!Sim.corriendo) {
    return;
  }
  // tope de 0.1 s: si la pestaña estuvo oculta, no hay un salto brusco al volver
  const dt = Math.min((t - Sim.ultimo) / 1000, 0.1);
  Sim.ultimo = t;

  // Integración exacta por fronteras horarias para conservar la integral de 24 h a cualquier velocidad
  let restante = dt * Sim.velocidad;
  while (restante > 0) {
    const segEnHora = 3600 - (Sim.tiempo % 3600);
    const paso = Math.min(restante, segEnHora > 0 ? segEnHora : 3600);
    const f = simFlujos();
    Sim.nivel = Math.min(Math.max(Sim.nivel + f.neto * paso, 0), Estado.capacidad);
    Sim.tiempo += paso;
    restante -= paso;
    if (Sim.nivel <= 0 && f.neto <= 0) {
      simPausar();
      break;
    }
  }

  simRender();
  if (Sim.corriendo) {
    Sim.raf = requestAnimationFrame(simPaso);
  }
}

function simIniciar() {
  if (Sim.nivel !== null && Sim.nivel <= 0 && simFlujos().neto <= 0) {
    simReiniciar();
  }
  Sim.corriendo = true;
  Sim.ultimo = performance.now();
  $('sim-play').textContent = '⏸ Pausar';
  Sim.raf = requestAnimationFrame(simPaso);
}

function simPausar() {
  Sim.corriendo = false;
  cancelAnimationFrame(Sim.raf);
  $('sim-play').textContent = '▶ Iniciar';
}

function simReiniciar() {
  simPausar();
  Sim.nivel = Estado.capacidad;
  Sim.tiempo = 0;
  Sim.estado = null; // fuerza a reescribir el aviso
  simRender();
}

$('sim-play').addEventListener('click', () => (Sim.corriendo ? simPausar() : simIniciar()));
$('sim-reset').addEventListener('click', simReiniciar);
$('sim-vel').addEventListener('change', (e) => {
  Sim.velocidad = Number(e.target.value);
});
$('sim-red').addEventListener('change', (e) => {
  Sim.red = e.target.value;
  simRender();
});
$('sim-patron').addEventListener('change', (e) => {
  Sim.patron = e.target.value;
  simRender();
});

/* ---------- Inputs globales y arranque ---------- */
[$('ed-uso'), $('habitantes')].forEach((inp) =>
  inp.addEventListener('keydown', (e) => {
    if (['.', ',', 'e', 'E', '-', '+'].includes(e.key)) {
      e.preventDefault();
    }
  })
);

$('recibo-simas').addEventListener('keydown', (e) => {
  if (['e', 'E', '-', '+'].includes(e.key)) {
    e.preventDefault();
  }
});
$('recibo-simas').addEventListener('input', (e) => {
  const v = parseFloat(e.target.value);
  Estado.reciboSimas = isNaN(v) || v <= 0 ? 0 : Math.min(v, 999);
});

$('habitantes').addEventListener('input', (e) => {
  Estado.habitantes = entero(e.target.value, 1, 50);
});
$('habitantes').addEventListener('change', (e) => (e.target.value = Estado.habitantes));
$('capacidad').addEventListener('change', (e) => {
  Estado.capacidad = parseInt(e.target.value, 10);
  simReiniciar(); // otro tanque = simulación nueva
});

$('btn-piso').addEventListener('click', async () => {
  const nombre = await modalPrompt('Nombre del piso (ej. Planta Alta, Azotea):');
  if (!nombre) {
    return;
  }
  const id = crearPiso(nombre);
  renderTabs();
  activarPiso(id); // salta al piso recién creado
});

$('btn-sala').addEventListener('click', async () => {
  const nombre = await modalPrompt('Nombre de la habitación (ej. Baño principal):');
  if (nombre) {
    crearHabitacion(nombre, Estado.pisoActivo);
  }
});

construirPaleta();
cargarEstado(); // restaura localStorage o siembra la Planta Baja de ejemplo
simReiniciar(); // tanque de la simulación lleno y en pausa
