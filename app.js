/* SmartGota — app.js (v50) */
'use strict';

// Núcleo de cálculo compartido con dominio.js (script clásico previo)
const {
  CATALOGO,
  TASAS_FUGA,
  ROLES_SALA,
  normalizarPerfil,
  esTipoSala,
  tipoSala,
  flujoDe,
  litrosConFlujo,
  baseUso,
  repartirCuota,
  normalizarCasoFuga,
  generarCasoFuga,
} = SmartGotaDominio;

const CONFIG = {
  diasMes: 30,
  tamClon: 44,
};

// Formateador único para cifras y plurales en español
const NUM_ES = new Intl.NumberFormat('es-MX');

function litrosTexto(n) {
  return NUM_ES.format(Math.round(n)) + ' L';
}

function plural(n, singular, pluralText) {
  return NUM_ES.format(n) + ' ' + (n === 1 ? singular : pluralText);
}

// Marcas invisibles para resaltar texto con <strong> usando textContent (sin innerHTML)
const MARCA_INI = '\u0001';
const MARCA_FIN = '\u0002';

const marcar = (texto) => MARCA_INI + texto + MARCA_FIN;

const textoPlano = (texto) => String(texto).split(MARCA_INI).join('').split(MARCA_FIN).join('');

function pintarDestacado(el, texto) {
  if (!el) {
    return;
  }
  el.textContent = '';
  const trozos = String(texto || '').split(MARCA_INI);
  trozos.forEach((trozo, i) => {
    if (i === 0) {
      el.append(trozo);
      return;
    }
    const corte = trozo.indexOf(MARCA_FIN);
    if (corte < 0) {
      el.append(MARCA_INI + trozo);
      return;
    }
    const fuerte = document.createElement('strong');
    fuerte.textContent = trozo.slice(0, corte);
    el.append(fuerte, trozo.slice(corte + 1));
  });
}

function etiquetaPerfil(perfil) {
  return { bajo: 'Compacta', medio: 'Estándar', alto: 'Amplia' }[normalizarPerfil(perfil)];
}

const HABITANTES_SUGERIDOS = { bajo: 2, medio: 4, alto: 5 };
const CAPACIDAD_POR_PERFIL = { bajo: 450, medio: 750, alto: 1100 };

// Estado reactivo (Proxy) y persistencia en localStorage
const CLAVE_LS = 'smartgota:estado:v3';
const CLAVES_LEGADO = ['smartgota:estado:v1', 'smartgota:estado:v2', 'smartgota:wizard:v1'];

let pausado = false,
  pendiente = false,
  lsFallido = false,
  cambiosPendientes = false,
  reiniciandoCasa = false,
  temporizadorCambios = null;

function notificar() {
  if (pausado || pendiente) {
    return;
  }
  pendiente = true;
  cambiosPendientes = true;
  if (temporizadorCambios) {
    clearTimeout(temporizadorCambios);
  }
  temporizadorCambios = setTimeout(() => {
    cambiosPendientes = false;
    temporizadorCambios = null;
  }, 3000);
  queueMicrotask(() => {
    pendiente = false;
    renderDashboard();
    guardarEstado();
  });
}

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
    version: 3,
    onboardingCompletado: false,
    perfil: 'bajo',
    habitantes: 4,
    capacidad: 750,
    pisoActivo: null,
    pisos: new MapaReactivo(),
    habitaciones: new MapaReactivo(),
    dispositivos: new MapaReactivo(),
    siguienteId: 1,
    siguienteSala: 1,
    siguientePiso: 1,
    simNivel: null,
    simTiempo: 0,
    simCorriendo: false,
    simVelocidad: 3600,
    simModoSuministro: 'normal',
    simSeguirSinAgua: false,
    simBombaActiva: true,
    simConsumoAcumulado: 0,
    simCasoFuga: 4821,
    simFugasActivas: [],
    simFugasActivo: true,
    simAguaPerdida: 0,
  },
  manejador
);

function guardarEstado() {
  try {
    localStorage.setItem(
      CLAVE_LS,
      JSON.stringify({
        version: 3,
        onboardingCompletado: Estado.onboardingCompletado,
        perfil: Estado.perfil,
        capacidad: Estado.capacidad,
        habitantes: Estado.habitantes,
        pisoActivo: Estado.pisoActivo,
        siguienteId: Estado.siguienteId,
        siguienteSala: Estado.siguienteSala,
        siguientePiso: Estado.siguientePiso,
        pisos: [...Estado.pisos],
        habitaciones: [...Estado.habitaciones],
        dispositivos: [...Estado.dispositivos],
        simNivel: Estado.simNivel,
        simTiempo: Estado.simTiempo,
        simCorriendo: Estado.simCorriendo,
        simVelocidad: Estado.simVelocidad,
        simModoSuministro: Estado.simModoSuministro,
        simSeguirSinAgua: Estado.simSeguirSinAgua,
        simBombaActiva: Estado.simBombaActiva,
        simConsumoAcumulado: Estado.simConsumoAcumulado,
        simCasoFuga: Estado.simCasoFuga,
        simFugasActivas: Estado.simFugasActivas,
        simFugasActivo: Estado.simFugasActivo,
        simAguaPerdida: Estado.simAguaPerdida,
      })
    );
    lsFallido = false;
    ocultarAvisoLS();
  } catch (_) {
    if (!lsFallido) {
      lsFallido = true;
      mostrarAvisoLS();
    }
  }
}

function mostrarAvisoLS() {
  let aviso = $('aviso-ls');
  if (!aviso) {
    aviso = document.createElement('div');
    aviso.id = 'aviso-ls';
    aviso.className = 'alerta critica';
    aviso.style.position = 'fixed';
    aviso.style.top = '10px';
    aviso.style.left = '50%';
    aviso.style.transform = 'translateX(-50%)';
    aviso.style.zIndex = '200';
    aviso.style.maxWidth = '90%';
    aviso.style.boxSizing = 'border-box';
    document.body.appendChild(aviso);
  }
  aviso.innerHTML =
    '<strong>⚠️ Almacenamiento no disponible:</strong> Los cambios no se guardarán. Libera espacio en localStorage o desactiva el modo privado.';
}

function ocultarAvisoLS() {
  const aviso = $('aviso-ls');
  if (aviso) {
    aviso.remove();
  }
}

function cargarEstado() {
  let g = null;
  try {
    g = JSON.parse(localStorage.getItem(CLAVE_LS));
  } catch (_) {
    // Funciona en memoria si localStorage está bloqueado
  }

  const valido =
    g && [g.pisos, g.habitaciones, g.dispositivos].every(Array.isArray) && g.pisos.length;

  pausado = true;
  try {
    if (valido) {
      Estado.version = 3;
      Estado.onboardingCompletado = Boolean(g.onboardingCompletado);
      Estado.perfil = normalizarPerfil(g.perfil);
      Estado.habitantes = entero(g.habitantes, 1, 50);
      Estado.capacidad = CAPACIDAD_POR_PERFIL[Estado.perfil] || 750;
      Estado.siguienteId = Number(g.siguienteId) || 1;
      Estado.siguienteSala = Number(g.siguienteSala) || 1;
      Estado.siguientePiso = Number(g.siguientePiso) || 1;

      const nivelGuardado = Number(g.simNivel);
      Estado.simNivel =
        g.simNivel === null || typeof g.simNivel === 'undefined' || !Number.isFinite(nivelGuardado)
          ? null
          : nivelGuardado;

      Estado.simTiempo = Number(g.simTiempo) || 0;
      Estado.simCorriendo = Boolean(g.simCorriendo);
      Estado.simVelocidad = [1, 60, 600, 3600, 21600].includes(Number(g.simVelocidad))
        ? Number(g.simVelocidad)
        : 3600;
      Estado.simModoSuministro = ['normal', 'tandeo', 'corte'].includes(g.simModoSuministro)
        ? g.simModoSuministro
        : 'normal';
      Estado.simSeguirSinAgua = Boolean(g.simSeguirSinAgua);
      Estado.simBombaActiva =
        typeof g.simBombaActiva === 'boolean'
          ? g.simBombaActiva
          : g.simBombaModo === 'auto' || g.simBombaEncendida === true;
      Estado.simConsumoAcumulado = Math.max(0, Number(g.simConsumoAcumulado) || 0);
      Estado.simCasoFuga = normalizarCasoFuga(g.simCasoFuga);
      Estado.simFugasActivo = g.simFugasActivo !== false;
      Estado.simFugasActivas = Array.isArray(g.simFugasActivas)
        ? g.simFugasActivas.filter((id) => typeof id === 'string')
        : [];
      Estado.simAguaPerdida = Math.max(0, Number(g.simAguaPerdida) || 0);

      g.pisos.forEach(([k, v]) => Estado.pisos.set(k, v));
      Estado.pisoActivo = Estado.pisos.has(g.pisoActivo)
        ? g.pisoActivo
        : Estado.pisos.keys().next().value;
      const vistos = new Set();
      g.habitaciones.forEach(([k, v]) => {
        if (!Estado.pisos.has(v.piso)) {
          return;
        }
        if (typeof v.cx !== 'number' || typeof v.cy !== 'number') {
          const libre = primerHuecoLibre(v.piso, v.cs || 1, v.rs || 1);
          v.cx = libre.cx;
          v.cy = libre.cy;
        }
        if (!esTipoSala(v.tipo)) {
          const inf = inferirTipoSala(v.nombre);
          v.tipo = inf.tipo;
          v.rol = inf.rol;
        }
        if (!ROLES_SALA.includes(v.rol)) {
          v.rol = null;
        }
        if (!v.rol) {
          v.rol = vistos.has(v.tipo) ? 'secundario' : 'principal';
        }
        vistos.add(v.tipo);
        Estado.habitaciones.set(k, v);
        montarHabitacion(Estado.habitaciones.get(k));
      });
      g.dispositivos.forEach(([k, v]) => {
        const c = CATALOGO[v.tipo];
        if (!Estado.habitaciones.has(v.sala) || !c) {
          return;
        }
        if (!v.frecuencia) {
          v.frecuencia = 'dia';
        }
        if (!v.modo || (c.modos && !c.modos[v.modo])) {
          v.modo = c.modoInicial || 'estandar';
        }
        Estado.dispositivos.set(k, v);
        montarDispositivo(k);
      });
      Estado.simFugasActivas = Estado.simFugasActivas.filter((id) => Estado.dispositivos.has(id));
      recalcularUsosPorNivel();
    } else {
      Estado.onboardingCompletado = false;
      Estado.perfil = 'bajo';
      Estado.habitantes = 4;
      Estado.capacidad = 750;
      Estado.pisoActivo = null;
      Estado.siguienteId = 1;
      Estado.siguienteSala = 1;
      Estado.siguientePiso = 1;
      Estado.simNivel = null;
      Estado.simTiempo = 0;
      Estado.simCorriendo = false;
      Estado.simVelocidad = 3600;
      Estado.simModoSuministro = 'normal';
      Estado.simSeguirSinAgua = false;
      Estado.simBombaActiva = true;
      Estado.simConsumoAcumulado = 0;
      Estado.simCasoFuga = 4821;
      Estado.simFugasActivas = [];
      Estado.simFugasActivo = true;
      Estado.simAguaPerdida = 0;
    }
  } finally {
    pausado = false;
  }

  $('capacidad').textContent = Estado.capacidad + ' L';
  $('habitantes').textContent = Estado.habitantes;
  renderTabs();
  if (Estado.pisoActivo && Estado.pisos.has(Estado.pisoActivo)) {
    activarPiso(Estado.pisoActivo);
  } else {
    $('plano').innerHTML = '';
  }
  notificar();
}

const $ = (id) => document.getElementById(id);
const salaEl = (id) => document.querySelector('.sala[data-sala="' + id + '"]');
const entero = (v, min, max) => {
  let n = parseInt(v, 10);
  if (isNaN(n)) {
    n = min;
  }
  return Math.min(Math.max(n, min), max);
};

const litrosDe = (d) => litrosConFlujo(d, flujoDe(d));

function inferirTipoSala(nombre) {
  const n = String(nombre || '').toLowerCase();
  if (/cocina/.test(n)) {
    return { tipo: 'cocina', rol: null };
  }
  if (/ba[ñn]o|sanitario|\bwc\b/.test(n)) {
    if (/medio/.test(n)) {
      return { tipo: 'bano', rol: 'medio' };
    }
    if (/ba[ñn]o\s*(2|dos)\b|secundari|visitas/.test(n)) {
      return { tipo: 'bano', rol: 'secundario' };
    }
    return { tipo: 'bano', rol: 'principal' };
  }
  if (/lavander|lavadero/.test(n)) {
    return { tipo: 'lavanderia', rol: null };
  }
  if (/jard|patio|terraza|exterior/.test(n)) {
    return { tipo: 'patio', rol: null };
  }
  if (/comedor/.test(n)) {
    return { tipo: 'comedor', rol: null };
  }
  if (/sala|estancia|\bestar\b/.test(n)) {
    return { tipo: 'sala', rol: null };
  }
  if (/estudio|oficina|despacho/.test(n)) {
    return { tipo: 'estudio', rol: null };
  }
  return { tipo: 'recamara', rol: null };
}

// Contexto de vivienda que el dominio puro necesita para calcular cuotas
const contextoPerfil = () => ({ perfil: Estado.perfil, habitantes: Estado.habitantes });

function usoPromedio(tipo, salaId = null) {
  return baseUso(tipo, Estado.habitaciones.get(salaId), contextoPerfil()).uso;
}

function aplicarPromedioDispositivo(d, uso = null) {
  const c = CATALOGO[d.tipo];
  if (!c) {
    return;
  }
  d.uso_personalizado = uso === null ? usoPromedio(d.tipo, d.sala) : uso;
  d.frecuencia = c.frecuenciaInicial || 'dia';
}

function recalcularUsosPorNivel() {
  const grupos = new Map();
  Estado.dispositivos.forEach((d) => {
    const { clave, uso, peso } = baseUso(d.tipo, Estado.habitaciones.get(d.sala), contextoPerfil());
    if (!clave) {
      aplicarPromedioDispositivo(d, uso);
      return;
    }
    if (!grupos.has(clave)) {
      grupos.set(clave, { total: uso, items: [] });
    }
    grupos.get(clave).items.push({ d, peso: peso || 1 });
  });
  grupos.forEach(({ total, items }) => {
    const cuotas = repartirCuota(
      total,
      items.map((it) => it.peso)
    );
    items.forEach((it, i) => aplicarPromedioDispositivo(it.d, cuotas[i]));
  });
  Estado.dispositivos.forEach((d, id) => {
    const el = $(id);
    if (el) {
      refrescarClon(el);
    }
  });
  if (editandoId) {
    actualizarCalculoEditor();
  }
}

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

function resumenPorSala() {
  const porSala = {},
    fijoPorSala = {},
    humanoPorSala = {},
    fugaEnSala = {},
    porPiso = {};
  Estado.dispositivos.forEach((d) => {
    const litros = litrosDe(d);
    const c = CATALOGO[d.tipo];
    const hab = Estado.habitaciones.get(d.sala);
    porSala[d.sala] = Math.round(((porSala[d.sala] || 0) + litros) * 10) / 10;
    if (c && c.fijo) {
      fijoPorSala[d.sala] = Math.round(((fijoPorSala[d.sala] || 0) + litros) * 10) / 10;
      fugaEnSala[d.sala] = true;
    } else {
      humanoPorSala[d.sala] = Math.round(((humanoPorSala[d.sala] || 0) + litros) * 10) / 10;
    }
    if (hab) {
      porPiso[hab.piso] = Math.round(((porPiso[hab.piso] || 0) + litros) * 10) / 10;
    }
  });
  return { porSala, fijoPorSala, humanoPorSala, fugaEnSala, porPiso };
}

// Fugas sorpresa de la simulación (independientes del plano estático)
function fugaIniciada(id) {
  const hora = Sim.horaInicioFuga.get(id);
  return hora === undefined || Sim.tiempo >= hora * 3600;
}

function fugaSimDe(d, id, enVivo) {
  if (!Sim.fugasActivo || !Sim.fugasActivas.includes(id)) {
    return 0;
  }
  if (enVivo && !fugaIniciada(id)) {
    return 0;
  }
  return TASAS_FUGA[d.tipo] || 0;
}

function fugasSimPorSala(enVivo) {
  const porSala = {};
  let total = 0;
  Estado.dispositivos.forEach((d, id) => {
    const litros = fugaSimDe(d, id, enVivo);
    if (litros > 0) {
      porSala[d.sala] = (porSala[d.sala] || 0) + litros;
      total += litros;
    }
  });
  return { porSala, total };
}

function fugasIniciadas() {
  return Sim.fugasActivas.filter((id) => fugaIniciada(id));
}

function tinacosDe(litros) {
  const n = litros / Math.max(1, Estado.capacidad);
  if (n < 0.1) {
    return 'menos de 0.1 tinacos llenos';
  }
  const txt = n >= 10 ? String(Math.round(n)) : n.toFixed(1);
  return txt + (txt === '1' ? ' tinaco lleno' : ' tinacos llenos');
}

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
    const mesL = Math.round(litros * CONFIG.diasMes);
    return (
      'Reparar la fuga en ' +
      marcar(hab) +
      ' ahorraría ' +
      NUM_ES.format(Math.round(mesL)) +
      ' L/mes, equivalente a ' +
      tinacosDe(mesL) +
      '.'
    );
  }

  const fActual = flujoDe(d);
  let mejorModo = null;
  if (c.modos) {
    Object.entries(c.modos).forEach(([clave, info]) => {
      if (info.flujo < fActual && (!mejorModo || info.flujo < mejorModo.flujo)) {
        mejorModo = { clave, ...info };
      }
    });
  }

  const ahorro20MesL = Math.round(litros * 0.2 * CONFIG.diasMes);

  if (mejorModo) {
    const lEco = litrosConFlujo(d, mejorModo.flujo),
      ahorroEcoMesL = Math.round((litros - lEco) * CONFIG.diasMes);
    return (
      marcar(c.nombre) +
      ' en ' +
      marcar(hab) +
      ' es tu mayor consumo (' +
      litros +
      ' L/día). Cambiar a ' +
      marcar(mejorModo.nombre) +
      ' ahorraría ' +
      NUM_ES.format(Math.round(ahorroEcoMesL)) +
      ' L/mes (' +
      tinacosDe(ahorroEcoMesL) +
      '), o reducir su uso un 20 % ahorraría ' +
      NUM_ES.format(Math.round(ahorro20MesL)) +
      ' L/mes (' +
      tinacosDe(ahorro20MesL) +
      ').'
    );
  }

  return (
    marcar(c.nombre) +
    ' en ' +
    marcar(hab) +
    ' es tu mayor consumo (' +
    litros +
    ' L/día). Reducir su uso un 20 % ahorraría ' +
    NUM_ES.format(Math.round(ahorro20MesL)) +
    ' L/mes, equivalente a ' +
    tinacosDe(ahorro20MesL) +
    '.'
  );
}

// Dashboard y diagnóstico
function animarCifra(el, fin, fmt) {
  const ini = el._v || 0;
  const t0 = performance.now();
  cancelAnimationFrame(el._raf);
  clearTimeout(el._to);
  el.textContent = fmt(ini);
  const paso = (t) => {
    const k = Math.max(0, Math.min((t - t0) / 500, 1));
    el._v = ini + (fin - ini) * (1 - Math.pow(1 - k, 3));
    el.textContent = fmt(el._v);
    if (k < 1) {
      el._raf = requestAnimationFrame(paso);
    }
  };
  el._raf = requestAnimationFrame(paso);
  el._to = setTimeout(() => {
    cancelAnimationFrame(el._raf);
    el._v = fin;
    el.textContent = fmt(fin);
  }, 700);
}

function renderAlerta(L, desborde, fugas, pct) {
  const alertaEl = $('alerta');
  if (!alertaEl) {
    return;
  }

  let nivel = '';
  let titulo;
  const lineas = [];

  if (L === 0) {
    titulo = 'Sin consumo registrado';
    lineas.push('El plano no tiene aparatos con consumo. Reinicia la casa para generar uno nuevo.');
  } else if (desborde) {
    nivel = 'critica';
    titulo = 'Almacenamiento agotado';
    lineas.push(
      'El consumo diario supera la capacidad del tinaco. Cambia la eficiencia de los aparatos con más consumo.'
    );
  } else if (fugas.cantidad) {
    nivel = 'riesgo';
    titulo = 'Eficiencia comprometida';
    lineas.push(
      'Hay ' +
        fugas.cantidad +
        ' fuga(s): se pierden ' +
        fugas.litros +
        ' L/día (' +
        Math.round((fugas.litros / L) * 100) +
        ' % del consumo).'
    );
  } else if (pct >= 80) {
    nivel = 'riesgo';
    titulo = 'Margen ajustado';
    lineas.push('Queda poca reserva en el tinaco para el consumo estimado.');
  } else {
    titulo = 'Consumo estable';
    lineas.push('Queda reserva suficiente en el tinaco para el consumo estimado.');
  }

  alertaEl.className = 'alerta ' + nivel;
  alertaEl.innerHTML = '';
  const st = document.createElement('strong');
  st.textContent = titulo;
  alertaEl.appendChild(st);
  alertaEl.appendChild(document.createTextNode(lineas.join(' ')));

  const recTexto = generarRecomendacion();
  const recDetalle = $('alerta-rec-detalle');
  const recEl = $('alerta-rec');
  if (recDetalle && recEl) {
    pintarDestacado(recEl, recTexto || '');
    recDetalle.hidden = !recTexto;
    if (!recTexto) {
      recDetalle.open = false;
    }
  }
}

function resumenPorTipo() {
  const porTipo = {};
  Estado.dispositivos.forEach((d) => {
    porTipo[d.tipo] = (porTipo[d.tipo] || 0) + litrosDe(d);
  });
  return porTipo;
}

function renderTopTipos(porTipo) {
  const cont = $('diag-top-salas');
  if (!cont) {
    return;
  }

  cont.innerHTML = '';
  const filas = Object.entries(porTipo)
    .filter(([, litros]) => litros > 0)
    .sort((a, b) => b[1] - a[1]);

  if (!filas.length) {
    const vacio = document.createElement('p');
    vacio.className = 'pista';
    vacio.textContent = 'Aún no hay consumo registrado.';
    cont.appendChild(vacio);
    return;
  }

  const maximo = filas[0][1] || 1;
  filas.forEach(([tipo, litros], i) => {
    const color = COLORES[i % COLORES.length];
    const fila = document.createElement('div');
    fila.className = 'diag-top__fila';

    const cab = document.createElement('div');
    cab.className = 'diag-top__cab';
    const nombre = document.createElement('span');
    nombre.className = 'diag-top__nombre';
    const punto = document.createElement('i');
    punto.className = 'diag-top__punto';
    punto.style.background = color;
    const texto = document.createElement('span');
    texto.className = 'diag-top__texto';
    texto.textContent = (CATALOGO[tipo] && CATALOGO[tipo].nombre) || tipo;
    nombre.append(punto, texto);

    const valor = document.createElement('strong');
    valor.textContent = NUM_ES.format(Math.round(litros)) + ' L';
    cab.append(nombre, valor);

    const barra = document.createElement('div');
    barra.className = 'diag-top__barra';
    const fill = document.createElement('span');
    fill.style.width = Math.round((litros / maximo) * 100) + '%';
    fill.style.background = color;
    barra.appendChild(fill);

    fila.append(cab, barra);
    cont.appendChild(fila);
  });
}

function renderDashboard() {
  const L = litrosTotales(),
    cap = Estado.capacidad;
  const pct = (L / cap) * 100,
    desborde = L > cap,
    fugas = resumenFugas();

  const setCifra = (id, valor, fmt) => {
    const el = $(id);
    if (el) {
      animarCifra(el, valor, fmt);
    }
  };

  setCifra('m-litros', L, (n) => NUM_ES.format(Math.round(n)) + ' L');
  setCifra('m-fugas', fugas.litros, (n) => NUM_ES.format(Math.round(n)) + ' L/día');
  const porTipo = resumenPorTipo();
  const mayor = Object.entries(porTipo).sort((a, b) => b[1] - a[1])[0];
  const elMayor = $('m-mayor');
  if (elMayor) {
    elMayor.textContent = mayor
      ? (CATALOGO[mayor[0]] ? CATALOGO[mayor[0]].nombre : mayor[0]) + ' · ' + litrosTexto(mayor[1])
      : '—';
  }
  setCifra('m-pct-tinaco', (L / Math.max(1, cap)) * 100, (n) => Math.round(n) + ' %');
  setCifra('m-litros-mes', L * CONFIG.diasMes, (n) => {
    const litrosMes = Math.round(n),
      m3Mes = (litrosMes / 1000).toFixed(1);
    return NUM_ES.format(Math.round(litrosMes)) + ' L (' + m3Mes + ' m³)';
  });

  const mesCorta = $('m-litros-mes-corta');
  if (mesCorta) {
    mesCorta.textContent =
      L > 0
        ? '≈ ' + ((L * CONFIG.diasMes) / 1000).toFixed(1) + ' m³ al mes'
        : 'sin consumo registrado';
  }

  const fugasDetalle = $('m-fugas-detalle');
  const hayAlertaFuga =
    fugas.cantidad > 0 || Boolean(Sim.fugasReveladas && Sim.fugasActivas.length);
  if (fugasDetalle) {
    const partes = [
      fugas.cantidad
        ? fugas.cantidad + (fugas.cantidad === 1 ? ' fuga activa' : ' fugas activas')
        : 'sin fugas en el plano',
    ];
    if (Sim.fugasReveladas && Sim.fugasActivas.length) {
      partes.push('fuga sorpresa detectada');
    }
    fugasDetalle.textContent = partes.join(' · ');
  }

  const chipFugas = $('kpi-fugas');
  if (chipFugas) {
    if (hayAlertaFuga) {
      chipFugas.dataset.tono = 'alerta';
    } else {
      delete chipFugas.dataset.tono;
    }
  }

  renderAlerta(L, desborde, fugas, pct);

  const { porSala, fugaEnSala, porPiso } = resumenPorSala();

  document.querySelectorAll('.sala').forEach((s) => {
    const sid = s.dataset.sala,
      n = porSala[sid] || 0;
    s.querySelector('b').textContent = n ? '· ' + litrosTexto(n) : '';
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
    t.querySelector('small').textContent = n ? litrosTexto(n) : '';
  });

  renderTopTipos(porTipo);

  if (editandoId) {
    actualizarCalculoEditor();
  }
  actualizarGrafico(porTipo);
  simRender();
  renderSensores();
}

// Gráfico (Chart.js) y exportación (jsPDF / PNG)
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

function actualizarGrafico(porTipo) {
  const tipos = Object.keys(porTipo)
      .filter((t) => porTipo[t] > 0)
      .sort((a, b) => porTipo[b] - porTipo[a]),
    vacio = tipos.length === 0;
  $('grafico-vacio').hidden = !vacio;
  $('grafico-consumo').style.visibility = vacio ? 'hidden' : 'visible';

  if (!$('grafico-consumo').clientWidth || typeof Chart === 'undefined') {
    return;
  }
  const etiquetas = tipos.map((t) => (CATALOGO[t] ? CATALOGO[t].nombre : t));
  const valores = tipos.map((t) => Math.round(porTipo[t]));

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
          legend: { display: false },
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
    litrosMes = L * CONFIG.diasMes,
    m3Mes = (litrosMes / 1000).toFixed(2),
    lHab = (L / Estado.habitantes).toFixed(1),
    fugas = resumenFugas(),
    fugasSim = fugasSimPorSala(),
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
      NUM_ES.format(Math.round(litrosMes)) +
      ' L (' +
      m3Mes +
      ' m³)'
  );
  linea(
    'Fugas activas: ' +
      fugas.cantidad +
      ' | Pérdida continua: ' +
      fugas.litros +
      ' L/día (' +
      NUM_ES.format(Math.round(fugas.litros * CONFIG.diasMes)) +
      ' L/mes, ' +
      tinacosDe(fugas.litros * CONFIG.diasMes) +
      ')'
  );
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
  if (fugasSim.total > 0) {
    linea(
      'Escenario de fugas sorpresa: ' +
        Sim.fugasActivas.length +
        ' aparato(s), ' +
        fugasSim.total +
        ' L/día',
      11,
      true
    );
    Sim.fugasActivas.forEach((id) => {
      const d = Estado.dispositivos.get(id);
      if (!d) {
        return;
      }
      linea(
        '- ' +
          ((Estado.habitaciones.get(d.sala) || {}).nombre || '?') +
          ' · ' +
          CATALOGO[d.tipo].nombre +
          ': ' +
          TASAS_FUGA[d.tipo] +
          ' L/día'
      );
    });
  }
  if (rec) {
    linea(textoPlano(rec));
  }

  if (fugas.cantidad || fugasSim.total > 0) {
    y += 4;
    linea('ADVERTENCIA AMBIENTAL (COMARCA LAGUNERA)', 13, true);
    linea(
      (fugas.cantidad || fugasSim.total
        ? 'Hay fugas activas que desperdician ' + (fugas.litros + fugasSim.total) + ' L/día. '
        : '') +
        'En la Comarca Lagunera el agua subterránea presenta arsénico de origen natural (HACRE) en parte del acuífero; ' +
        'el sobreconsumo y las fugas aumentan la presión sobre la extracción de agua profunda.'
    );
  }
  y += 6;
  linea('Valores estimados con el simulador educativo SmartGota.', 9);
  doc.save('reporte-smartgota.pdf');
}
$('btn-pdf').addEventListener('click', exportarPDF);

function exportarPNG() {
  if (!grafico) {
    // eslint-disable-next-line no-alert
    alert('No hay gráfico para descargar.');
    return;
  }
  const url = grafico.toBase64Image();
  const enlace = document.createElement('a');
  enlace.download = 'grafico-consumo-smartgota.png';
  enlace.href = url;
  enlace.click();
}
$('btn-png').addEventListener('click', exportarPNG);

// Pisos y pestañas
function crearPiso(nombre) {
  const id = 'p' + Estado.siguientePiso++;
  Estado.pisos.set(id, { id, nombre });
  return id;
}

function renderTabs() {
  $('tabs').innerHTML = '';
  Estado.pisos.forEach((p) => {
    const t = document.createElement('div');
    t.className = 'tab';
    t.dataset.piso = p.id;
    t.setAttribute('role', 'tab');
    t.setAttribute('aria-selected', Estado.pisoActivo === p.id ? 'true' : 'false');
    t.tabIndex = 0;
    t.innerHTML = '<span class="tab__nombre"></span><small></small>';
    t.querySelector('.tab__nombre').textContent = p.nombre;
    t.addEventListener('click', () => activarPiso(p.id));
    t.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        activarPiso(p.id);
      }
    });
    $('tabs').appendChild(t);
  });
}

function activarPiso(id) {
  cerrarEditor();
  Estado.pisoActivo = id;
  document.querySelectorAll('.tab[data-piso]').forEach((t) => {
    t.classList.toggle('activa', t.dataset.piso === id);
    t.setAttribute('aria-selected', t.dataset.piso === id ? 'true' : 'false');
  });
  document
    .querySelectorAll('.sala')
    .forEach((s) => (s.hidden = Estado.habitaciones.get(s.dataset.sala).piso !== id));
  renderizarGuiaGrid(false);
}

// Modal de confirmación
let resolverModal = null;

function abrirModal({ titulo, mensaje = '', inicial = '', confirmar = false }) {
  if (resolverModal) {
    resolverModal(confirmar ? false : null);
  }
  const modal = $('modal'),
    msgEl = $('modal-msg'),
    inp = $('modal-input'),
    ok = $('modal-ok'),
    cancelar = $('modal-cancelar');

  ok.textContent = 'Aceptar';
  cancelar.hidden = false;

  $('modal-titulo').textContent = titulo;
  pintarDestacado(msgEl, mensaje);
  msgEl.hidden = !mensaje;

  inp.hidden = confirmar;
  if (!confirmar) {
    inp.value = inicial || '';
  }

  modal.hidden = false;
  queueMicrotask(() => {
    if (confirmar) {
      ok.focus();
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

// Habitaciones y grilla del plano
function primerHuecoLibre(piso, cs, rs) {
  const habs = [...Estado.habitaciones.values()].filter((h) => h.piso === piso);
  const m = medidasGrid();
  const colsMax = m.cols;
  const filasLimite = Math.min(MAX_FILAS, Math.max(FILAS_MIN, filasOcupadasPiso(piso) + 1));
  for (let cy = 1; cy <= filasLimite; cy++) {
    for (let cx = 1; cx <= colsMax; cx++) {
      let libre = true;
      for (let dy = 0; dy < rs && libre; dy++) {
        for (let dx = 0; dx < cs && libre; dx++) {
          const c = cx + dx,
            r = cy + dy;
          if (c > colsMax || r > filasLimite) {
            libre = false;
            break;
          }
          for (const h of habs) {
            if (c >= h.cx && c < h.cx + h.cs && r >= h.cy && r < h.cy + h.rs) {
              libre = false;
              break;
            }
          }
        }
      }
      if (libre) {
        return { cx, cy };
      }
    }
  }
  return { cx: 1, cy: 1 };
}

function crearHabitacion(nombre, piso, opciones = {}) {
  const id = 'h' + Estado.siguienteSala++;
  const columnas = Math.max(1, Number(medidasGrid().cols) || 1);
  const cs = Math.min(opciones.cs || 1, columnas);
  const rs = Math.min(opciones.rs || 1, MAX_FILAS);
  const inferido = inferirTipoSala(nombre);
  const tipo = esTipoSala(opciones.tipo) ? opciones.tipo : inferido.tipo;
  const rol = ROLES_SALA.includes(opciones.rol) ? opciones.rol : inferido.rol || 'principal';
  const coords =
    typeof opciones.cx === 'number' && typeof opciones.cy === 'number'
      ? { cx: opciones.cx, cy: opciones.cy }
      : primerHuecoLibre(piso, cs, rs);
  Estado.habitaciones.set(id, {
    id,
    nombre,
    piso,
    tipo,
    rol,
    cx: coords.cx,
    cy: coords.cy,
    cs,
    rs,
  });
  const el = montarHabitacion(Estado.habitaciones.get(id));
  renderizarGuiaGrid(false);
  return el;
}

function pintarRotuloSala(el, hab) {
  const em = el.querySelector('.sala__rotulo em');
  if (!em) {
    return;
  }
  em.textContent = '';
  const icono = document.createElement('span');
  icono.className = 'sala__icono';
  icono.setAttribute('aria-hidden', 'true');
  icono.textContent = tipoSala(hab.tipo).icono;
  em.append(icono, ' ' + hab.nombre);
}

function montarHabitacion(hab) {
  const { id, piso } = hab;
  const el = document.createElement('div');
  el.className = 'sala';
  el.dataset.sala = id;
  el.hidden = piso !== Estado.pisoActivo;
  el.innerHTML = '<span class="sala__rotulo"><em></em><b></b></span>';
  pintarRotuloSala(el, hab);
  aplicarSpans(el, hab);
  $('plano').appendChild(el);
  return el;
}

const MAX_FILAS = 8;
const FILAS_MIN = 2;

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

function filasOcupadasPiso(pisoId) {
  const habs = [...Estado.habitaciones.values()].filter((h) => h.piso === pisoId);
  if (habs.length === 0) {
    return 0;
  }
  return Math.max(0, ...habs.map((h) => (h.cy || 1) + (h.rs || 1) - 1));
}

function renderizarGuiaGrid(expandir = false) {
  const plano = $('plano');
  if (!plano || !plano.clientWidth) {
    return;
  }
  const m = medidasGrid();
  const ocupadas = filasOcupadasPiso(Estado.pisoActivo);
  const filas = Math.min(MAX_FILAS, Math.max(FILAS_MIN, ocupadas + (expandir ? 1 : 0)));
  plano.querySelectorAll('.celda-guia').forEach((g) => g.remove());
  const fragmento = document.createDocumentFragment();
  for (let cy = 1; cy <= filas; cy++) {
    for (let cx = 1; cx <= m.cols; cx++) {
      const guia = document.createElement('div');
      guia.className = 'celda-guia';
      guia.style.setProperty('--cx', cx);
      guia.style.setProperty('--cy', cy);
      fragmento.appendChild(guia);
    }
  }
  plano.prepend(fragmento);
}

function aplicarSpans(sala, hab) {
  if (!$('plano') || !$('plano').clientWidth) {
    sala.style.setProperty('--cs', hab.cs || 1);
    sala.style.setProperty('--rs', hab.rs || 1);
    sala.style.setProperty('--cx', hab.cx || 1);
    sala.style.setProperty('--cy', hab.cy || 1);
    return;
  }
  const m = medidasGrid();
  const cs = Math.min(hab.cs, m.cols);
  const filasLimite = Math.min(
    MAX_FILAS,
    Math.max(FILAS_MIN, filasOcupadasPiso(Estado.pisoActivo) + 1)
  );
  const cx = Math.max(1, Math.min(hab.cx || 1, m.cols - cs + 1));
  const cy = Math.max(1, Math.min(hab.cy || 1, filasLimite - hab.rs + 1));
  sala.style.setProperty('--cs', cs);
  sala.style.setProperty('--rs', hab.rs);
  sala.style.setProperty('--cx', cx);
  sala.style.setProperty('--cy', cy);
}

let colsPrevios = 0;
new ResizeObserver(() => {
  const m = medidasGrid();
  if (m.cols !== colsPrevios) {
    colsPrevios = m.cols;
    renderizarGuiaGrid();
    Estado.habitaciones.forEach((h) => aplicarSpans(salaEl(h.id), h));
  } else {
    Estado.habitaciones.forEach((h) => aplicarSpans(salaEl(h.id), h));
  }
}).observe($('plano'));

// Catálogo informativo (paleta) y modal de información
const GRUPOS_PALETA = [
  { titulo: 'Baño', tipos: ['ducha', 'inodoro', 'lavabo', 'tina'] },
  { titulo: 'Cocina y lavandería', tipos: ['lavadora', 'lavavajillas', 'filtro'] },
  { titulo: 'Casa y exterior', tipos: ['grifo', 'aire', 'fuga'] },
];

function construirPaleta() {
  const contenedor = $('paleta');
  contenedor.innerHTML = '';

  GRUPOS_PALETA.forEach((grupo) => {
    const seccion = document.createElement('section');
    seccion.className = 'paleta__grupo';

    const titulo = document.createElement('h3');
    titulo.textContent = grupo.titulo;
    seccion.appendChild(titulo);

    const items = document.createElement('div');
    items.className = 'paleta__items';

    grupo.tipos.forEach((tipo) => {
      const c = CATALOGO[tipo];
      if (!c) {
        return;
      }

      const el = document.createElement('div');
      el.className = 'item';
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
        '</small></div>' +
        '<button type="button" class="item__info" data-tipo="' +
        tipo +
        '" aria-label="Información sobre ' +
        c.nombre +
        '" aria-haspopup="dialog">?</button>';
      items.appendChild(el);
    });

    seccion.appendChild(items);
    contenedor.appendChild(seccion);
  });
}

let infoOrigen = null;

function abrirInfoDispositivo(tipo) {
  const c = CATALOGO[tipo];
  const modal = $('modal-info');
  if (!c || !modal) {
    return;
  }
  infoOrigen = document.activeElement;

  $('modal-info-titulo').textContent = c.icono + ' ' + c.nombre;
  $('modal-info-flujo').textContent =
    'Flujo base: ' + c.flujo + ' ' + c.medida + (c.fijo ? ' · gasto fijo' : '') + '.';
  $('modal-info-msg').textContent = c.descripcion || '';

  modal.hidden = false;
  $('modal-info-cerrar').focus();
}

function cerrarInfoDispositivo() {
  const modal = $('modal-info');
  if (modal) {
    modal.hidden = true;
  }
  if (infoOrigen && infoOrigen.focus) {
    infoOrigen.focus({ preventScroll: true });
  }
  infoOrigen = null;
}

$('paleta').addEventListener('click', (e) => {
  const btn = e.target.closest('.item__info');
  if (btn) {
    abrirInfoDispositivo(btn.dataset.tipo);
  }
});
$('modal-info-cerrar').addEventListener('click', cerrarInfoDispositivo);
$('modal-info').addEventListener('click', (e) => {
  if (e.target === $('modal-info')) {
    cerrarInfoDispositivo();
  }
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !$('modal-info').hidden) {
    cerrarInfoDispositivo();
  }
});

// Clones de dispositivos en el plano y editor de modo
function posicionar(el, fx, fy) {
  el.style.left = 'calc((100% - ' + CONFIG.tamClon + 'px) * ' + fx.toFixed(4) + ')';
  el.style.top = 'calc((100% - ' + CONFIG.tamClon + 'px) * ' + fy.toFixed(4) + ')';
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
    (c.fijo ? ' (gasto fijo)' : ' · clic para ver el detalle y cambiar el modo');
}

function crearClon(id, tipo) {
  const el = document.createElement('div');
  el.className = 'clon';
  el.id = id;
  el.tabIndex = 0;
  if (CATALOGO[tipo].fijo) {
    el.dataset.fijo = '1';
  }
  el.appendChild(document.querySelector('.item[data-tipo="' + tipo + '"] .ico').cloneNode(true));
  el.insertAdjacentHTML('beforeend', '<small></small>');
  refrescarClon(el);

  el.addEventListener('click', () => abrirEditor(id));
  el.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      abrirEditor(id);
    }
  });
  return el;
}

function agregarDispositivo(tipo, sala, fx, fy, opciones = {}) {
  const id = 'd' + Estado.siguienteId++,
    c = CATALOGO[tipo];
  Estado.dispositivos.set(id, {
    tipo,
    sala: sala.dataset.sala,
    fx,
    fy,
    uso_personalizado:
      typeof opciones.uso_personalizado === 'number'
        ? opciones.uso_personalizado
        : usoPromedio(tipo, sala.dataset.sala),
    frecuencia: opciones.frecuencia || c.frecuenciaInicial || 'dia',
    modo: opciones.modo || c.modoInicial || 'estandar',
    ...(opciones.origen ? { origen: opciones.origen } : {}),
  });
  montarDispositivo(id);
  recalcularUsosPorNivel();
  return id;
}

function montarDispositivo(id) {
  const d = Estado.dispositivos.get(id),
    sala = salaEl(d.sala);
  if (!sala) {
    return;
  }
  const el = crearClon(id, d.tipo);
  if (Sim.fugasReveladas && Sim.fugasActivas.includes(id)) {
    el.classList.add('clon--fuga');
  }
  sala.appendChild(el);
  posicionar(el, d.fx, d.fy);
}

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
  $('ed-nota').textContent =
    'Consumo estimado con los promedios de la vivienda ' +
    etiquetaPerfil(Estado.perfil).toLowerCase() +
    '. No necesitas medir minutos, cargas ni descargas.';

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

  actualizarCalculoEditor();

  const ed = $('editor'),
    caja = $(id).getBoundingClientRect();
  ed.hidden = false;
  ed.style.left = Math.max(8, Math.min(caja.left, innerWidth - ed.offsetWidth - 12)) + 'px';
  ed.style.top = Math.max(8, Math.min(caja.bottom + 8, innerHeight - ed.offsetHeight - 12)) + 'px';
  if (!grupoModo.hidden) {
    selModo.focus({ preventScroll: true });
  } else {
    ed.focus({ preventScroll: true });
  }
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
}

$('ed-modo').addEventListener('change', (e) => {
  const d = Estado.dispositivos.get(editandoId);
  if (!d) {
    return;
  }
  d.modo = e.target.value;
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
    const id = editandoId;
    cerrarEditor();
    if (id && $(id)) {
      $(id).focus({ preventScroll: true });
    }
  }
});

// Simulación del tanque, suministro y sensores en tiempo real
const LIMITE_BOMBA = 0.2,
  SEG_DIA = 86400;

const ENTRADA_RED_NORMAL_LMIN = 0.3;
const ENTRADA_RED_TANDEO_LMIN = 6;
const CAUDAL_BOMBA_LMIN = 15;

// Pesos horarios w(0..23) cuya suma exacta es 24.00
const PESOS_HORA = [
  0.08, 0.08, 0.08, 0.08, 0.08, 0.6, 2.6, 2.6, 2.6, 0.7, 0.7, 0.7, 0.7, 2.1, 2.1, 0.65, 0.65, 0.65,
  0.65, 1.7, 1.7, 1.7, 0.25, 0.25,
];

function enTanda(h) {
  return (h >= 6 && h < 10) || (h >= 18 && h < 22);
}

function redDisponible(h = horaActualSim()) {
  if (Sim.modoSuministro === 'normal') {
    return true;
  }
  if (Sim.modoSuministro === 'tandeo') {
    return enTanda(h);
  }
  return false;
}

function entradaRedLps(h = horaActualSim()) {
  if (Sim.modoSuministro === 'normal') {
    return ENTRADA_RED_NORMAL_LMIN / 60;
  }
  if (Sim.modoSuministro === 'tandeo' && enTanda(h)) {
    return ENTRADA_RED_TANDEO_LMIN / 60;
  }
  return 0;
}

const Sim = {
  corriendo: Estado.simCorriendo,
  velocidad: Estado.simVelocidad,
  modoSuministro: Estado.simModoSuministro || 'normal',
  seguirSinAgua: Boolean(Estado.simSeguirSinAgua),
  bombaActiva: Estado.simBombaActiva !== false,
  bombaEncendida: false,
  consumoAcumulado: Math.max(0, Number(Estado.simConsumoAcumulado) || 0),
  casoFuga: 4821,
  fugasActivas: [],
  horaInicioFuga: new Map(),
  fugasActivo: true,
  fugasReveladas: false,
  sensoresAvisados: false,
  aguaPerdida: 0,
  bitacora: [],
  bitacoraSucia: false,
  logPrev: { red: null, bomba: null, vacio: null, pico: null },
  nivel: Estado.simNivel !== null ? Estado.simNivel : null,
  tiempo: Estado.simTiempo,
  ultimo: 0,
  raf: 0,
  estado: null,
  pausaVacio: false,
  ultimoSensores: 0,
};

function cambiarBomba(encendida) {
  const valor = Boolean(encendida);
  if (Sim.bombaEncendida === valor) {
    return false;
  }
  Sim.bombaEncendida = valor;
  return true;
}

function actualizarBomba(h = horaActualSim()) {
  if (Sim.nivel === null) {
    return;
  }
  if (!Sim.bombaActiva || !redDisponible(h) || Sim.nivel >= Estado.capacidad) {
    cambiarBomba(false);
    return;
  }
  if (!Sim.bombaEncendida && Sim.nivel <= Estado.capacidad * LIMITE_BOMBA) {
    cambiarBomba(true);
  }
}

const MENSAJES_SIM = {
  vacio: {
    nivel: 'critica',
    titulo: 'Tanque vacío',
    texto:
      'Sin agua en la vivienda. Con la bomba activa se rellena al volver el suministro; también puedes seguir el tiempo sin agua.',
  },
  critico: {
    nivel: 'critica',
    titulo: 'Nivel bajo: 20 % o menos',
    texto: 'La bomba automática arranca al 20 % y se detiene al llenar el tinaco.',
  },
  sinconsumo: {
    nivel: '',
    titulo: 'Sin consumo',
    texto: 'Sin consumo en la vivienda: el nivel del tanque no cambia con el uso.',
  },
};

function renderModosSuministro() {
  document.querySelectorAll('[data-modo-suministro]').forEach((btn) => {
    const activo = btn.dataset.modoSuministro === Sim.modoSuministro;
    btn.classList.toggle('activo', activo);
    btn.setAttribute('aria-pressed', activo ? 'true' : 'false');
  });
}

function marcarFugasReveladas() {
  let cambio = false;
  fugasIniciadas().forEach((id) => {
    const el = $(id);
    if (el && !el.classList.contains('clon--fuga')) {
      el.classList.add('clon--fuga');
      cambio = true;
      const d = Estado.dispositivos.get(id);
      const hab = d ? Estado.habitaciones.get(d.sala) : null;
      registrarEvento('Anomalía detectada en ' + (hab ? hab.nombre : 'un aparato'), 'alerta');
    }
  });
  if (!cambio) {
    return;
  }
  Sim.fugasReveladas = true;
  renderDashboard();
}

function limpiarFugasReveladas() {
  const habia = Sim.fugasReveladas;
  Sim.fugasReveladas = false;
  document.querySelectorAll('.clon--fuga').forEach((el) => el.classList.remove('clon--fuga'));
  if (habia) {
    renderDashboard();
  }
}

// Aparatos que pueden protagonizar una fuga sorpresa
const idsElegiblesFuga = () =>
  [...Estado.dispositivos.entries()].filter(([, d]) => TASAS_FUGA[d.tipo] > 0).map(([id]) => id);

function casoFugaAleatorio() {
  let codigo = Sim.casoFuga;
  while (codigo === Sim.casoFuga) {
    codigo = 1000 + Math.floor(Math.random() * 9000);
  }
  return codigo;
}

function aplicarCasoFuga(codigo) {
  const caso = generarCasoFuga(codigo, idsElegiblesFuga());
  Sim.casoFuga = caso.codigo;
  Sim.fugasActivas = caso.ids;
  Sim.horaInicioFuga = caso.horas;
  Sim.sensoresAvisados = false;
  limpiarFugasReveladas();
  Estado.simCasoFuga = caso.codigo;
  Estado.simFugasActivas = caso.ids;
  renderFugasSim();
  simRender();
  return caso;
}

function renderFugasSim() {
  const toggle = $('sim-fugas-activo');
  if (toggle) {
    toggle.checked = Boolean(Sim.fugasActivo);
  }
}

function renderBomba() {
  const estado = $('sim-bomba-estado');
  const interruptor = $('sim-bomba-activa');
  if (!estado || !interruptor) {
    return;
  }

  const red = redDisponible();
  const lleno = Sim.nivel !== null && Sim.nivel >= Estado.capacidad;
  let etiqueta = 'Apagada';
  let tono = '';

  if (!Sim.bombaActiva) {
    etiqueta = 'Apagada';
  } else if (!red) {
    etiqueta = 'Esperando suministro';
    tono = 'aviso';
  } else if (lleno) {
    etiqueta = 'Tinaco lleno';
    tono = 'ok';
  } else if (Sim.bombaEncendida) {
    etiqueta = Sim.corriendo ? 'Llenando el tinaco' : 'Llenando · en pausa';
    tono = 'activa';
  } else {
    etiqueta = 'Esperando el 20 %';
  }

  if (estado.textContent !== etiqueta) {
    estado.textContent = etiqueta;
  }
  if (estado.dataset.estado !== tono) {
    estado.dataset.estado = tono;
  }
  interruptor.checked = Boolean(Sim.bombaActiva);

  const btnVacio = $('sim-encender-bomba');
  if (btnVacio) {
    btnVacio.hidden = Sim.bombaActiva;
    btnVacio.disabled = !red;
  }
}

function seleccionarModoSuministro(clave) {
  if (!['normal', 'tandeo', 'corte'].includes(clave)) {
    return;
  }
  Sim.modoSuministro = clave;
  Estado.simModoSuministro = clave;
  Sim.seguirSinAgua = false;
  Estado.simSeguirSinAgua = false;
  if (clave !== 'corte') {
    Sim.pausaVacio = false;
  }
  renderModosSuministro();
  simRender();
}

function horaActualSim() {
  return Math.floor((Sim.tiempo % SEG_DIA) / 3600);
}

function etiquetaFranja(h) {
  if (Sim.modoSuministro === 'corte') {
    return 'Corte de agua (sin entrada)';
  }
  if (Sim.modoSuministro === 'tandeo' && !enTanda(h)) {
    return 'Fuera de tandeo';
  }
  if (h < 5) {
    return 'Madrugada';
  }
  if (h < 6) {
    return 'Inicio de actividad';
  }
  if (h < 9) {
    return 'Hora pico matutina (2.6×)';
  }
  if (h >= 13 && h < 15) {
    return 'Hora pico mediodía (2.1×)';
  }
  if (h >= 19 && h < 22) {
    return 'Hora pico nocturna (1.7×)';
  }
  if (h >= 22) {
    return 'Noche baja';
  }
  return 'Horario normal';
}

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

function registrarEvento(texto, tono) {
  Sim.bitacora.push({ hora: formatoReloj(Sim.tiempo), texto, tono });
  if (Sim.bitacora.length > 30) {
    Sim.bitacora.shift();
  }
  Sim.bitacoraSucia = true;
}

function detectarEventos() {
  const red = redDisponible();
  const bomba = Sim.bombaEncendida;
  const vacio = Sim.nivel !== null && Sim.nivel <= 0;
  const pico = esHoraPico(horaActualSim());
  const prev = Sim.logPrev;

  if (prev.red !== null && red !== prev.red) {
    registrarEvento(
      red ? 'Llega agua de la red' : 'Se corta el suministro',
      red ? 'agua' : 'alerta'
    );
  }
  if (prev.bomba !== null && bomba !== prev.bomba) {
    registrarEvento(
      bomba ? 'Arranca la bomba del tinaco' : 'Se detiene la bomba',
      bomba ? 'bomba' : ''
    );
  }
  if (prev.vacio !== null && vacio !== prev.vacio) {
    registrarEvento(
      vacio ? 'El tinaco se vacía' : 'El tinaco vuelve a tener agua',
      vacio ? 'alerta' : 'agua'
    );
  }
  if (prev.pico !== null && pico !== prev.pico) {
    registrarEvento(pico ? 'Empieza una hora pico' : 'Termina la hora pico', pico ? 'pico' : '');
  }

  prev.red = red;
  prev.bomba = bomba;
  prev.vacio = vacio;
  prev.pico = pico;
}

function renderBitacora() {
  const lista = $('bitacora-lista');
  const vacio = $('bitacora-vacio');
  if (!lista || !Sim.bitacoraSucia) {
    return;
  }
  Sim.bitacoraSucia = false;
  lista.innerHTML = '';
  Sim.bitacora
    .slice()
    .reverse()
    .forEach((ev) => {
      const item = document.createElement('li');
      item.className = 'bitacora__item' + (ev.tono ? ' bitacora__item--' + ev.tono : '');
      const hora = document.createElement('time');
      hora.textContent = ev.hora;
      const texto = document.createElement('span');
      texto.textContent = ev.texto;
      item.append(hora, texto);
      lista.appendChild(item);
    });
  if (vacio) {
    vacio.hidden = Sim.bitacora.length > 0;
  }
}

function renderEntradaSuministro() {
  const activo = document.querySelector('.modo-suministro.activo');
  const entrando = Boolean(activo) && Sim.corriendo && redDisponible();
  document.querySelectorAll('.modo-suministro').forEach((btn) => {
    btn.classList.toggle('modo-suministro--flujo', btn === activo && entrando);
  });
  const titulo = $('sim-suministro-titulo');
  if (titulo) {
    titulo.textContent = entrando ? 'Suministro · entrando' : 'Suministro';
  }
}

function dispositivoPicoDeSala(salaId, factor) {
  let mejor = null;
  let max = 0;
  Estado.dispositivos.forEach((d) => {
    if (d.sala !== salaId) {
      return;
    }
    const c = CATALOGO[d.tipo];
    if (!c) {
      return;
    }
    const actual = c.fijo ? c.flujo : litrosDe(d) * factor;
    if (actual > max) {
      max = actual;
      mejor = c.nombre;
    }
  });
  return max > 0 ? mejor : null;
}

function simFlujos() {
  const totalDia = litrosTotales(),
    fugasDia = resumenFugas().litros,
    fugasSim = fugasSimPorSala(true).total,
    humanoDia = Math.max(0, totalDia - fugasDia),
    h = horaActualSim();
  const demanda = (fugasDia + fugasSim + humanoDia * PESOS_HORA[h]) / SEG_DIA;

  const red = entradaRedLps(h);
  const bomba = red > 0 && Sim.bombaEncendida ? CAUDAL_BOMBA_LMIN / 60 : 0;
  const entrada = Math.max(red, bomba);

  const hayAgua = Sim.nivel === null || Sim.nivel > 0;
  const consumo = hayAgua ? demanda : 0;
  const consumoFuga = hayAgua ? fugasSim / SEG_DIA : 0;
  const neto = entrada - consumo;

  if (Sim.nivel !== null && Sim.nivel >= Estado.capacidad && neto >= 0) {
    return {
      demanda,
      consumo,
      consumoFuga,
      entrada: consumo,
      neto: 0,
      totalDia,
      red,
      bomba: 0,
    };
  }
  return { demanda, consumo, consumoFuga, entrada, neto, totalDia, red, bomba };
}

function esHoraPico(h) {
  return (h >= 6 && h < 9) || (h >= 13 && h < 15) || (h >= 19 && h < 22);
}

function flujosPorHabitacion(hora, resumen = resumenPorSala()) {
  const factor = PESOS_HORA[hora] || 0;
  const hayAgua = Sim.nivel === null || Sim.nivel > 0;
  const extras = fugasSimPorSala(true);
  const filas = [];
  Estado.habitaciones.forEach((hab, id) => {
    const fugaSim = extras.porSala[id] || 0;
    const fijo = (resumen.fijoPorSala[id] || 0) + fugaSim;
    const humano = resumen.humanoPorSala[id] || 0;
    filas.push({
      id,
      nombre: hab.nombre,
      piso: hab.piso,
      fijo,
      humano,
      flujo: hayAgua ? (fijo + humano * factor) / 1440 : 0,
      tieneFuga: Boolean(resumen.fugaEnSala[id]) || fugaSim > 0,
      picoNombre: factor > 0 ? dispositivoPicoDeSala(id, factor) : null,
    });
  });
  return filas;
}

function renderSensores() {
  const cont = $('sensores-lista');
  const resumenEl = $('sensores-resumen');
  if (!cont || !resumenEl) {
    return;
  }

  const h = horaActualSim();
  const filas = flujosPorHabitacion(h);
  cont.innerHTML = '';

  if (!filas.length) {
    const vacio = document.createElement('p');
    vacio.className = 'sensores__vacio';
    vacio.textContent = 'El plano no tiene habitaciones con sensores.';
    cont.appendChild(vacio);
    resumenEl.textContent = '';
    return;
  }

  let total = 0;
  let alertas = 0;
  const frag = document.createDocumentFragment();
  filas.forEach((fila) => {
    total += fila.flujo;
    let estado;
    let etiqueta;
    if (Sim.nivel !== null && Sim.nivel <= 0) {
      estado = 'sin-suministro';
      etiqueta = fila.tieneFuga ? 'Fuga · sin suministro' : 'Sin suministro';
    } else if (fila.tieneFuga) {
      estado = 'anomalo';
      etiqueta = 'Anómalo';
      alertas++;
    } else if (fila.flujo > 0 && esHoraPico(h)) {
      estado = 'pico';
      etiqueta = fila.picoNombre ? 'Pico · ' + fila.picoNombre : 'Pico';
    } else if (fila.flujo > 0) {
      estado = 'normal';
      etiqueta = 'Normal';
    } else {
      estado = 'sin-consumo';
      etiqueta = 'Sin consumo';
    }

    const row = document.createElement('div');
    row.className = 'sensor sensor--' + estado;
    row.dataset.sala = fila.id;

    const nombre = document.createElement('span');
    nombre.className = 'sensor__nombre';
    nombre.textContent = fila.nombre;

    const valor = document.createElement('strong');
    valor.className = 'sensor__valor';
    valor.textContent = fila.flujo.toFixed(2) + ' L/min';

    const badge = document.createElement('span');
    badge.className = 'sensor__estado';
    badge.textContent = etiqueta;

    row.append(nombre, valor, badge);
    frag.appendChild(row);
  });
  cont.appendChild(frag);
  resumenEl.textContent =
    plural(filas.length, 'habitación', 'habitaciones') +
    ' · ' +
    total.toFixed(2) +
    ' L/min' +
    (alertas && (Sim.corriendo || Sim.fugasReveladas)
      ? ' · ' + plural(alertas, 'alerta', 'alertas')
      : '');

  if (alertas > 0 && Sim.corriendo) {
    if (!Sim.sensoresAvisados) {
      Sim.sensoresAvisados = true;
      const panel = $('sensores-panel');
      if (panel) {
        panel.open = true;
      }
    }
    marcarFugasReveladas();
  }
}

function actualizarAvisoVacio() {
  const aviso = $('sim-aviso-vacio');
  if (!aviso) {
    return;
  }
  const mostrar = Boolean(
    Sim.pausaVacio && Sim.nivel !== null && Sim.nivel <= 0 && !Sim.bombaEncendida
  );
  aviso.hidden = !mostrar;

  const texto = $('sim-aviso-texto');
  if (texto) {
    texto.textContent = Sim.bombaActiva
      ? 'La bomba automática arrancará cuando haya suministro. También puedes seguir el tiempo sin agua para observar el corte.'
      : 'La bomba está apagada. Actívala para recuperar el agua cuando haya suministro, o sigue el tiempo sin agua para observar el corte.';
  }

  const alerta = $('sim-alerta');
  if (alerta) {
    alerta.hidden = mostrar || !MENSAJES_SIM[Sim.estado];
  }
}

function renderEstadoSesion() {
  const el = $('sim-estado-sesion');
  if (!el) {
    return;
  }

  let texto = 'Listo';
  let estado = '';
  if (Sim.pausaVacio) {
    texto = 'Tanque vacío';
    estado = 'aviso';
  } else if (Sim.corriendo) {
    texto = 'En marcha';
    estado = 'activa';
  } else if (Sim.tiempo > 0 || Sim.consumoAcumulado > 0) {
    texto = 'En pausa';
    estado = 'pausa';
  }

  if (el.textContent !== texto) {
    el.textContent = texto;
  }
  if (el.dataset.estado !== estado) {
    el.dataset.estado = estado;
  }
}

function simRender() {
  const cap = Estado.capacidad;
  if (Sim.nivel === null || Sim.nivel > cap) {
    Sim.nivel = cap;
  }
  if (Sim.nivel < 0) {
    Sim.nivel = 0;
  }

  actualizarBomba();
  const f = simFlujos(),
    red = redDisponible(),
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
  $('sim-tanque').classList.toggle('critico', estado === 'critico' || estado === 'vacio');

  $('sim-m-nivel').textContent = litrosTexto(Sim.nivel);
  $('sim-m-consumo').textContent = lmin(f.consumo);
  $('sim-m-entrada').textContent = lmin(f.entrada);
  $('sim-m-balance').textContent =
    (neto > 0 ? '+' : neto < 0 ? '−' : '') + Math.abs(neto).toFixed(2) + ' L/min';
  $('sim-m-tiempo').textContent = formatoReloj(Sim.tiempo);
  $('sim-m-franja').textContent = Sim.bombaEncendida
    ? 'Bomba llenando'
    : Sim.nivel <= 0
      ? red
        ? 'Tinaco vacío · red disponible'
        : 'Sin suministro'
      : etiquetaFranja(horaActualSim());
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

  renderBomba();
  actualizarAvisoVacio();
  renderEstadoSesion();
  detectarEventos();
  renderEntradaSuministro();

  if (estado !== Sim.estado) {
    Sim.estado = estado;
    const m = MENSAJES_SIM[estado];
    const alerta = $('sim-alerta');
    alerta.hidden = !m;
    alerta.className = 'alerta ' + (m ? m.nivel : '');
    alerta.innerHTML = m ? '<strong>' + m.titulo + '</strong>' + m.texto : '';
  }

  const ahora = performance.now();
  if (ahora - Sim.ultimoSensores > 900 || estado !== Sim.estadoSensores) {
    Sim.ultimoSensores = ahora;
    Sim.estadoSensores = estado;
    renderSensores();
  }
  renderBitacora();
}

function simPaso(t) {
  if (!Sim.corriendo) {
    return;
  }
  const dt = Math.max(0, Math.min((t - Sim.ultimo) / 1000, 0.1));
  Sim.ultimo = t;

  let restante = dt * Sim.velocidad;
  while (restante > 0) {
    const segEnHora = 3600 - (Sim.tiempo % 3600);
    const paso = Math.min(restante, segEnHora > 0 ? segEnHora : 3600);
    actualizarBomba();
    const f = simFlujos();
    const horaAntes = Math.floor(Sim.tiempo / 3600);
    const fugasAntes = fugasIniciadas().length;
    Sim.nivel = Math.min(Math.max(Sim.nivel + f.neto * paso, 0), Estado.capacidad);
    Sim.consumoAcumulado += f.consumo * paso;
    Sim.aguaPerdida += f.consumoFuga * paso;
    Sim.tiempo += paso;
    restante -= paso;
    const fugasAhora = fugasIniciadas().length;
    if (fugasAhora !== fugasAntes) {
      marcarFugasReveladas();
    }
    if (fugasAhora !== fugasAntes || Math.floor(Sim.tiempo / 3600) !== horaAntes) {
      Sim.ultimoSensores = 0;
    }
    if (Sim.seguirSinAgua && Sim.nivel > 0 && f.entrada > 0) {
      Sim.seguirSinAgua = false;
      Estado.simSeguirSinAgua = false;
    }
    if (Sim.nivel <= 0 && f.entrada <= 0) {
      if (!Sim.seguirSinAgua) {
        simPausar();
        Sim.pausaVacio = true;
        $('sim-finalizar').hidden = false;
        break;
      }
    }
  }

  simRender();
  if (Sim.corriendo) {
    Sim.raf = requestAnimationFrame(simPaso);
  }
}

function simIniciar() {
  if (Sim.nivel === null || Sim.nivel > Estado.capacidad) {
    Sim.nivel = Estado.capacidad;
  }
  actualizarBomba();
  if (Sim.nivel <= 0 && !Sim.seguirSinAgua) {
    const f = simFlujos();
    if (f.entrada <= 0) {
      Sim.corriendo = false;
      Estado.simCorriendo = false;
      Sim.pausaVacio = true;
      $('sim-play').textContent = '▶ Iniciar';
      $('sim-finalizar').hidden = true;
      simRender();
      return;
    }
  }
  Sim.pausaVacio = false;
  Sim.corriendo = true;
  Estado.simCorriendo = true;
  Sim.ultimo = performance.now();
  Sim.logPrev = {
    red: redDisponible(),
    bomba: Sim.bombaEncendida,
    vacio: Sim.nivel !== null && Sim.nivel <= 0,
    pico: esHoraPico(horaActualSim()),
  };
  registrarEvento('Comienza la simulación', '');
  renderBitacora();
  $('sim-play').textContent = '⏸ Pausar';
  $('sim-finalizar').hidden = false;
  renderBomba();
  renderEstadoSesion();
  Sim.raf = requestAnimationFrame(simPaso);
}

function simPausar() {
  Sim.corriendo = false;
  Estado.simCorriendo = false;
  Estado.simNivel = Sim.nivel;
  Estado.simTiempo = Sim.tiempo;
  cancelAnimationFrame(Sim.raf);
  $('sim-play').textContent = '▶ Iniciar';
  $('sim-finalizar').hidden = true;
  renderBomba();
  renderEstadoSesion();
}

function simReiniciar() {
  simPausar();
  Sim.nivel = Estado.capacidad;
  Estado.simNivel = Estado.capacidad;
  Sim.tiempo = 0;
  Estado.simTiempo = 0;
  Sim.seguirSinAgua = false;
  Estado.simSeguirSinAgua = false;
  cambiarBomba(false);
  Sim.consumoAcumulado = 0;
  Estado.simConsumoAcumulado = 0;
  Sim.pausaVacio = false;
  Sim.estado = null;
  Sim.velocidad = Estado.simVelocidad;
  Sim.modoSuministro = Estado.simModoSuministro;
  Sim.bombaActiva = Estado.simBombaActiva !== false;
  Sim.aguaPerdida = 0;
  Estado.simAguaPerdida = 0;
  Sim.sensoresAvisados = false;
  Sim.bitacora = [];
  Sim.bitacoraSucia = true;
  Sim.logPrev = { red: null, bomba: null, vacio: null, pico: null };
  limpiarFugasReveladas();
  aplicarCasoFuga(Sim.fugasActivo ? casoFugaAleatorio() : Sim.casoFuga);
  $('sim-vel').value = String(Sim.velocidad);
  renderModosSuministro();
  simRender();
}

function escapeHtml(texto) {
  const div = document.createElement('div');
  div.textContent = texto;
  return div.innerHTML;
}

function mostrarResumenSimulacion() {
  const aguaConsumida = Math.max(0, Sim.consumoAcumulado);
  const fugasDia = resumenFugas();
  const fugasSim = fugasSimPorSala(true);

  $('resumen-agua-consumida').textContent = NUM_ES.format(Math.round(aguaConsumida)) + ' L';
  $('resumen-tiempo').textContent = formatoReloj(Sim.tiempo);
  $('resumen-fugas').textContent =
    NUM_ES.format(Math.round(fugasDia.litros + fugasSim.total)) + ' L/día';

  const textoFugas = $('resumen-fugas-resumen');
  const listaFugas = $('resumen-fugas-lista');
  const btnPlano = $('resumen-ver-plano');
  if (textoFugas && listaFugas && btnPlano) {
    listaFugas.innerHTML = '';
    const iniciadas = fugasIniciadas();
    const casoActivo = Sim.fugasActivo && iniciadas.length > 0;
    if (casoActivo) {
      textoFugas.textContent =
        iniciadas.length +
        ' fuga(s) · ' +
        fugasSim.total +
        ' L/día · ' +
        Math.round(Sim.aguaPerdida) +
        ' L perdidos durante la sesión';
      iniciadas.forEach((id) => {
        const d = Estado.dispositivos.get(id);
        if (!d) {
          return;
        }
        const hab = Estado.habitaciones.get(d.sala);
        const li = document.createElement('li');
        li.textContent =
          (hab ? hab.nombre : 'Habitación') +
          ' · ' +
          CATALOGO[d.tipo].nombre +
          ' · ' +
          TASAS_FUGA[d.tipo] +
          ' L/día';
        listaFugas.appendChild(li);
      });
      btnPlano.hidden = false;
      marcarFugasReveladas();
    } else if (Sim.fugasActivo && Sim.fugasActivas.length > 0) {
      textoFugas.textContent =
        'La corrida terminó antes de que apareciera una anomalía. Reinicia para volver a intentarlo.';
      btnPlano.hidden = true;
    } else {
      textoFugas.textContent = Sim.fugasActivo
        ? 'Este plano no tiene aparatos compatibles con una fuga sorpresa.'
        : 'Fugas sorpresa desactivadas en esta corrida.';
      btnPlano.hidden = true;
    }
  }

  const contenedor = $('resumen-lista-habitaciones');
  contenedor.innerHTML = '';

  const porSala = {};
  Estado.dispositivos.forEach((d) => {
    const salaId = d.sala;
    const hab = Estado.habitaciones.get(salaId);
    if (!hab) {
      return;
    }
    const nombre = escapeHtml(hab.nombre);
    const l = litrosDe(d);
    porSala[nombre] = (porSala[nombre] || 0) + l;
  });

  const totalDia = Object.values(porSala).reduce((a, b) => a + b, 0) || 1;

  if (Object.keys(porSala).length === 0) {
    contenedor.innerHTML =
      '<p style="color: var(--tenue); font-size: 0.8rem; margin: 0;">Sin dispositivos registrados.</p>';
  } else {
    Object.entries(porSala).forEach(([nombre, litros]) => {
      const pct = Math.round((litros / totalDia) * 100);
      const div = document.createElement('div');
      div.className = 'resumen__habitacion';
      div.innerHTML =
        '<span class="resumen__habitacion-nombre">' +
        nombre +
        '</span><div><strong class="resumen__habitacion-valor">' +
        Math.round(litros) +
        ' L/día</strong><span class="resumen__habitacion-pct">' +
        pct +
        ' %</span></div>';
      contenedor.appendChild(div);
    });
  }

  $('modal-resumen-simulacion').hidden = false;
  queueMicrotask(() => $('modal-resumen-cerrar').focus());
}

$('sim-play').addEventListener('click', () => (Sim.corriendo ? simPausar() : simIniciar()));
$('sim-reset').addEventListener('click', simReiniciar);
$('sim-finalizar').addEventListener('click', () => {
  simPausar();
  mostrarResumenSimulacion();
});
$('sim-vel').addEventListener('change', (e) => {
  Sim.velocidad = Number(e.target.value);
  Estado.simVelocidad = Sim.velocidad;
});
document.querySelectorAll('[data-modo-suministro]').forEach((btn) => {
  btn.addEventListener('click', () => seleccionarModoSuministro(btn.dataset.modoSuministro));
});

function notaDe(btn) {
  return btn && btn.dataset.nota ? $(btn.dataset.nota) : null;
}

function cerrarNotasSim(excepto) {
  document.querySelectorAll('.sim__ayuda-btn[aria-expanded="true"]').forEach((btn) => {
    const nota = notaDe(btn);
    if (!nota || nota === excepto) {
      return;
    }
    nota.hidden = true;
    btn.setAttribute('aria-expanded', 'false');
  });
}

$('sim-fugas-activo').addEventListener('change', (e) => {
  Sim.fugasActivo = e.target.checked;
  Estado.simFugasActivo = Sim.fugasActivo;
  Sim.sensoresAvisados = false;
  limpiarFugasReveladas();
  if (Sim.fugasActivo) {
    aplicarCasoFuga(casoFugaAleatorio());
  }
  renderFugasSim();
  simRender();
});

document.querySelectorAll('.sim__ayuda-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    const nota = notaDe(btn);
    if (!nota) {
      return;
    }
    const abrir = nota.hidden;
    cerrarNotasSim(nota);
    nota.hidden = !abrir;
    btn.setAttribute('aria-expanded', abrir ? 'true' : 'false');
  });
});

document.addEventListener('click', (e) => {
  if (!e.target.closest('.sim__ayuda-btn') && !e.target.closest('.sim__control-nota')) {
    cerrarNotasSim();
  }
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    cerrarNotasSim();
  }
});

$('sim-bomba-activa').addEventListener('change', (e) => {
  Sim.bombaActiva = e.target.checked;
  Estado.simBombaActiva = Sim.bombaActiva;
  if (Sim.bombaActiva) {
    Sim.pausaVacio = false;
    actualizarBomba();
  } else {
    cambiarBomba(false);
  }
  simRender();
});

$('sim-seguir-sin-agua').addEventListener('click', () => {
  Sim.seguirSinAgua = true;
  Estado.simSeguirSinAgua = true;
  Sim.pausaVacio = false;
  simIniciar();
});

$('sim-encender-bomba').addEventListener('click', () => {
  if (!redDisponible()) {
    return;
  }
  Sim.bombaActiva = true;
  Estado.simBombaActiva = true;
  Sim.pausaVacio = false;
  actualizarBomba();
  if (!Sim.corriendo) {
    simIniciar();
  } else {
    simRender();
  }
});

window.__cdnError = (lib) => {
  const alerta = $('alerta');
  const mensaje =
    lib === 'chartjs'
      ? 'El gráfico de consumo no está disponible (Chart.js no cargó). Revisa tu conexión a internet.'
      : 'La exportación a PDF no está disponible (jspdf no cargó). Revisa tu conexión a internet.';
  if (alerta) {
    alerta.className = 'alerta critica';
    alerta.innerHTML = '<strong>⚠️ Recurso no disponible</strong><br>' + mensaje;
  }
  console.warn('SmartGota: CDN falló:', lib);
};

window.addEventListener('beforeunload', (e) => {
  if (cambiosPendientes) {
    e.preventDefault();
    e.returnValue = '';
  }
});

function persistirSimulacion() {
  if (reiniciandoCasa || Sim.nivel === null) {
    return;
  }
  const estabaPausado = pausado;
  pausado = true;
  Estado.simNivel = Sim.nivel;
  Estado.simTiempo = Sim.tiempo;
  Estado.simCorriendo = Sim.corriendo;
  Estado.simSeguirSinAgua = Sim.seguirSinAgua;
  Estado.simBombaActiva = Sim.bombaActiva;
  Estado.simConsumoAcumulado = Sim.consumoAcumulado;
  Estado.simCasoFuga = Sim.casoFuga;
  Estado.simFugasActivas = Sim.fugasActivas.slice();
  Estado.simFugasActivo = Sim.fugasActivo;
  Estado.simAguaPerdida = Sim.aguaPerdida;
  pausado = estabaPausado;
  guardarEstado();
}

window.addEventListener('beforeunload', persistirSimulacion);
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    persistirSimulacion();
  }
});

function sincronizarSimDesdeEstado() {
  Sim.velocidad = Estado.simVelocidad;
  Sim.modoSuministro = Estado.simModoSuministro || 'normal';
  Sim.seguirSinAgua = Boolean(Estado.simSeguirSinAgua);
  Sim.bombaActiva = Estado.simBombaActiva !== false;
  Sim.bombaEncendida = false;
  Sim.consumoAcumulado = Math.max(0, Number(Estado.simConsumoAcumulado) || 0);
  Sim.casoFuga = normalizarCasoFuga(Estado.simCasoFuga);
  Sim.fugasActivo = Estado.simFugasActivo !== false;
  Sim.fugasActivas = Array.isArray(Estado.simFugasActivas)
    ? Estado.simFugasActivas.filter((id) => Estado.dispositivos.has(id))
    : [];
  const casoGuardado = generarCasoFuga(Sim.casoFuga, idsElegiblesFuga());
  Sim.horaInicioFuga = new Map(Sim.fugasActivas.map((id) => [id, casoGuardado.horas.get(id) ?? 0]));
  Sim.aguaPerdida = Math.max(0, Number(Estado.simAguaPerdida) || 0);
  Sim.nivel =
    Estado.simNivel !== null ? Math.min(Estado.simNivel, Estado.capacidad) : Estado.capacidad;
  Sim.tiempo = Estado.simTiempo || 0;
  Sim.estado = null;
  Sim.estadoSensores = null;
  Sim.ultimoSensores = 0;
  Sim.pausaVacio = Sim.nivel <= 0 && !Sim.seguirSinAgua;

  $('sim-vel').value = String(Sim.velocidad);
  renderModosSuministro();
  renderFugasSim();
  actualizarBomba();
  simRender();

  if (Estado.simCorriendo) {
    simIniciar();
  }
}

// Onboarding express y plantillas iniciales
let vistaAvanzada = 'constructor';

function elegirVivienda(perfil) {
  if (!HABITANTES_SUGERIDOS[perfil]) {
    return;
  }
  crearCasa({ perfil, habitantes: HABITANTES_SUGERIDOS[perfil] });
}

function abrirOnboarding() {
  const modal = $('modal-onboarding');
  if (!modal) {
    return;
  }
  modal.hidden = false;
  const primera = modal.querySelector('.perfil-opcion');
  if (primera) {
    primera.focus();
  }
}

function crearCasa(datos) {
  pausado = true;
  try {
    vaciarCasa();
    Estado.habitantes = datos.habitantes;
    Estado.perfil = datos.perfil;
    Estado.capacidad = CAPACIDAD_POR_PERFIL[datos.perfil] || 750;
    Estado.onboardingCompletado = true;
    Estado.simModoSuministro = 'normal';
    Estado.simVelocidad = 3600;
    Estado.simBombaActiva = true;
    Estado.simConsumoAcumulado = 0;
    generarPlantilla(datos.perfil, datos.habitantes);
    recalcularUsosPorNivel();
    Estado.pisoActivo = Estado.pisos.keys().next().value;
    renderTabs();
    activarPiso(Estado.pisoActivo);
    simReiniciar();
  } finally {
    pausado = false;
    notificar();
  }

  $('habitantes').textContent = Estado.habitantes;
  $('capacidad').textContent = Estado.capacidad + ' L';
  $('modal-onboarding').hidden = true;
  const titulo = $('vista-constructor').querySelector('h2');
  if (titulo) {
    titulo.setAttribute('tabindex', '-1');
    titulo.focus({ preventScroll: true });
  }
}

function vaciarCasa() {
  cerrarEditor();
  Estado.pisos.clear();
  Estado.habitaciones.clear();
  Estado.dispositivos.clear();
  Estado.pisoActivo = null;
  Estado.siguienteId = 1;
  Estado.siguienteSala = 1;
  Estado.siguientePiso = 1;
  $('plano').innerHTML = '';
  $('tabs').innerHTML = '';
}

function crearSalaConDispositivos(nombre, piso, cs, rs, dispositivos, tipo, rol) {
  const sala = crearHabitacion(nombre, piso, { cs, rs, tipo, rol });
  const posiciones = [
    [0.2, 0.2],
    [0.2, 0.6],
    [0.7, 0.4],
    [0.7, 0.7],
  ];
  dispositivos.forEach((d, i) => {
    const pos = posiciones[i % posiciones.length];
    agregarDispositivo(d.tipo, sala, pos[0], pos[1], {
      uso_personalizado: d.uso,
      frecuencia: d.frecuencia || 'dia',
      modo: d.modo || 'estandar',
      origen: 'plantilla',
    });
  });
  return sala;
}

function generarPlantilla(perfil, n) {
  const pb = crearPiso('Planta Baja');
  Estado.pisoActivo = pb;

  if (perfil === 'bajo') {
    crearSalaConDispositivos(
      'Baño',
      pb,
      1,
      1,
      [
        { tipo: 'ducha', uso: n * 10 },
        { tipo: 'inodoro', uso: n * 5 },
        { tipo: 'lavabo', uso: n * 3 },
      ],
      'bano',
      'principal'
    );
    crearSalaConDispositivos(
      'Cocina',
      pb,
      2,
      1,
      [{ tipo: 'lavabo', uso: 2 }],
      'cocina',
      'principal'
    );
    return;
  }

  const pa = crearPiso('Planta Alta');

  if (perfil === 'medio') {
    crearSalaConDispositivos(
      'Cocina',
      pb,
      2,
      1,
      [{ tipo: 'lavabo', uso: 4 }],
      'cocina',
      'principal'
    );
    crearSalaConDispositivos(
      'Lavandería',
      pb,
      1,
      1,
      [{ tipo: 'lavadora', uso: 4, frecuencia: 'semana' }],
      'lavanderia',
      'principal'
    );
    crearSalaConDispositivos(
      'Medio baño',
      pb,
      1,
      1,
      [
        { tipo: 'inodoro', uso: n * 3 },
        { tipo: 'lavabo', uso: n * 2 },
      ],
      'bano',
      'medio'
    );
    crearSalaConDispositivos(
      'Baño completo',
      pa,
      2,
      1,
      [
        { tipo: 'ducha', uso: n * 12 },
        { tipo: 'inodoro', uso: n * 6 },
        { tipo: 'lavabo', uso: n * 4 },
      ],
      'bano',
      'principal'
    );
    return;
  }

  crearSalaConDispositivos(
    'Cocina',
    pb,
    2,
    1,
    [
      { tipo: 'lavabo', uso: 5 },
      { tipo: 'lavavajillas', uso: 5, frecuencia: 'semana' },
    ],
    'cocina',
    'principal'
  );
  crearSalaConDispositivos(
    'Lavandería',
    pb,
    1,
    1,
    [{ tipo: 'lavadora', uso: 5, frecuencia: 'semana' }],
    'lavanderia',
    'principal'
  );
  crearSalaConDispositivos(
    'Jardín',
    pb,
    2,
    1,
    [{ tipo: 'grifo', uso: 30, frecuencia: 'semana' }],
    'patio',
    'principal'
  );
  crearSalaConDispositivos(
    'Medio baño',
    pb,
    1,
    1,
    [
      { tipo: 'inodoro', uso: n * 4 },
      { tipo: 'lavabo', uso: n * 2 },
    ],
    'bano',
    'medio'
  );
  crearSalaConDispositivos(
    'Baño principal',
    pa,
    2,
    1,
    [
      { tipo: 'ducha', uso: n * 15 },
      { tipo: 'inodoro', uso: n * 6 },
      { tipo: 'lavabo', uso: n * 4 },
    ],
    'bano',
    'principal'
  );
  crearSalaConDispositivos(
    'Baño 2',
    pa,
    1,
    1,
    [
      { tipo: 'ducha', uso: n * 10 },
      { tipo: 'inodoro', uso: n * 5 },
      { tipo: 'lavabo', uso: n * 3 },
    ],
    'bano',
    'secundario'
  );
}

async function reiniciarCasa() {
  const ok = await modalConfirm(
    'Se borrarán el plano, los dispositivos y tus respuestas. Esta acción no se puede deshacer.',
    'Reiniciar casa'
  );
  if (!ok) {
    return;
  }
  reiniciandoCasa = true;
  cambiosPendientes = false;
  try {
    CLAVES_LEGADO.forEach((clave) => localStorage.removeItem(clave));
    localStorage.removeItem(CLAVE_LS);
  } catch (_) {
    // Recargar igualmente si localStorage está bloqueado
  }
  location.reload();
}

function iniciarApp() {
  renderTabs();
  if (Estado.pisoActivo && Estado.pisos.has(Estado.pisoActivo)) {
    activarPiso(Estado.pisoActivo);
  } else {
    $('plano').innerHTML = '';
  }
  if (!Estado.onboardingCompletado) {
    abrirOnboarding();
  } else {
    renderDashboard();
  }
}

function reaplicarSpans() {
  Estado.habitaciones.forEach((hab) => {
    const el = salaEl(hab.id);
    if (el) {
      aplicarSpans(el, hab);
    }
  });
}

function mostrarVistaAvanzada(nombre) {
  vistaAvanzada = nombre === 'simulador' ? 'simulador' : 'constructor';
  document.querySelectorAll('.vista-tab').forEach((tab) => {
    const activa = tab.dataset.vista === vistaAvanzada;
    tab.classList.toggle('activa', activa);
    tab.setAttribute('aria-selected', activa ? 'true' : 'false');
  });
  document.querySelectorAll('.vista').forEach((v) => {
    v.classList.remove('activa');
    v.hidden = true;
  });
  const vista = $('vista-' + vistaAvanzada);
  if (!vista) {
    return;
  }
  vista.classList.add('activa');
  vista.hidden = false;
  if (vistaAvanzada === 'constructor') {
    requestAnimationFrame(() => {
      activarPiso(Estado.pisoActivo);
      renderizarGuiaGrid(false);
      reaplicarSpans();
      renderDashboard();
    });
  } else {
    requestAnimationFrame(() => simRender());
  }
}

function trapaFoco(contenedor, evento) {
  const focos = [
    ...contenedor.querySelectorAll(
      'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href]'
    ),
  ].filter((el) => el.offsetParent !== null);
  if (!focos.length) {
    return;
  }
  const primero = focos[0];
  const ultimo = focos[focos.length - 1];
  if (evento.shiftKey && document.activeElement === primero) {
    evento.preventDefault();
    ultimo.focus();
  } else if (!evento.shiftKey && document.activeElement === ultimo) {
    evento.preventDefault();
    primero.focus();
  }
}

$('onboarding-form').addEventListener('submit', (evento) => evento.preventDefault());
$('onb-perfiles').addEventListener('click', (evento) => {
  const opcion = evento.target.closest('.perfil-opcion');
  if (opcion) {
    elegirVivienda(opcion.dataset.perfil);
  }
});
$('modal-onboarding').addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    e.preventDefault();
    return;
  }
  if (e.key === 'Tab') {
    trapaFoco($('modal-onboarding'), e);
  }
});
$('btn-reiniciar-casa').addEventListener('click', reiniciarCasa);

// Arranque principal
construirPaleta();
cargarEstado();
iniciarApp();
sincronizarSimDesdeEstado();

let ayudaRetorno = null;

function ayudaTeclas(evento) {
  if (evento.key === 'Escape') {
    evento.preventDefault();
    cerrarAyuda();
    return;
  }
  if (evento.key === 'Tab') {
    trapaFoco($('modal-ayuda'), evento);
  }
}

function cerrarAyuda() {
  const modal = $('modal-ayuda');
  if (!modal || modal.hidden) {
    return;
  }
  modal.hidden = true;
  document.removeEventListener('keydown', ayudaTeclas);
  if (ayudaRetorno && typeof ayudaRetorno.focus === 'function') {
    ayudaRetorno.focus();
  }
}

$('btn-ayuda').addEventListener('click', () => {
  const modal = $('modal-ayuda');
  if (!modal) {
    return;
  }
  ayudaRetorno = $('btn-ayuda');
  modal.hidden = false;
  document.addEventListener('keydown', ayudaTeclas);
  queueMicrotask(() => $('modal-ayuda-cerrar').focus());
});

$('modal-ayuda-cerrar').addEventListener('click', cerrarAyuda);
$('modal-ayuda-ok').addEventListener('click', cerrarAyuda);
$('modal-ayuda').addEventListener('click', (e) => {
  if (e.target === $('modal-ayuda')) {
    cerrarAyuda();
  }
});

const btnAcciones = $('btn-acciones');
const menuAcciones = $('menu-acciones');

function cerrarMenuAcciones() {
  if (!btnAcciones || !menuAcciones) {
    return;
  }
  menuAcciones.hidden = true;
  btnAcciones.setAttribute('aria-expanded', 'false');
}

if (btnAcciones && menuAcciones) {
  btnAcciones.addEventListener('click', (e) => {
    e.stopPropagation();
    const abrir = menuAcciones.hidden;
    menuAcciones.hidden = !abrir;
    btnAcciones.setAttribute('aria-expanded', abrir ? 'true' : 'false');
  });
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.menu-acciones')) {
      cerrarMenuAcciones();
    }
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !menuAcciones.hidden) {
      cerrarMenuAcciones();
      btnAcciones.focus();
    }
  });
  menuAcciones.querySelectorAll('button').forEach((btn) => {
    btn.addEventListener('click', cerrarMenuAcciones);
  });
}

$('btn-ir-simulador').addEventListener('click', () => mostrarVistaAvanzada('simulador'));

document.querySelectorAll('.vista-tab').forEach((tab) => {
  tab.addEventListener('click', () => mostrarVistaAvanzada(tab.dataset.vista));
});

renderizarGuiaGrid();

$('modal-resumen-cerrar').addEventListener('click', () => {
  $('modal-resumen-simulacion').hidden = true;
});

$('modal-resumen-volver').addEventListener('click', () => {
  $('modal-resumen-simulacion').hidden = true;
  simReiniciar();
});

$('resumen-ver-plano').addEventListener('click', () => {
  $('modal-resumen-simulacion').hidden = true;
  marcarFugasReveladas();
  const d = Estado.dispositivos.get(Sim.fugasActivas[0]);
  const hab = d ? Estado.habitaciones.get(d.sala) : null;
  if (hab) {
    Estado.pisoActivo = hab.piso;
  }
  mostrarVistaAvanzada('constructor');
  const primero = $(Sim.fugasActivas[0]);
  if (primero) {
    requestAnimationFrame(() => primero.focus());
  }
});

$('modal-resumen-simulacion').addEventListener('click', (e) => {
  if (e.target === $('modal-resumen-simulacion')) {
    $('modal-resumen-simulacion').hidden = true;
  }
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !$('modal-resumen-simulacion').hidden) {
    $('modal-resumen-simulacion').hidden = true;
  }
});
