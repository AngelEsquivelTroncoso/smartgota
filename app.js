/* SmartGota — app.js (v21)
   Secciones: Modelo/Estado · Resumen · Diagnóstico · Pisos · Habitaciones · Layout (Grid Spans) · Drag & Drop · Papelera · Clones · Editor · Simulación (consumo + red) · Arranque
   Reactividad: todo cambio en Estado (Proxy) repinta el resumen/diagnóstico y guarda en localStorage. */
'use strict';
/* ===========================================================
   MODELO (todo por ID):
   Estado.pisos[id]  <--  Estado.habitaciones[id].piso  <--  Estado.dispositivos[id].sala
   Cambiar de pestaña solo alterna `hidden`: los nodos (y el tamaño que dejó el
   resize nativo en su style) siguen vivos en el DOM.
   =========================================================== */

const CONFIG = {
  diasMes: 30, // días por mes para estimación mensual
  tamClon: 44, // tamaño de píxel del clon en el plano
  litrosOMS: 100, // L/hab/día · referencia OMS (mínimo de servicio)
  refEficiente: 80, // L/hab/día vecino eficiente Torreón
  refAlto: 180, // L/hab/día residencial alto
};

/* Formato de números y plurales.
   Un solo formateador evita repetir toLocaleString en cada fotograma del HUD. */
const NUM_ES = new Intl.NumberFormat('es-MX');

function litrosTexto(n) {
  return NUM_ES.format(Math.round(n)) + ' L';
}

function plural(n, singular, pluralText) {
  return NUM_ES.format(n) + ' ' + (n === 1 ? singular : pluralText);
}

/* Énfasis en mensajes de texto plano.
   Los mensajes se pintan con textContent, así que el énfasis viaja como marca
   invisible y se convierte en <strong> al escribir en el DOM. Nunca innerHTML:
   los nombres de habitación son texto del usuario. */
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
    sugerido: 4,
    frecuenciaInicial: 'semana',
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

/* Caudal de fuga continua por tipo de dispositivo, en L/día.
   Referencias domésticas: una válvula de inodoro que no cierra pierde entre
   150 y 300 L/día. El ítem "fuga" de la paleta queda fuera porque ya se
   contabiliza vía CATALOGO[tipo].fijo. */
const TASAS_FUGA = {
  inodoro: 200,
  ducha: 120,
  grifo: 90,
  tina: 80,
  lavadora: 60,
  lavavajillas: 60,
  lavabo: 50,
};

/* Promedios educativos por tamaño de vivienda.
   Evitan pedirle al usuario minutos, cargas o descargas. No son mediciones exactas:
   son valores de partida para estimar el consumo de la vivienda.
   - ducha, inodoro y lavabo: uso por persona y por día.
   - duchaSecundaria, inodoroMedio/Secundario y lavaboMedio/Secundario: ajustes por tipo de baño.
   - lavaboCocina: uso del hogar por día.
   - lavadora y lavavajillas: cargas del hogar por semana (para 4 personas).
   - grifo: minutos del hogar por semana; tina: usos por semana.
   - aire: horas por día en un espacio principal; aireSecundario: horas en uno
     secundario (el aire es carga puntual: no se reparte entre aparatos).
   - filtro: litros filtrados por persona y por día. */
const PROMEDIOS = {
  bajo: {
    ducha: 10,
    duchaSecundaria: 10,
    inodoro: 5,
    inodoroMedio: 3,
    inodoroSecundario: 5,
    lavabo: 3,
    lavaboCocina: 2,
    lavaboMedio: 2,
    lavaboSecundario: 3,
    tina: 1,
    lavadora: 3,
    lavavajillas: 2,
    grifo: 15,
    aire: 10,
    aireSecundario: 6,
    filtro: 5,
  },
  medio: {
    ducha: 12,
    duchaSecundaria: 10,
    inodoro: 6,
    inodoroMedio: 3,
    inodoroSecundario: 5,
    lavabo: 4,
    lavaboCocina: 4,
    lavaboMedio: 2,
    lavaboSecundario: 3,
    tina: 1,
    lavadora: 4,
    lavavajillas: 4,
    grifo: 30,
    aire: 10,
    aireSecundario: 6,
    filtro: 5,
  },
  alto: {
    ducha: 15,
    duchaSecundaria: 10,
    inodoro: 6,
    inodoroMedio: 4,
    inodoroSecundario: 5,
    lavabo: 4,
    lavaboCocina: 5,
    lavaboMedio: 2,
    lavaboSecundario: 3,
    tina: 2,
    lavadora: 5,
    lavavajillas: 5,
    grifo: 30,
    aire: 10,
    aireSecundario: 6,
    filtro: 5,
  },
};

// Los estados v3 anteriores guardaban el perfil de vivienda como basica/familiar/amplia.
// Se normalizan al tamaño de vivienda equivalente sin obligar a repetir el onboarding.
const ALIAS_PERFIL = {
  basica: 'bajo',
  familiar: 'medio',
  amplia: 'alto',
  bajo: 'bajo',
  medio: 'medio',
  alto: 'alto',
};

function normalizarPerfil(perfil) {
  return ALIAS_PERFIL[perfil] || 'bajo';
}

function etiquetaPerfil(perfil) {
  return { bajo: 'Compacta', medio: 'Estándar', alto: 'Amplia' }[normalizarPerfil(perfil)];
}

// Personas sugeridas al elegir el tamaño de vivienda; el usuario puede ajustarlas.
const HABITANTES_SUGERIDOS = { bajo: 2, medio: 4, alto: 5 };

/* ---------- Estado reactivo (Proxy) + persistencia ---------- */
const CLAVE_LS = 'smartgota:estado:v3';
const CLAVES_LEGADO = ['smartgota:estado:v1', 'smartgota:estado:v2', 'smartgota:wizard:v1'];

let pausado = false,
  pendiente = false,
  lsFallido = false,
  cambiosPendientes = false,
  reiniciandoCasa = false,
  temporizadorCambios = null;

// Varias mutaciones dentro de un mismo evento => UN solo repintado y UN solo guardado
function notificar() {
  if (pausado || pendiente) {
    return;
  }
  pendiente = true;
  cambiosPendientes = true;
  // Resetear cambiosPendientes después de 3 segundos sin cambios nuevos
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
    version: 3,
    onboardingCompletado: false,
    perfil: 'bajo', // 'bajo' | 'medio' | 'alto' (tamaño de vivienda: Compacta | Estándar | Amplia)
    habitantes: 4,
    reciboM3: 0, // m³ del último recibo mensual
    capacidad: 750,
    pisoActivo: null,
    pisos: new MapaReactivo(), // id -> { id, nombre }
    habitaciones: new MapaReactivo(), // id -> { id, nombre, piso, cx, cy, cs, rs }
    dispositivos: new MapaReactivo(), // id -> { tipo, sala, fx, fy, uso_personalizado, frecuencia, modo, origen }
    siguienteId: 1,
    siguienteSala: 1,
    siguientePiso: 1,
    // Estado de simulación (persistido para retomar al recargar)
    simNivel: null,
    simTiempo: 0,
    simCorriendo: false,
    simVelocidad: 3600,
    simModoSuministro: 'normal', // 'normal' | 'tandeo' | 'corte'
    simSeguirSinAgua: false,
    simBombaActiva: true,
    simConsumoAcumulado: 0,
    simCasoFuga: 4821,
    simFugasActivas: [],
    simFugasActivo: true,
    simAguaPerdida: 0,
    // Periodo de cálculo (persistido)
    diasMes: CONFIG.diasMes,
  },
  manejador
);

// Serialización: Map -> arreglo de pares [id, registro] (JSON no entiende Map)
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
        reciboM3: Estado.reciboM3,
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
        diasMes: Estado.diasMes,
      })
    );
    lsFallido = false;
    ocultarAvisoLS();
  } catch (_) {
    // Almacenamiento lleno o bloqueado: la app sigue funcionando sin guardar.
    if (!lsFallido) {
      lsFallido = true;
      mostrarAvisoLS();
    }
  }
}

// Muestra / oculta un aviso discreto cuando localStorage falla (2.2)
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

// Deserialización: arreglos -> Map reactivos + reconstrucción del DOM.
// Sin estado v3 no se siembra nada: el onboarding se encarga de crear la casa inicial.
function cargarEstado() {
  let g = null;
  try {
    g = JSON.parse(localStorage.getItem(CLAVE_LS));
  } catch (_) {
    // localStorage bloqueado: la app funciona solo en memoria.
  }

  const valido =
    g && [g.pisos, g.habitaciones, g.dispositivos].every(Array.isArray) && g.pisos.length;

  pausado = true; // restaurar = muchas escrituras; se notifica una sola vez al final
  try {
    if (valido) {
      Estado.version = 3;
      Estado.onboardingCompletado = Boolean(g.onboardingCompletado);
      Estado.perfil = normalizarPerfil(g.perfil);
      Estado.habitantes = entero(g.habitantes, 1, 50);
      Estado.reciboM3 = Math.max(0, Math.min(Number(g.reciboM3) || 0, 999));
      Estado.capacidad = [450, 750, 1100, 2500].includes(g.capacidad)
        ? g.capacidad
        : capacidadParaHabitantes(Estado.habitantes);
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
      // Un v3 anterior guardaba modo manual/auto y el encendido: se traducen.
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
      Estado.diasMes = Number(g.diasMes) || CONFIG.diasMes;
      CONFIG.diasMes = Estado.diasMes;

      g.pisos.forEach(([k, v]) => Estado.pisos.set(k, v));
      Estado.pisoActivo = Estado.pisos.has(g.pisoActivo)
        ? g.pisoActivo
        : Estado.pisos.keys().next().value;
      const vistos = new Set();
      g.habitaciones.forEach(([k, v]) => {
        if (!Estado.pisos.has(v.piso)) {
          return;
        }
        // Retrocompatibilidad: estados viejos no tienen cx/cy -> asignar primer hueco libre.
        if (typeof v.cx !== 'number' || typeof v.cy !== 'number') {
          const libre = primerHuecoLibre(v.piso, v.cs || 1, v.rs || 1);
          v.cx = libre.cx;
          v.cy = libre.cy;
        }
        // Migración en el borde: los estados viejos solo traían el nombre.
        // Desde aquí el tipo y el rol son dato, no texto deducido en cada cálculo.
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
      // Un dispositivo borrado invalida su fuga: se descarta al cargar.
      Estado.simFugasActivas = Estado.simFugasActivas.filter((id) => Estado.dispositivos.has(id));
      // Los usos ya no se editan por dispositivo: se sincronizan con el nivel.
      recalcularUsosPorNivel();
    } else {
      // Estado limpio para el onboarding.
      Estado.onboardingCompletado = false;
      Estado.perfil = 'bajo';
      Estado.reciboM3 = 0;
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
      Estado.diasMes = CONFIG.diasMes;
    }
  } finally {
    pausado = false;
  }

  $('capacidad').value = Estado.capacidad;
  $('habitantes').value = Estado.habitantes;
  $('recibo-simas').value = Estado.reciboM3 > 0 ? Estado.reciboM3 : '';
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
const limiteOMS = () => Estado.habitantes * CONFIG.litrosOMS;

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

// Calcula el uso estimado de un dispositivo nuevo a partir del tamaño de la vivienda.
// Así el usuario solo coloca el dispositivo y no escribe minutos, cargas ni descargas.
/* ---------- Tipo y rol de habitación ---------- */
// El tipo es dato, no texto: antes baseUso() adivinaba el contexto leyendo el
// nombre con regex, así que renombrar "Baño 2" movía litros sin avisar.
const TIPOS_SALA = [
  { id: 'recamara', nombre: 'Recámara', icono: '🛏', genero: 'f' },
  { id: 'bano', nombre: 'Baño', icono: '🚿', genero: 'm' },
  { id: 'cocina', nombre: 'Cocina', icono: '🍳', genero: 'f' },
  { id: 'sala', nombre: 'Sala', icono: '🛋', genero: 'f' },
  { id: 'comedor', nombre: 'Comedor', icono: '🍽', genero: 'm' },
  { id: 'lavanderia', nombre: 'Lavandería', icono: '🧺', genero: 'f' },
  { id: 'patio', nombre: 'Patio', icono: '🌿', genero: 'm' },
  { id: 'estudio', nombre: 'Estudio', icono: '💻', genero: 'm' },
];

const ROLES_SALA = ['principal', 'secundario', 'medio'];

const tipoSala = (id) => TIPOS_SALA.find((t) => t.id === id) || TIPOS_SALA[0];

const esTipoSala = (id) => TIPOS_SALA.some((t) => t.id === id);

// "Recámara secundaria" / "Baño principal": el adjetivo concuerda con el tipo.
function etiquetaRol(tipoId, rol) {
  const t = tipoSala(tipoId);
  if (rol === 'medio') {
    return 'Medio baño';
  }
  if (rol === 'secundario') {
    return t.genero === 'f' ? 'Secundaria' : 'Secundario';
  }
  return 'Principal';
}

// Solo para estados sin tipo: la heurística vive en el borde, nunca en el cálculo.
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

function baseUso(tipo, salaId = null) {
  const c = CATALOGO[tipo];
  if (!c) {
    return { clave: null, uso: 0 };
  }
  if (c.fijo) {
    // Caudal continuo (fugas): no es demanda repartible entre aparatos.
    return { clave: null, uso: c.sugerido };
  }

  const tabla = PROMEDIOS[normalizarPerfil(Estado.perfil)] || PROMEDIOS.bajo;
  const hab = salaId ? Estado.habitaciones.get(salaId) : null;
  const tipoHab = hab && esTipoSala(hab.tipo) ? hab.tipo : 'recamara';
  const rol = hab && ROLES_SALA.includes(hab.rol) ? hab.rol : 'principal';

  // El aire lavado es carga puntual: cada aparato enciende su propio horario, así
  // que no comparte cuota con los demás. El rol del espacio sí lo dimensiona.
  if (tipo === 'aire') {
    return {
      clave: null,
      uso: rol === 'secundario' ? (tabla.aireSecundario ?? 6) : tabla.aire,
    };
  }

  const esCocina = tipo === 'lavabo' && tipoHab === 'cocina';
  const esMedio = rol === 'medio';
  const esSecundario = rol === 'secundario';
  let clave = tipo;
  let uso;

  if (esCocina) {
    clave = 'lavaboCocina';
    uso = tabla.lavaboCocina ?? tabla.lavabo;
  } else if (tipo === 'inodoro' && esMedio) {
    clave = 'inodoroMedio';
    uso = tabla.inodoroMedio ?? tabla.inodoro;
  } else if (tipo === 'lavabo' && esMedio) {
    clave = 'lavaboMedio';
    uso = tabla.lavaboMedio ?? tabla.lavabo;
  } else if (tipo === 'ducha' && esSecundario) {
    clave = 'duchaSecundaria';
    uso = tabla.duchaSecundaria ?? tabla.ducha;
  } else if (tipo === 'inodoro' && esSecundario) {
    clave = 'inodoroSecundario';
    uso = tabla.inodoroSecundario ?? tabla.inodoro;
  } else if (tipo === 'lavabo' && esSecundario) {
    clave = 'lavaboSecundario';
    uso = tabla.lavaboSecundario ?? tabla.lavabo;
  } else {
    uso = tabla[tipo] ?? c.sugerido;
  }

  if (c.porHabitante && !esCocina) {
    uso *= Math.max(1, Estado.habitantes);
  }
  if (tipo === 'lavadora' || tipo === 'lavavajillas') {
    uso = (uso * Math.max(1, Estado.habitantes)) / 4;
  }

  return { clave, uso: limitar(Math.round(uso), 0, 999) };
}

// Uso estimado de un aparato nuevo a partir del tamaño de la vivienda.
// Es el total de su clase de uso; recalcularUsosPorNivel() lo reparte después
// entre todos los aparatos de esa clase.
function usoPromedio(tipo, salaId = null) {
  return baseUso(tipo, salaId).uso;
}

// El uso y la frecuencia dejan de ser datos del usuario: siempre salen del catálogo
// y del promedio del nivel. Se aplica al cargar, al cambiar habitantes y al mover.
function aplicarPromedioDispositivo(d, uso = null) {
  const c = CATALOGO[d.tipo];
  if (!c) {
    return;
  }
  d.uso_personalizado = uso === null ? usoPromedio(d.tipo, d.sala) : uso;
  d.frecuencia = c.frecuenciaInicial || 'dia';
}

function recalcularUsosPorNivel() {
  // La demanda la genera la casa, no cada aparato: los que comparten clase de uso
  // se reparten el promedio (16 descargas no se duplican por tener dos baños).
  // Se reparte con resto entero para que la suma de la clase cuadre exacta.
  const grupos = new Map();
  Estado.dispositivos.forEach((d) => {
    const { clave, uso } = baseUso(d.tipo, d.sala);
    if (!clave) {
      aplicarPromedioDispositivo(d, uso);
      return;
    }
    if (!grupos.has(clave)) {
      grupos.set(clave, []);
    }
    grupos.get(clave).push({ d, uso });
  });
  grupos.forEach((lista) => {
    const total = lista[0].uso;
    const base = Math.floor(total / lista.length);
    const resto = total - base * lista.length;
    lista.forEach((item, i) => aplicarPromedioDispositivo(item.d, base + (i < resto ? 1 : 0)));
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

// Agrupa el consumo diario por habitación y separa fugas (flujo fijo 24 h)
// del consumo humano (curva horaria). Es la única fuente para el dashboard y los sensores.
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

/* ---------- Fugas de la simulación (no tocan el plano estático) ---------- */

// Caudal parásito del caso activo, en L/día. Cero si el dispositivo no está marcado.
// Es independiente a propósito de resumenFugas(): "Mi casa" mide la casa real y el
// simulador superpone un caso hipotético que no debe alterar la comparación con el recibo.
function fugaSimDe(d, id) {
  if (!Sim.fugasActivo || !Sim.fugasActivas.includes(id)) {
    return 0;
  }
  return TASAS_FUGA[d.tipo] || 0;
}

function fugasSimPorSala() {
  const porSala = {};
  let total = 0;
  Estado.dispositivos.forEach((d, id) => {
    const litros = fugaSimDe(d, id);
    if (litros > 0) {
      porSala[d.sala] = (porSala[d.sala] || 0) + litros;
      total += litros;
    }
  });
  return { porSala, total };
}

// El caso es un código interno de cuatro dígitos y determinista:
//   · último dígito 8 o 9 -> dos fugas (~20 %); cualquier otro -> una (~80 %).
//   · el resto de los dígitos indexa la lista de dispositivos con tasa de fuga.
// Así el mismo código repite el mismo caso y se puede anticipar sin ejecutarlo.
function normalizarCasoFuga(codigo) {
  const n = parseInt(String(codigo).replace(/\D/g, ''), 10);
  if (!Number.isFinite(n) || n < 1000) {
    return 4821;
  }
  return Math.min(n, 9999);
}

function generarCasoFuga(codigo) {
  const base = normalizarCasoFuga(codigo);
  const elegibles = [...Estado.dispositivos.entries()]
    .filter(([, d]) => TASAS_FUGA[d.tipo] > 0)
    .map(([id]) => id);
  if (!elegibles.length) {
    return { codigo: base, ids: [] };
  }
  const indice = Math.floor(base / 10) % elegibles.length;
  const ids = [elegibles[indice]];
  if (base % 10 >= 8 && elegibles.length > 1) {
    ids.push(elegibles[(indice + 1) % elegibles.length]);
  }
  return { codigo: base, ids };
}

// Capacidad de tinaco sugerida según habitantes (valores admitidos por el selector).
function capacidadParaHabitantes(n) {
  if (n <= 2) {
    return 450;
  }
  if (n <= 4) {
    return 750;
  }
  if (n <= 6) {
    return 1100;
  }
  return 2500;
}

// Equivalencia física del ahorro: cuántos tinacos completos representa.
// Evita expresar el impacto en dinero y lo ancla al almacenamiento de la casa.
function tinacosDe(litros) {
  const n = litros / Math.max(1, Estado.capacidad);
  if (n < 0.1) {
    return 'menos de 0.1 tinacos llenos';
  }
  const txt = n >= 10 ? String(Math.round(n)) : n.toFixed(1);
  return txt + (txt === '1' ? ' tinaco lleno' : ' tinacos llenos');
}

// Compara el consumo mensual del plano contra el recibo mensual real.
function calcularValidacionSimas(litrosDia) {
  const m3Simulado = (litrosDia * Estado.diasMes) / 1000,
    m3Real = Estado.reciboM3;
  if (!m3Real || m3Real <= 0) {
    return {
      activo: false,
      m3Simulado,
      m3Real: 0,
      errorPct: 0,
      exactitudPct: 0,
      difM3: 0,
      coberturaPct: 0,
      faltanteM3: 0,
      faltanteLdia: 0,
      metaM3: 0,
    };
  }
  const difM3 = m3Simulado - m3Real,
    errorPct = (Math.abs(difM3) / m3Real) * 100,
    exactitudPct = Math.max(0, 100 - errorPct),
    coberturaPct = (m3Simulado / m3Real) * 100,
    faltanteM3 = m3Real - m3Simulado;
  return {
    activo: true,
    m3Simulado,
    m3Real,
    errorPct,
    exactitudPct,
    difM3,
    coberturaPct,
    faltanteM3,
    faltanteLdia: (faltanteM3 * 1000) / Math.max(1, Estado.diasMes),
    metaM3: m3Real * 0.9,
  };
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

/* ---------- Dashboard ---------- */
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
  // Respaldo: si rAF se detiene (pestaña oculta, navegador sin animaciones), fija el valor final.
  el._to = setTimeout(() => {
    cancelAnimationFrame(el._raf);
    el._v = fin;
    el.textContent = fmt(fin);
  }, 700);
}

// Barra prominente: consumo virtual del plano vs recibo mensual real.
function renderComparativa(litrosDia) {
  const val = calcularValidacionSimas(litrosDia);
  const titulo = $('comparativa-titulo');
  const virtual = $('comparativa-virtual');
  const real = $('comparativa-real');
  const msg = $('comparativa-msg');
  const barra = $('comparativa-barra');
  const fill = $('comparativa-fill');
  const bloque = $('comparativa-recibo');
  if (!titulo || !virtual || !real || !msg || !barra || !fill || !bloque) {
    return;
  }

  virtual.textContent = val.m3Simulado.toFixed(1);
  real.textContent = val.activo ? val.m3Real.toFixed(1) : '—';

  if (!val.activo) {
    bloque.dataset.estado = 'sin-recibo';
    titulo.textContent = 'Sin recibo registrado';
    msg.textContent =
      'Agrega tu recibo mensual en el resumen de tu casa para comparar el plano contra la realidad.';
    fill.style.width = '0%';
    barra.setAttribute('aria-valuenow', '0');
    barra.setAttribute('aria-valuetext', 'Sin recibo');
    return;
  }

  const cobertura = Math.max(0, val.coberturaPct);
  const pctBarra = Math.min(cobertura, 100);
  fill.style.width = pctBarra + '%';
  barra.setAttribute('aria-valuenow', String(Math.round(pctBarra)));
  barra.setAttribute('aria-valuetext', Math.round(cobertura) + ' % del recibo explicado');

  if (litrosDia <= 0) {
    bloque.dataset.estado = 'vacio';
    titulo.textContent = 'Tu plano está vacío';
    msg.textContent = 'Arrastra dispositivos a las habitaciones para empezar a investigar.';
  } else if (cobertura < 85) {
    bloque.dataset.estado = 'bajo';
    titulo.textContent = 'Tu plano explica el ' + Math.round(cobertura) + ' % de tu recibo';
    msg.textContent =
      'Faltan ' +
      Math.abs(val.faltanteM3).toFixed(1) +
      ' m³/mes (' +
      Math.round(Math.abs(val.faltanteLdia)) +
      ' L/día). Revisa fugas, riego, visitas o usos que no modelaste. No se trata de añadir consumo, sino de encontrarlo.';
  } else if (cobertura <= 115) {
    bloque.dataset.estado = 'ok';
    titulo.textContent = 'Tu plano coincide con tu recibo';
    msg.textContent =
      'La estimación virtual está dentro del ±15 % del recibo real. Buen punto de partida para investigar.';
  } else {
    bloque.dataset.estado = 'alto';
    titulo.textContent = 'Tu plano estima más que tu recibo';
    msg.textContent =
      'Tu plano estima un ' +
      Math.round(cobertura - 100) +
      ' % adicional. Revisa tiempos, frecuencias o dispositivos duplicados.';
  }
}

/* Resumen: el recibo se explica con una sola cifra y un estado claro. */
function renderResumenRecibo(litrosDia) {
  const val = calcularValidacionSimas(litrosDia);
  const vs = $('m-vs-recibo');
  const detalle = $('m-vs-recibo-detalle');
  const recibo = $('m-recibo-real');
  const dif = $('m-recibo-dif');

  if (vs && detalle) {
    delete vs.dataset.tono;
    if (!val.activo) {
      vs.textContent = '—';
      detalle.textContent = 'Agrega tu recibo mensual';
    } else if (litrosDia <= 0) {
      vs.textContent = '—';
      detalle.textContent = 'Tu plano aún está vacío';
    } else {
      const delta = val.difM3;
      const diferencia = Math.abs(delta / Math.max(0.1, val.m3Real));
      vs.textContent = (delta > 0 ? '+' : '') + delta.toFixed(1) + ' m³';
      vs.dataset.tono = diferencia <= 0.15 ? 'ok' : delta > 0 ? 'alto' : 'bajo';
      detalle.textContent =
        val.m3Simulado.toFixed(1) + ' m³ estimados vs ' + val.m3Real.toFixed(1) + ' m³ reales';
    }
  }

  if (recibo) {
    recibo.textContent = val.activo ? val.m3Real.toFixed(1) + ' m³' : '—';
  }

  const noExplicada = $('m-no-explicada');
  if (noExplicada) {
    if (!val.activo || litrosDia <= 0) {
      noExplicada.textContent = '—';
    } else {
      const l = Math.round(val.faltanteLdia);
      noExplicada.textContent =
        (l < 0 ? '−' : '') + NUM_ES.format(Math.abs(Math.round(l))) + ' L/día';
    }
  }

  if (dif) {
    delete dif.dataset.tono;
    if (!val.activo || litrosDia <= 0) {
      dif.textContent = '—';
    } else {
      const delta = val.difM3;
      dif.textContent = (delta > 0 ? '+' : '') + delta.toFixed(1) + ' m³';
      dif.dataset.tono =
        Math.abs(delta / Math.max(0.1, val.m3Real)) <= 0.15 ? 'ok' : delta > 0 ? 'alto' : 'bajo';
    }
  }
}

/* Comparativa social: una barra y una frase, sin tres bloques de texto. */
function renderSocial(L) {
  const fill = $('norm-fill');
  const valor = $('norm-valor');
  const estado = $('norm-estado');
  if (!fill || !valor || !estado) {
    return;
  }

  const lHab = L / Estado.habitantes;
  const pctNorm = Math.min((lHab / 220) * 100, 100);
  valor.textContent = NUM_ES.format(Math.round(lHab)) + ' L/hab/día';
  fill.style.width = pctNorm + '%';
  fill.className =
    'normativa__fill' + (lHab > CONFIG.refAlto ? ' rojo' : lHab > CONFIG.litrosOMS ? ' ambar' : '');

  if (L === 0) {
    estado.textContent = 'Referencias: eficiente 80 L · OMS 100 L · alto 180 L por persona al día.';
  } else if (lHab <= CONFIG.refEficiente) {
    estado.textContent = 'Estás en el nivel de un vecino eficiente de Torreón (≤ 80 L/hab/día).';
  } else if (lHab <= CONFIG.litrosOMS) {
    estado.textContent =
      'Cerca de la referencia OMS. Te faltan ' +
      Math.round(lHab - CONFIG.refEficiente) +
      ' L/hab/día para igualar al vecino eficiente.';
  } else if (lHab <= CONFIG.refAlto) {
    estado.textContent =
      'Superas la referencia OMS por ' +
      Math.round(lHab - CONFIG.litrosOMS) +
      ' L/hab/día, pero sigues debajo del promedio alto (180 L).';
  } else {
    estado.textContent =
      'Superas el promedio residencial alto por ' +
      Math.round(lHab - CONFIG.refAlto) +
      ' L/hab/día.';
  }
}

/* Una sola alerta contextual; la recomendación larga queda plegada. */
function renderAlerta(L, desborde, fugas, pct) {
  const alertaEl = $('alerta');
  if (!alertaEl) {
    return;
  }

  let nivel = '';
  let titulo;
  const lineas = [];

  if (L === 0) {
    titulo = 'Tu plano está vacío';
    lineas.push('Añade dispositivos a las habitaciones para empezar a medir.');
  } else if (desborde) {
    nivel = 'critica';
    titulo = 'Almacenamiento agotado';
    lineas.push(
      'El consumo diario supera la capacidad del tinaco. Revisa los usos más altos o cambia el almacenamiento.'
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
  } else if (L > limiteOMS()) {
    nivel = 'riesgo';
    titulo = 'Sobre la referencia OMS';
    lineas.push(
      'El consumo supera los ' +
        limiteOMS() +
        ' L/día de referencia para ' +
        Estado.habitantes +
        ' persona(s).'
    );
  } else if (pct >= 80) {
    nivel = 'riesgo';
    titulo = 'Margen ajustado';
    lineas.push('Queda poca reserva en el tinaco para el consumo estimado.');
  } else {
    titulo = 'Consumo dentro de los límites';
    lineas.push('Queda reserva suficiente y el consumo está bajo la referencia OMS.');
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

/* Lista breve de las habitaciones que más consumen, dentro del panel Consumo. */
function renderTopSalas(porSala) {
  const cont = $('diag-top-salas');
  if (!cont) {
    return;
  }

  cont.innerHTML = '';
  // Mismo orden que la dona (mayor a menor): así el punto de color de cada fila
  // coincide con su segmento y la dona puede prescindir de su leyenda.
  const filas = Object.entries(porSala)
    .filter(([, litros]) => litros > 0)
    .sort((a, b) => b[1] - a[1]);

  if (!filas.length) {
    const vacio = document.createElement('p');
    vacio.className = 'pista';
    vacio.textContent = 'Aún no hay consumo registrado en el plano.';
    cont.appendChild(vacio);
    return;
  }

  const maximo = filas[0][1] || 1;
  filas.forEach(([id, litros], i) => {
    const hab = Estado.habitaciones.get(id);
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
    texto.textContent = hab ? hab.nombre : 'Habitación';
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
    cap = Estado.capacidad,
    lim = limiteOMS();
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
  setCifra('m-oms', lim, (n) => litrosTexto(n));
  setCifra('m-uso-oms', (L / lim) * 100, (n) => Math.round(n) + ' %');
  setCifra('m-litros-mes', L * CONFIG.diasMes, (n) => {
    const litrosMes = Math.round(n),
      m3Mes = (litrosMes / 1000).toFixed(1);
    return NUM_ES.format(Math.round(litrosMes)) + ' L (' + m3Mes + ' m³)';
  });

  // Segunda línea del KPI principal: el recibo se captura por mes, así que se
  // ofrece el equivalente mensual sin obligar a hacer la cuenta.
  const mesCorta = $('m-litros-mes-corta');
  if (mesCorta) {
    mesCorta.textContent =
      L > 0
        ? '≈ ' + ((L * CONFIG.diasMes) / 1000).toFixed(1) + ' m³ al mes'
        : 'aún sin dispositivos';
  }

  const fugasDetalle = $('m-fugas-detalle');
  const hayAlertaFuga =
    fugas.cantidad > 0 || Boolean(Sim.fugasReveladas && Sim.fugasActivas.length);
  if (fugasDetalle) {
    // El plano sigue siendo la casa real; si la simulación reveló un caso,
    // se nombra aparte para que el 0 L/día no contradiga el brillo del aparato.
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

  // El color del punto es el único indicador de alarma que queda en la franja.
  const chipFugas = $('kpi-fugas');
  if (chipFugas) {
    if (hayAlertaFuga) {
      chipFugas.dataset.tono = 'alerta';
    } else {
      delete chipFugas.dataset.tono;
    }
  }

  renderComparativa(L);
  renderResumenRecibo(L);
  renderSocial(L);
  renderAlerta(L, desborde, fugas, pct);

  // Litros por habitación (rótulo + mapa de calor) y por piso (pestaña)
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

  renderTopSalas(porSala);

  if (editandoId) {
    actualizarCalculoEditor();
  }
  actualizarGrafico(porSala);
  simRender(); // el caudal y los tiempos dependen de los dispositivos
  renderSensores(); // fuerza la lectura al cambiar el plano, aunque el simulador esté pausado
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
  // Orden descendente: la lista de habitaciones repite este orden y asigna
  // el color por índice, así que los puntos coinciden con los segmentos.
  const ids = Object.keys(porSala)
      .filter((id) => porSala[id] > 0)
      .sort((a, b) => porSala[b] - porSala[a]),
    vacio = ids.length === 0;
  $('grafico-vacio').hidden = !vacio;
  $('grafico-consumo').style.visibility = vacio ? 'hidden' : 'visible';

  // Si el constructor está oculto el canvas mide 0: se crea/actualiza al mostrarlo.
  if (!$('grafico-consumo').clientWidth) {
    return;
  }

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
          // Sin leyenda: la lista de habitaciones de al lado ya nombra cada color.
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
    lim = limiteOMS(),
    lHab = (L / Estado.habitantes).toFixed(1),
    fugas = resumenFugas(),
    fugasSim = fugasSimPorSala(),
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
  linea(
    'Referencia OMS: ' +
      lim +
      ' L/día (' +
      Math.round((L / lim) * 100) +
      ' % de la referencia) | Torreón: eficiente 80 L/hab, OMS 100 L/hab, alto 180 L/hab'
  );
  y += 4;

  linea('Comparación contra el recibo mensual', 13, true);
  if (val.activo) {
    linea(
      'Volumen mensual simulado: ' +
        val.m3Simulado.toFixed(2) +
        ' m³/mes | Recibo mensual real: ' +
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
        ' m³/mes (No se ingresó el recibo mensual para contraste).'
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

  if (L > lim || fugas.cantidad || fugasSim.total > 0) {
    y += 4;
    linea('ADVERTENCIA AMBIENTAL (COMARCA LAGUNERA)', 13, true);
    linea(
      (L > lim ? 'El consumo supera la referencia de la OMS (' + lim + ' L/día). ' : '') +
        (fugas.cantidad || fugasSim.total
          ? 'Hay fugas activas que desperdician ' + (fugas.litros + fugasSim.total) + ' L/día. '
          : '') +
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
    t.setAttribute('aria-selected', Estado.pisoActivo === p.id ? 'true' : 'false');
    t.tabIndex = 0;
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
  // hidden (no remove): conserva clones y el width/height que dejó el resize nativo
  document
    .querySelectorAll('.sala')
    .forEach((s) => (s.hidden = Estado.habitaciones.get(s.dataset.sala).piso !== id));
  renderizarGuiaGrid(false);
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
  recalcularUsosPorNivel();
  renderizarGuiaGrid(false);
}

/* ---------- Modal UI (Promise: modalPrompt / modalConfirm) ---------- */
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

  // Restaurar estado por defecto (el listener de Ayuda lo modifica)
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

const modalPrompt = (titulo, inicial = '') => abrirModal({ titulo, inicial, confirmar: false });

const modalConfirm = (mensaje, titulo = 'Confirmar acción') =>
  abrirModal({ titulo, mensaje, confirmar: true });

/* ---------- Diálogo de habitación (tipo + rol) ---------- */
// El tipo es la decisión de fondo; el nombre queda como etiqueta libre.
let resolverSala = null;
let salaTipo = 'recamara';
let salaRol = 'principal';
let salaEditando = null;

const deLaSala = (t) => (t.genero === 'f' ? 'de la ' : 'del ') + t.nombre.toLowerCase();

// Nombre por defecto con el primer número libre: "Baño", "Baño 2", "Baño 3"…
function nombreSugeridoSala(tipoId, exceptoId = null) {
  const base = tipoSala(tipoId).nombre;
  const usados = new Set();
  Estado.habitaciones.forEach((h) => {
    if (h.id !== exceptoId && h.tipo === tipoId) {
      usados.add(h.nombre);
    }
  });
  if (!usados.has(base)) {
    return base;
  }
  let n = 2;
  while (usados.has(base + ' ' + n)) {
    n += 1;
  }
  return base + ' ' + n;
}

function pintarTiposSala() {
  const cont = $('sala-tipos');
  if (!cont) {
    return;
  }
  cont.innerHTML = TIPOS_SALA.map(
    (t) =>
      '<label class="sala-tipo">' +
      '<input type="radio" name="sala-tipo-sel" value="' +
      t.id +
      '"' +
      (t.id === salaTipo ? ' checked' : '') +
      ' />' +
      '<span class="sala-tipo__cara"><span class="sala-tipo__icono" aria-hidden="true">' +
      t.icono +
      '</span>' +
      t.nombre +
      '</span></label>'
  ).join('');
}

function pintarRolesSala() {
  const cont = $('sala-roles-opciones');
  const leyenda = $('sala-roles-leyenda');
  if (!cont) {
    return;
  }
  const roles =
    salaTipo === 'bano' ? ['principal', 'secundario', 'medio'] : ['principal', 'secundario'];
  if (!roles.includes(salaRol)) {
    salaRol = 'principal';
  }
  if (leyenda) {
    leyenda.textContent = 'Rol ' + deLaSala(tipoSala(salaTipo));
  }
  cont.innerHTML = roles
    .map(
      (r) =>
        '<label class="sala-tipo">' +
        '<input type="radio" name="sala-rol-sel" value="' +
        r +
        '"' +
        (r === salaRol ? ' checked' : '') +
        ' />' +
        '<span class="sala-tipo__cara">' +
        etiquetaRol(salaTipo, r) +
        '</span></label>'
    )
    .join('');
}

// Si el nombre sigue siendo el sugerido, acompaña al tipo; si el usuario escribió
// uno propio, se respeta.
function sincronizarNombreSala() {
  const campo = $('sala-nombre');
  if (!campo) {
    return;
  }
  if (!campo.value.trim() || campo.dataset.auto === '1') {
    campo.value = nombreSugeridoSala(salaTipo, salaEditando);
    campo.dataset.auto = '1';
  }
}

function cerrarModalSala(valor) {
  const modal = $('modal-sala');
  if (!resolverSala) {
    return;
  }
  const resolver = resolverSala;
  resolverSala = null;
  modal.hidden = true;
  resolver(valor);
}

function abrirModalSala(hab = null) {
  const modal = $('modal-sala');
  if (!modal) {
    return Promise.resolve(null);
  }
  if (resolverSala) {
    const previo = resolverSala;
    resolverSala = null;
    previo(null);
  }

  salaEditando = hab ? hab.id : null;
  salaTipo = hab && esTipoSala(hab.tipo) ? hab.tipo : 'recamara';
  salaRol = hab && ROLES_SALA.includes(hab.rol) ? hab.rol : 'principal';

  $('sala-titulo').textContent = hab ? 'Editar habitación' : 'Nueva habitación';
  $('sala-ok').textContent = hab ? 'Guardar' : 'Añadir';
  const piso = Estado.pisos.get(hab ? hab.piso : Estado.pisoActivo);
  $('sala-msg').textContent = hab
    ? 'Los dispositivos se quedan donde están.'
    : 'Se añadirá en ' + (piso ? piso.nombre : 'el piso activo') + '.';

  const campo = $('sala-nombre');
  campo.value = hab ? hab.nombre : nombreSugeridoSala(salaTipo);
  campo.dataset.auto = hab ? '0' : '1';
  campo.removeAttribute('aria-invalid');

  pintarTiposSala();
  pintarRolesSala();
  modal.hidden = false;
  queueMicrotask(() => {
    const elegido = modal.querySelector('input[name="sala-tipo-sel"]:checked');
    (elegido || campo).focus();
  });

  return new Promise((resolve) => {
    resolverSala = resolve;
  });
}

$('sala-form').addEventListener('submit', (e) => {
  e.preventDefault();
  const campo = $('sala-nombre');
  const nombre = campo.value.trim().slice(0, 28);
  if (!nombre) {
    campo.setAttribute('aria-invalid', 'true');
    campo.focus();
    return;
  }
  cerrarModalSala({ nombre, tipo: salaTipo, rol: salaRol });
});

$('sala-cancelar').addEventListener('click', () => cerrarModalSala(null));

$('sala-tipos').addEventListener('change', (e) => {
  if (e.target.name !== 'sala-tipo-sel') {
    return;
  }
  salaTipo = e.target.value;
  pintarRolesSala();
  sincronizarNombreSala();
});

$('sala-roles-opciones').addEventListener('change', (e) => {
  if (e.target.name === 'sala-rol-sel') {
    salaRol = e.target.value;
  }
});

$('sala-nombre').addEventListener('input', (e) => {
  e.target.dataset.auto = '0';
  e.target.removeAttribute('aria-invalid');
});

$('modal-sala').addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    e.preventDefault();
    cerrarModalSala(null);
    return;
  }
  if (e.key === 'Tab') {
    trapaFoco($('modal-sala'), e);
  }
});

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
      marcar(Estado.pisos.get(id).nombre) +
        ' tiene ' +
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
// Encuentra la primera celda libre (cx, cy, base 1) en el piso para una habitación de cs x rs celdas.
// Retorna null si no hay hueco en el área razonable.
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
  // Fallback: (1,1) aunque haya solapamiento; el usuario puede reubicar después
  return { cx: 1, cy: 1 };
}

// Verifica si las celdas (cx,cy) con tamaño (cs,rs) colisionan con otra habitación del mismo piso
function celdasOcupadas(piso, cx, cy, cs, rs, excluirId) {
  const m = medidasGrid();
  const colsMax = m.cols;
  const filasLimite = Math.min(MAX_FILAS, Math.max(FILAS_MIN, filasOcupadasPiso(piso) + 1));
  if (cx < 1 || cy < 1 || cx + cs - 1 > colsMax || cy + rs - 1 > filasLimite) {
    return true;
  }
  for (const [id, h] of Estado.habitaciones) {
    if (id === excluirId || h.piso !== piso) {
      continue;
    }
    if (cx < h.cx + h.cs && cx + cs > h.cx && cy < h.cy + h.rs && cy + rs > h.cy) {
      return true;
    }
  }
  return false;
}

function crearHabitacion(nombre, piso, opciones = {}) {
  const id = 'h' + Estado.siguienteSala++;
  // En móvil el plano puede tener una sola columna. Ajustar el tamaño lógico
  // evita que dos habitaciones con cs=2 caigan en la misma celda de respaldo.
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
  }); // cs/rs = columnas y filas que ocupa
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

// Construye el nodo .sala desde su registro (al crearla y al restaurar desde localStorage)
function montarHabitacion(hab) {
  const { id, piso } = hab;

  const el = document.createElement('div');
  el.className = 'sala';
  el.dataset.sala = id;
  el.hidden = piso !== Estado.pisoActivo;
  el.tabIndex = 0;
  el.innerHTML =
    '<span class="sala__mover" draggable="true" title="Arrastra para reordenar habitación" aria-label="Reordenar habitación" tabindex="0">⠿</span>' +
    '<span class="sala__rotulo" title="Doble clic para editar el tipo y el nombre"><em></em><b></b></span>' +
    '<button class="sala__x" type="button" title="Eliminar habitación" aria-label="Eliminar habitación">✕</button>' +
    '<span class="sala__asa" title="Arrastra para cambiar el tamaño" tabindex="0"></span>';
  pintarRotuloSala(el, hab);

  const btnMover = el.querySelector('.sala__mover');
  btnMover.addEventListener('dragstart', (e) => {
    e.stopPropagation();
    cerrarEditor();
    empezarArrastre(e, { salaOrigen: id });
    renderizarGuiaGrid(true); // mostrar 1 fila extra libre al arrastrar
    if (e.dataTransfer.setDragImage) {
      e.dataTransfer.setDragImage(el, 16, 16);
    }
    setTimeout(() => el.classList.add('arrastrando-sala'));
  });
  btnMover.addEventListener('dragend', () => {
    arrastre = null;
    removerFantasma();
    renderizarGuiaGrid(false); // encojer si la fila extra quedó vacía
    el.classList.remove('arrastrando-sala', 'sala-arrastrando');
    document
      .querySelectorAll('.sala.destino-sala')
      .forEach((s) => s.classList.remove('destino-sala'));
  });

  el.querySelector('.sala__x').addEventListener('click', () => eliminarHabitacion(id));
  el.querySelector('.sala__rotulo').addEventListener('dblclick', () => renombrarHabitacion(id));
  activarSala(el);
  activarRedimension(el, id);
  aplicarSpans(el, hab);
  // Navegación por teclado: Enter/Espacio en la sala coloca el dispositivo seleccionado
  el.addEventListener('keydown', (e) => {
    if ((e.key === 'Enter' || e.key === ' ') && seleccion) {
      e.preventDefault();
      cerrarEditor();
      agregarDispositivo(seleccion, el, 0.5, 0.5);
      seleccionarItem(null);
    }
  });
  $('plano').appendChild(el);
  return el;
}

async function renombrarHabitacion(id) {
  const hab = Estado.habitaciones.get(id);
  const datos = await abrirModalSala(hab);
  if (!datos) {
    return;
  }
  hab.nombre = datos.nombre;
  hab.tipo = datos.tipo;
  hab.rol = datos.rol;
  pintarRotuloSala(salaEl(id), hab);
  recalcularUsosPorNivel();
}

// Si se borra el último principal de un tipo, la primera secundaria asciende: un
// tipo sin principal dejaría la casa sin la referencia de consumo de ese uso.
function sucesorPrincipalSala(hab) {
  if (!hab || hab.rol !== 'principal') {
    return null;
  }
  const iguales = [...Estado.habitaciones.values()].filter(
    (h) => h.tipo === hab.tipo && h.id !== hab.id
  );
  if (iguales.some((h) => h.rol === 'principal')) {
    return null;
  }
  return iguales.find((h) => h.rol === 'secundario') || null;
}

async function eliminarHabitacion(id) {
  const n = dispositivosDe(id).length;
  const hab = Estado.habitaciones.get(id);
  if (!hab) {
    return;
  }
  const sucesor = sucesorPrincipalSala(hab);
  let mensaje = '';
  if (n) {
    mensaje +=
      marcar(hab.nombre) +
      ' tiene ' +
      n +
      ' dispositivo(s). Se eliminarán y dejarán de contar en el consumo. ';
  }
  if (sucesor) {
    mensaje +=
      'Es el último ' +
      tipoSala(hab.tipo).nombre.toLowerCase() +
      ' principal: ' +
      marcar(sucesor.nombre) +
      ' pasará a principal. ';
  }
  if (mensaje && !(await modalConfirm(mensaje + '¿Continuar?', 'Eliminar habitación'))) {
    return;
  }
  destruirHabitacion(id);
  if (sucesor) {
    sucesor.rol = 'principal';
    recalcularUsosPorNivel();
  }
}

/* ---------- Layout: redimensionado por celdas (Grid Spans) ---------- */
const limitar = (n, min, max) => Math.min(Math.max(n, min), max);
const MAX_FILAS = 8;
const FILAS_MIN = 2;

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

// Calcula cuál es la última fila realmente ocupada por las habitaciones del piso dado.
// base 1: si una habitación está en cy=3 con rs=2, ocupa filas 3 y 4.
function filasOcupadasPiso(pisoId) {
  const habs = [...Estado.habitaciones.values()].filter((h) => h.piso === pisoId);
  if (habs.length === 0) {
    return 0;
  }
  return Math.max(0, ...habs.map((h) => (h.cy || 1) + (h.rs || 1) - 1));
}

// Genera celdas guía (.celda-guia) para todo el área del grid de #plano,
// alineadas exactamente con las mismas pistas 1fr / gap / padding que .sala.
// expandir: cuando el usuario arrastra o redimensiona, muestra 1 fila extra libre al final.
function renderizarGuiaGrid(expandir = false) {
  const plano = $('plano');
  // Si el constructor está oculto no hay medidas fiables:
  // se recalcula automáticamente al entrar al modo avanzado.
  if (!plano || !plano.clientWidth) {
    return;
  }
  const m = medidasGrid();
  const ocupadas = filasOcupadasPiso(Estado.pisoActivo);
  const filas = Math.min(MAX_FILAS, Math.max(FILAS_MIN, ocupadas + (expandir ? 1 : 0)));
  // Remover solo las celdas guía existentes, sin tocar las .sala
  plano.querySelectorAll('.celda-guia').forEach((g) => g.remove());
  // Insertar las nuevas celdas guía al inicio, antes de las habitaciones
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

// Tamaño lógico (cs x rs celdas) y posición (cx, cy) -> variables CSS que consumen grid-column / grid-row
function aplicarSpans(sala, hab) {
  // Sin layout visible se escriben las variables tal cual y se
  // recalcula al mostrar el constructor.
  if (!$('plano') || !$('plano').clientWidth) {
    sala.style.setProperty('--cs', hab.cs || 1);
    sala.style.setProperty('--rs', hab.rs || 1);
    sala.style.setProperty('--cx', hab.cx || 1);
    sala.style.setProperty('--cy', hab.cy || 1);
    return;
  }
  const m = medidasGrid();
  const cs = Math.min(hab.cs, m.cols); // nunca más columnas de las que caben
  const filasLimite = Math.min(
    MAX_FILAS,
    Math.max(FILAS_MIN, filasOcupadasPiso(Estado.pisoActivo) + 1)
  );
  const cx = Math.max(1, Math.min(hab.cx || 1, m.cols - cs + 1)); // no desbordar columnas
  const cy = Math.max(1, Math.min(hab.cy || 1, filasLimite - hab.rs + 1));
  sala.style.setProperty('--cs', cs);
  sala.style.setProperty('--rs', hab.rs);
  sala.style.setProperty('--cx', cx);
  sala.style.setProperty('--cy', cy);
}

// Asa de la esquina: convierte píxeles arrastrados en nº de celdas ("pega" a la cuadrícula)
function activarRedimension(sala, id) {
  const asa = sala.querySelector('.sala__asa');
  asa.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    asa.setPointerCapture(e.pointerId);
    sala.classList.add('redimensionando');
    renderizarGuiaGrid(true); // mostrar 1 fila extra libre al redimensionar
    const hab = Estado.habitaciones.get(id);
    const mover = (ev) => {
      const m = medidasGrid(),
        caja = sala.getBoundingClientRect();
      hab.cs = limitar(
        Math.round((ev.clientX - caja.left + m.hueco) / (m.ancho + m.hueco)),
        1,
        m.cols
      );
      const filasLimite = Math.min(
        MAX_FILAS,
        Math.max(FILAS_MIN, filasOcupadasPiso(Estado.pisoActivo) + 1)
      );
      hab.rs = limitar(
        Math.round((ev.clientY - caja.top + m.hueco) / (m.alto + m.hueco)),
        1,
        filasLimite
      );
      aplicarSpans(sala, hab);
    };
    const soltar = () => {
      sala.classList.remove('redimensionando');
      renderizarGuiaGrid(false); // encojer si la fila extra quedó vacía
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

/* ---------- Drag & Drop ---------- */
let arrastre = null; // dragover no puede leer getData(): recordamos aquí el arrastre en curso
let fantasma = null; // elemento de previsualización al arrastrar una habitación

function empezarArrastre(e, datos) {
  arrastre = datos;
  e.dataTransfer.setData('text/plain', JSON.stringify(datos));
  e.dataTransfer.effectAllowed = datos.id || datos.salaOrigen ? 'move' : 'copy';
}

// Calcula la celda (cx, cy, base 1) bajo el cursor dentro de #plano
function celdaDesdePunto(x, y) {
  const plano = $('plano');
  const estilo = getComputedStyle(plano);
  const rect = plano.getBoundingClientRect();
  const m = medidasGrid();
  const padX = parseFloat(estilo.paddingLeft) || 0;
  const padY = parseFloat(estilo.paddingTop) || 0;
  const relX = Math.max(0, x - rect.left - plano.clientLeft - padX);
  const relY = Math.max(0, y - rect.top - plano.clientTop - padY);
  const cx = limitar(Math.floor(relX / (m.ancho + m.hueco)) + 1, 1, m.cols);
  const filasLimite = Math.min(
    MAX_FILAS,
    Math.max(FILAS_MIN, filasOcupadasPiso(Estado.pisoActivo) + 1)
  );
  const cy = limitar(Math.floor(relY / (m.alto + m.hueco)) + 1, 1, filasLimite);
  return { cx, cy };
}

// Muestra / oculta el fantasma de previsualización en la celda destino usando CSS Grid (misma pista que .sala)
function mostrarFantasma(cx, cy, cs, rs, ocupado) {
  const plano = $('plano');
  const m = medidasGrid();
  const csAjustado = Math.min(cs, m.cols - cx + 1); // no salirse del grid
  if (!fantasma) {
    fantasma = document.createElement('div');
    fantasma.className = 'sala-fantasma';
    plano.appendChild(fantasma);
  }
  fantasma.className = 'sala-fantasma' + (ocupado ? ' ocupada' : '');
  fantasma.style.setProperty('--cx', cx);
  fantasma.style.setProperty('--cy', cy);
  fantasma.style.setProperty('--cs', csAjustado);
  fantasma.style.setProperty('--rs', rs);
  fantasma.style.display = 'block';
}

function removerFantasma() {
  if (fantasma) {
    fantasma.remove();
    fantasma = null;
  }
}

// Intenta colocar la habitación arrastrada en (cx, cy). Si colisiona con otra, intercambia coordenadas si caben
// o reubica la colisionada en el primer hueco libre. Nunca deja dos habitaciones encimadas.
function colocarHabitacionEnCelda(salaId, cx, cy) {
  const hab = Estado.habitaciones.get(salaId);
  if (!hab) {
    renderizarGuiaGrid(false);
    return false;
  }
  const piso = hab.piso;
  const { cs, rs } = hab;

  if (!celdasOcupadas(piso, cx, cy, cs, rs, salaId)) {
    hab.cx = cx;
    hab.cy = cy;
    aplicarSpans(salaEl(salaId), hab);
    notificar();
    renderizarGuiaGrid(false);
    return true;
  }

  // Colisión: buscar otra habitación que ocupe esa celda e intentar intercambiar posiciones
  for (const [id, h] of Estado.habitaciones) {
    if (id === salaId || h.piso !== piso) {
      continue;
    }
    if (cx < h.cx + h.cs && cx + cs > h.cx && cy < h.cy + h.rs && cy + rs > h.cy) {
      // Intento 1: intercambiar coordenadas si la otra caben en la posición actual de salaId
      if (
        !celdasOcupadas(piso, hab.cx, hab.cy, h.cs, h.rs, id) &&
        celdasOcupadas(piso, hab.cx, hab.cy, h.cs, h.rs, salaId) === false
      ) {
        const cxViejo = h.cx;
        const cyViejo = h.cy;
        h.cx = hab.cx;
        h.cy = hab.cy;
        aplicarSpans(salaEl(id), h);
        hab.cx = cxViejo;
        hab.cy = cyViejo;
        aplicarSpans(salaEl(salaId), hab);
        notificar();
        renderizarGuiaGrid(false);
        return true;
      }
      // Intento 2: reubicar la colisionada en primer hueco libre y poner salaId en (cx, cy)
      const libre = primerHuecoLibre(piso, h.cs, h.rs);
      if (libre) {
        h.cx = libre.cx;
        h.cy = libre.cy;
        aplicarSpans(salaEl(id), h);
        hab.cx = cx;
        hab.cy = cy;
        aplicarSpans(salaEl(salaId), hab);
        notificar();
        renderizarGuiaGrid(false);
        return true;
      }
      break;
    }
  }

  // Si todo falla, intentar primer hueco libre para salaId
  const libre = primerHuecoLibre(piso, cs, rs);
  if (libre) {
    hab.cx = libre.cx;
    hab.cy = libre.cy;
    aplicarSpans(salaEl(salaId), hab);
    notificar();
    renderizarGuiaGrid(false);
    return true;
  }
  renderizarGuiaGrid(false);
  return false; // no hay sitio: se queda donde está
}

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
      el.draggable = true;
      el.tabIndex = 0;
      el.dataset.tipo = tipo;
      // La medida no cabe en el chip; queda en el tooltip y en el texto oculto.
      el.title = c.nombre + ' · ' + c.flujo + ' ' + c.medida + (c.fijo ? ' · fijo' : '');
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
      el.addEventListener('dragstart', (e) => {
        cerrarEditor();
        empezarArrastre(e, { tipo });
      });
      el.addEventListener('dragend', () => (arrastre = null));
      el.addEventListener('click', () => seleccionarItem(seleccion === tipo ? null : tipo)); // flujo táctil
      el.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          seleccionarItem(seleccion === tipo ? null : tipo);
        }
      });
      items.appendChild(el);
    });

    seccion.appendChild(items);
    contenedor.appendChild(seccion);
  });
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
  // El dispositivo se coloca y se muestra en el plano; la ficha se abre solo al tocarlo.
  cerrarEditor();
  e.stopPropagation();
  agregarDispositivo(seleccion, sala, 0.5, 0.5); // 0.5/0.5 = centro de la habitación
  seleccionarItem(null);
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
  const x = e.clientX - caja.left - sala.clientLeft - CONFIG.tamClon / 2;
  const y = e.clientY - caja.top - sala.clientTop - CONFIG.tamClon / 2;
  const libre = (n, total) => limitar(n / Math.max(total - CONFIG.tamClon, 1), 0, 1); // fracción del espacio libre
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
    // No reordenar por DOM: dejar que el evento llegue al drop de #plano para reposicionar por cx/cy
    sala.classList.remove('sobre', 'destino-sala');
    return;
  }

  const { x, y } = coordenadasEnSala(e, sala);
  cerrarEditor();

  if (datos.id) {
    moverDispositivo(datos.id, sala, x, y);
  } else {
    agregarDispositivo(datos.tipo, sala, x, y);
  }
}

/* ---------- Arrastre libre de habitaciones sobre #plano (celdas vacías) ---------- */
$('plano').addEventListener('dragenter', (e) => {
  if (!arrastre || !arrastre.salaOrigen) {
    return;
  }
  e.preventDefault();
});

$('plano').addEventListener('dragover', (e) => {
  if (!arrastre || !arrastre.salaOrigen) {
    return;
  }
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
  const hab = Estado.habitaciones.get(arrastre.salaOrigen);
  if (!hab) {
    return;
  }
  const { cx, cy } = celdaDesdePunto(e.clientX, e.clientY);
  const ocupado = celdasOcupadas(Estado.pisoActivo, cx, cy, hab.cs, hab.rs, arrastre.salaOrigen);
  mostrarFantasma(cx, cy, hab.cs, hab.rs, ocupado);
});

$('plano').addEventListener('dragleave', (e) => {
  // Solo ocultar el fantasma si el cursor sale del plano y no entra a una sala hija
  if (!arrastre || !arrastre.salaOrigen) {
    return;
  }
  if (e.relatedTarget && $('plano').contains(e.relatedTarget)) {
    return;
  }
  removerFantasma();
});

$('plano').addEventListener('drop', (e) => {
  if (!arrastre || !arrastre.salaOrigen) {
    return;
  }
  e.preventDefault();
  removerFantasma();
  const { cx, cy } = celdaDesdePunto(e.clientX, e.clientY);
  colocarHabitacionEnCelda(arrastre.salaOrigen, cx, cy);
  arrastre = null;
  document.body.classList.remove('arrastrando-disp');
});

/* ---------- Clones ---------- */
// Se guarda la fracción del ESPACIO LIBRE (sala menos ícono) y CSS la resuelve con calc():
// al estirar o encoger la sala con resize, el clon se reubica solo y nunca se sale de la caja.
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
    (c.fijo ? ' (gasto fijo)' : ' · clic para ver detalle · doble clic para quitar');
}

function crearClon(id, tipo) {
  const el = document.createElement('div');
  el.className = 'clon';
  el.id = id;
  el.draggable = true;
  el.tabIndex = 0;
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
  el.addEventListener('dblclick', async () => {
    const confirmado = await modalConfirm(
      '¿Eliminar este dispositivo? Dejará de contar en el consumo.',
      'Eliminar dispositivo'
    );
    if (confirmado) {
      eliminarDispositivo(id);
    }
  });
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
  recalcularUsosPorNivel(); // el aparato nuevo entra al reparto de su clase
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
  if (Sim.fugasReveladas && Sim.fugasActivas.includes(id)) {
    el.classList.add('clon--fuga');
  }
  sala.appendChild(el);
  posicionar(el, d.fx, d.fy);
}

function moverDispositivo(id, sala, fx, fy) {
  const d = Estado.dispositivos.get(id);
  if (!d) {
    return;
  }
  d.sala = sala.dataset.sala;
  // Mover puede cambiar la clase de uso (un lavabo de la cocina a un baño), así
  // que se reparte de nuevo la clase de origen y la de destino. Calcular solo
  // este aparato le devolvería el total de la clase y lo dejaría como si fuese
  // el único, deshaciendo el reparto del cuarto al que llega.
  recalcularUsosPorNivel();
  d.fx = fx;
  d.fy = fy; // el Proxy detecta el cambio: repinta y guarda
  const el = $(id);
  sala.appendChild(el);
  posicionar(el, fx, fy);
  refrescarClon(el);
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
  recalcularUsosPorNivel(); // el resto de la clase se reparte la demanda que deja
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

/* ---------- Ficha flotante (consumo estimado + eficiencia editable) ---------- */
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
    seleccionarItem(null);
    if (id && $(id)) {
      $(id).focus({ preventScroll: true });
    }
  }
});

/* ---------- Simulación en tiempo real ----------
   El tinaco de la simulación se vacía con el consumo de los dispositivos del plano y se
   llena con el agua que entra de la red (SIMAS). Vive FUERA de Estado a propósito: cambia
   ~60 veces por segundo y, dentro del Proxy, cada cambio repintaría el dashboard y
   escribiría en localStorage. */
const LIMITE_BOMBA = 0.2, // la bomba automática arranca al 20 % del tanque
  SEG_DIA = 86400;

// Caudales de entrada de la red en L/min. El suministro normal llega con presión baja
// casi todo el día; el tandeo solo entrega agua en sus franjas horarias.
const ENTRADA_RED_NORMAL_LMIN = 0.3;
const ENTRADA_RED_TANDEO_LMIN = 6;
// La bomba toma agua de la red y llena el tinaco a este caudal.
const CAUDAL_BOMBA_LMIN = 15;

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

function enTanda(h) {
  return (h >= 6 && h < 10) || (h >= 18 && h < 22);
}

// ¿La red tiene suministro en la hora simulada? El corte nunca entrega agua.
function redDisponible(h = horaActualSim()) {
  if (Sim.modoSuministro === 'normal') {
    return true;
  }
  if (Sim.modoSuministro === 'tandeo') {
    return enTanda(h);
  }
  return false;
}

// Entrada directa de la red en L/s (sin contar la bomba).
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
  velocidad: Estado.simVelocidad, // segundos simulados por segundo real
  modoSuministro: Estado.simModoSuministro || 'normal',
  seguirSinAgua: Boolean(Estado.simSeguirSinAgua),
  bombaActiva: Estado.simBombaActiva !== false,
  bombaEncendida: false,
  consumoAcumulado: Math.max(0, Number(Estado.simConsumoAcumulado) || 0),
  casoFuga: 4821,
  fugasActivas: [],
  fugasActivo: true,
  fugasReveladas: false,
  sensoresAvisados: false,
  aguaPerdida: 0,
  nivel: Estado.simNivel !== null ? Estado.simNivel : null,
  tiempo: Estado.simTiempo,
  ultimo: 0,
  raf: 0,
  estado: null,
  pausaVacio: false,
  ultimoSensores: 0,
};

// Cambia el estado del motor sin disparar un render extra del dashboard.
function cambiarBomba(encendida) {
  const valor = Boolean(encendida);
  if (Sim.bombaEncendida === valor) {
    return false;
  }
  Sim.bombaEncendida = valor;
  return true;
}

// Aplica las reglas de la bomba: apagada, sin suministro, tinaco lleno y arranque al 20 %.
function actualizarBomba(h = horaActualSim()) {
  if (Sim.nivel === null) {
    return;
  }
  if (!Sim.bombaActiva) {
    cambiarBomba(false);
    return;
  }
  if (!redDisponible(h)) {
    cambiarBomba(false);
    return;
  }
  if (Sim.nivel >= Estado.capacidad) {
    cambiarBomba(false);
    return;
  }
  if (Sim.bombaEncendida) {
    return;
  }
  if (Sim.nivel <= Estado.capacidad * LIMITE_BOMBA) {
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
    texto: 'Agrega dispositivos al plano para ver cómo cambia el nivel del tanque.',
  },
};

function renderModosSuministro() {
  document.querySelectorAll('[data-modo-suministro]').forEach((btn) => {
    const activo = btn.dataset.modoSuministro === Sim.modoSuministro;
    btn.classList.toggle('activo', activo);
    btn.setAttribute('aria-pressed', activo ? 'true' : 'false');
  });
}

// El brillo del plano es la recompensa del detective: no aparece al iniciar la
// corrida, solo cuando la anomalía se descubre en los sensores o al finalizar.
function marcarFugasReveladas() {
  if (Sim.fugasReveladas) {
    return;
  }
  Sim.fugasReveladas = true;
  Sim.fugasActivas.forEach((id) => {
    const el = $(id);
    if (el) {
      el.classList.add('clon--fuga');
    }
  });
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

// Cada corrida sortea un código nuevo. La traducción del código a fugas sigue
// siendo determinista, pero el número ya no se muestra ni se edita.
function casoFugaAleatorio() {
  let codigo = Sim.casoFuga;
  while (codigo === Sim.casoFuga) {
    codigo = 1000 + Math.floor(Math.random() * 9000);
  }
  return codigo;
}

// Recalcula las fugas del caso y las deja listas para la corrida.
function aplicarCasoFuga(codigo) {
  const caso = generarCasoFuga(codigo);
  Sim.casoFuga = caso.codigo;
  Sim.fugasActivas = caso.ids;
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

  // Con la bomba activa el arranque es implícito: el botón del tanque vacío sobra.
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

// Flujos en litros por segundo simulado. Las fugas ocurren parejo 24 h y el gasto
// humano se modula según PESOS_HORA[h]. El modo de suministro determina la entrada de red.
function simFlujos() {
  const totalDia = litrosTotales(),
    fugasDia = resumenFugas().litros,
    fugasSim = fugasSimPorSala().total,
    humanoDia = Math.max(0, totalDia - fugasDia),
    h = horaActualSim();
  // La fuga sorpresa se suma aparte: el plano sigue midiendo la casa real.
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

// Detecta si una hora del día (0-23) está dentro de las franjas de pico.
function esHoraPico(h) {
  return (h >= 6 && h < 9) || (h >= 13 && h < 15) || (h >= 19 && h < 22);
}

// Flujo real por habitación en L/min. La suma de las filas coincide con simFlujos().consumo * 60.
function flujosPorHabitacion(hora, resumen = resumenPorSala()) {
  const factor = PESOS_HORA[hora] || 0;
  const hayAgua = Sim.nivel === null || Sim.nivel > 0;
  const extras = fugasSimPorSala();
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
    vacio.textContent = 'Agrega habitaciones para ver los sensores.';
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
      // La etiqueta se repite en cada fila: se queda en lo mínimo legible.
      etiqueta = fila.tieneFuga ? 'Fuga · sin suministro' : 'Sin suministro';
    } else if (fila.tieneFuga) {
      estado = 'anomalo';
      etiqueta = 'Anómalo';
      alertas++;
    } else if (fila.flujo > 0 && esHoraPico(h)) {
      estado = 'pico';
      etiqueta = 'Pico';
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
    // Antes de correr, el contador de alertas delataría la fuga sorpresa.
    (alertas && (Sim.corriendo || Sim.fugasReveladas)
      ? ' · ' + plural(alertas, 'alerta', 'alertas')
      : '');

  // La primera anomalía abre el acordeón por sí sola: la app señala, no adivina.
  if (alertas > 0 && Sim.corriendo && !Sim.sensoresAvisados) {
    Sim.sensoresAvisados = true;
    const panel = $('sensores-panel');
    if (panel) {
      panel.open = true;
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

  // El panel de tanque vacío ya es una alerta: no duplicamos el mensaje.
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

  // El aviso solo se reescribe al cambiar de estado (no en cada fotograma)
  // Sin mensaje no hay tarjeta: un "todo bien" permanente solo ocupaba sitio.
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
}

function simPaso(t) {
  if (!Sim.corriendo) {
    return;
  }
  // tope de 0.1 s: si la pestaña estuvo oculta, no hay un salto brusco al volver
  const dt = Math.max(0, Math.min((t - Sim.ultimo) / 1000, 0.1));
  Sim.ultimo = t;

  // Integración exacta por fronteras horarias para conservar la integral de 24 h a cualquier velocidad
  let restante = dt * Sim.velocidad;
  while (restante > 0) {
    const segEnHora = 3600 - (Sim.tiempo % 3600);
    const paso = Math.min(restante, segEnHora > 0 ? segEnHora : 3600);
    actualizarBomba();
    const f = simFlujos();
    Sim.nivel = Math.min(Math.max(Sim.nivel + f.neto * paso, 0), Estado.capacidad);
    Sim.consumoAcumulado += f.consumo * paso;
    Sim.aguaPerdida += f.consumoFuga * paso;
    Sim.tiempo += paso;
    restante -= paso;
    if (Sim.seguirSinAgua && Sim.nivel > 0 && f.entrada > 0) {
      Sim.seguirSinAgua = false;
      Estado.simSeguirSinAgua = false;
    }
    if (Sim.nivel <= 0 && f.entrada <= 0) {
      if (!Sim.seguirSinAgua) {
        simPausar();
        Sim.pausaVacio = true;
        // La sesión puede terminar aquí: el resumen solo se abre con Finalizar.
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
  Sim.estado = null; // fuerza a reescribir el aviso
  Sim.velocidad = Estado.simVelocidad;
  Sim.modoSuministro = Estado.simModoSuministro;
  Sim.bombaActiva = Estado.simBombaActiva !== false;
  Sim.aguaPerdida = 0;
  Estado.simAguaPerdida = 0;
  Sim.sensoresAvisados = false;
  limpiarFugasReveladas();
  // Cada corrida vuelve a esconder la fuga en otros aparatos.
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

// Muestra el modal de resumen al finalizar una sesión de simulación
function mostrarResumenSimulacion() {
  const aguaConsumida = Math.max(0, Sim.consumoAcumulado);
  const consumoDia = litrosTotales();
  const fugasDia = resumenFugas();
  const fugasSim = fugasSimPorSala();
  const limOMS = limiteOMS();
  const pctOMS =
    limOMS > 0
      ? Math.min((consumoDia / Math.max(1, Estado.habitantes) / CONFIG.litrosOMS) * 100, 100)
      : 0;

  // KPIs principales
  $('resumen-agua-consumida').textContent = NUM_ES.format(Math.round(aguaConsumida)) + ' L';
  $('resumen-tiempo').textContent = formatoReloj(Sim.tiempo);
  $('resumen-fugas').textContent =
    NUM_ES.format(Math.round(fugasDia.litros + fugasSim.total)) + ' L/día';
  $('resumen-uso-oms').textContent = Math.round(pctOMS) + ' %';

  // Fugas sorpresa de la corrida: el aparato exacto, su tasa y lo perdido.
  const textoFugas = $('resumen-fugas-resumen');
  const listaFugas = $('resumen-fugas-lista');
  const btnPlano = $('resumen-ver-plano');
  if (textoFugas && listaFugas && btnPlano) {
    listaFugas.innerHTML = '';
    const casoActivo = Sim.fugasActivo && Sim.fugasActivas.length > 0;
    if (casoActivo) {
      textoFugas.textContent =
        Sim.fugasActivas.length +
        ' fuga(s) · ' +
        fugasSim.total +
        ' L/día · ' +
        Math.round(Sim.aguaPerdida) +
        ' L perdidos durante la sesión';
      Sim.fugasActivas.forEach((id) => {
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
    } else {
      textoFugas.textContent = Sim.fugasActivo
        ? 'Este plano no tiene aparatos compatibles con una fuga sorpresa.'
        : 'Fugas sorpresa desactivadas en esta corrida.';
      btnPlano.hidden = true;
    }
  }

  // Consumo por habitación
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

// Notas cortas del simulador: un botón "?" por bloque y solo una abierta a la vez.
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

// Fugas sorpresa: el caso se sortea al activarlas y en cada reinicio;
// el código queda solo en el estado, no en la interfaz.
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

// Bomba del tinaco: un solo interruptor. Encendida, el motor se gobierna solo
// (arranca al 20 % y para al llenar); apagada, el tinaco depende de la red.
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

// Atajo del tanque vacío: activa la bomba automática y reanuda la simulación.
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

/* ---------- Inputs globales y arranque ---------- */
$('habitantes').addEventListener('keydown', (e) => {
  if (['.', ',', 'e', 'E', '-', '+'].includes(e.key)) {
    e.preventDefault();
  }
});

$('recibo-simas').addEventListener('keydown', (e) => {
  if (['e', 'E', '-', '+'].includes(e.key)) {
    e.preventDefault();
  }
});
$('recibo-simas').addEventListener('input', (e) => {
  const v = parseFloat(e.target.value);
  Estado.reciboM3 = isNaN(v) || v <= 0 ? 0 : Math.min(v, 999);
});

$('habitantes').addEventListener('input', (e) => {
  Estado.habitantes = entero(e.target.value, 1, 50);
  recalcularUsosPorNivel();
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
  const datos = await abrirModalSala();
  if (datos) {
    crearHabitacion(datos.nombre, Estado.pisoActivo, datos);
  }
});

// Manejo de errores de CDN (4.3)
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

// Sincroniza el objeto Sim (en memoria) con los valores restaurados de Estado (localStorage)
// Guarda el estado vivo de la simulación al salir o al ocultar la pestaña.
// No usa notificar() para no repintar en ese momento; guarda directamente.
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
  // Al recargar se respeta el caso guardado; solo se descartan ids inexistentes.
  Sim.fugasActivas = Array.isArray(Estado.simFugasActivas)
    ? Estado.simFugasActivas.filter((id) => Estado.dispositivos.has(id))
    : [];
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

/* ===========================================================
   ONBOARDING EXPRESS Y PLANTILLAS INICIALES
   =========================================================== */

let vistaAvanzada = 'constructor';
let personasAutomaticas = false; // el número de personas sigue la sugerencia del tamaño

// Al elegir el tamaño de la vivienda se sugiere un número de personas,
// pero nunca se pisa un valor escrito a mano ni una cifra propia guardada.
function sincronizarHabitantesSugeridos(perfil) {
  const sugerido = HABITANTES_SUGERIDOS[perfil];
  if (!personasAutomaticas || !sugerido) {
    return;
  }
  $('onb-habitantes').value = String(sugerido);
}

function abrirOnboarding() {
  const modal = $('modal-onboarding');
  if (!modal) {
    return;
  }
  const personas = String(Estado.habitantes || 4);
  $('onb-habitantes').value = personas;
  // En la primera visita la cifra es una sugerencia; al volver, solo si el
  // usuario la dejó en el valor que corresponde a su tamaño de vivienda.
  personasAutomaticas =
    !Estado.onboardingCompletado ||
    personas === String(HABITANTES_SUGERIDOS[normalizarPerfil(Estado.perfil)]);
  $('onb-recibo').value = Estado.reciboM3 > 0 ? String(Estado.reciboM3) : '20';
  document.querySelectorAll('input[name="onb-perfil"]').forEach((radio) => {
    radio.checked = radio.value === normalizarPerfil(Estado.perfil);
  });
  $('onb-habitantes-error').hidden = true;
  $('onb-recibo-error').hidden = true;
  $('onb-perfil-error').hidden = true;
  $('onb-habitantes').removeAttribute('aria-invalid');
  $('onb-recibo').removeAttribute('aria-invalid');
  $('onb-perfiles').removeAttribute('aria-invalid');
  modal.hidden = false;
  const elegido = document.querySelector('input[name="onb-perfil"]:checked');
  (elegido || $('onb-habitantes')).focus();
}

function validarOnboarding() {
  const n = Number($('onb-habitantes').value);
  const m3 = parseFloat($('onb-recibo').value);
  const perfil = document.querySelector('input[name="onb-perfil"]:checked');
  let valido = true;

  const marcar = (inputId, errorId, ok) => {
    const input = $(inputId);
    const error = $(errorId);
    if (ok) {
      input.removeAttribute('aria-invalid');
    } else {
      input.setAttribute('aria-invalid', 'true');
    }
    error.hidden = ok;
    if (!ok) {
      valido = false;
    }
  };

  marcar('onb-habitantes', 'onb-habitantes-error', Number.isInteger(n) && n >= 1 && n <= 50);
  marcar('onb-recibo', 'onb-recibo-error', !isNaN(m3) && m3 > 0 && m3 <= 999);
  $('onb-perfil-error').hidden = Boolean(perfil);
  const grupoPerfil = $('onb-perfiles');
  if (perfil) {
    grupoPerfil.removeAttribute('aria-invalid');
  } else {
    grupoPerfil.setAttribute('aria-invalid', 'true');
    valido = false;
  }

  if (!valido) {
    const primero = $('onb-perfiles').getAttribute('aria-invalid')
      ? document.querySelector('input[name="onb-perfil"]')
      : $('onb-habitantes').getAttribute('aria-invalid')
        ? $('onb-habitantes')
        : $('onb-recibo');
    if (primero) {
      primero.focus();
    }
  }
  return valido ? { habitantes: n, reciboM3: m3, perfil: perfil.value } : null;
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

// Crea una habitación y coloca sus dispositivos repartidos en el espacio libre.
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

  // Nivel alto: vivienda amplia
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

function procesarOnboarding(evento) {
  evento.preventDefault();
  const datos = validarOnboarding();
  if (!datos) {
    return;
  }

  pausado = true;
  try {
    vaciarCasa();
    Estado.habitantes = datos.habitantes;
    Estado.reciboM3 = datos.reciboM3;
    Estado.perfil = datos.perfil;
    Estado.capacidad = capacidadParaHabitantes(datos.habitantes);
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

  $('habitantes').value = Estado.habitantes;
  $('capacidad').value = Estado.capacidad;
  $('recibo-simas').value = Estado.reciboM3;
  $('modal-onboarding').hidden = true;
  const titulo = $('vista-constructor').querySelector('h2');
  if (titulo) {
    titulo.setAttribute('tabindex', '-1');
    titulo.focus({ preventScroll: true });
  }
}

async function reiniciarCasa() {
  const ok = await modalConfirm(
    'Se borrarán el plano, los dispositivos y tus respuestas. Esta acción no se puede deshacer.',
    'Reiniciar casa'
  );
  if (!ok) {
    return;
  }
  // Evita que beforeunload/visibilitychange vuelvan a guardar la casa recién borrada.
  reiniciandoCasa = true;
  cambiosPendientes = false;
  try {
    CLAVES_LEGADO.forEach((clave) => localStorage.removeItem(clave));
    localStorage.removeItem(CLAVE_LS);
  } catch (_) {
    // localStorage bloqueado: recargar de todos modos deja la app en memoria.
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

/* --- Onboarding y reinicio --- */
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

$('onboarding-form').addEventListener('submit', procesarOnboarding);
$('onb-habitantes').addEventListener('input', () => {
  personasAutomaticas = false;
  $('onb-habitantes-error').hidden = true;
  $('onb-habitantes').removeAttribute('aria-invalid');
});
$('onb-recibo').addEventListener('input', () => {
  $('onb-recibo-error').hidden = true;
  $('onb-recibo').removeAttribute('aria-invalid');
});
document.querySelectorAll('input[name="onb-perfil"]').forEach((radio) => {
  radio.addEventListener('change', () => {
    $('onb-perfil-error').hidden = true;
    $('onb-perfiles').removeAttribute('aria-invalid');
    sincronizarHabitantesSugeridos(radio.value);
  });
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

/* --- Arranque --- */
construirPaleta();
cargarEstado(); // restaura localStorage v3; sin datos abre el onboarding
iniciarApp();
sincronizarSimDesdeEstado();

// Guía de uso: divulgación progresiva, sin saturar las pantallas.
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

// Pestañas internas del diagnóstico: un solo panel visible a la vez.
function mostrarPanelDiagnostico(nombre) {
  const paneles = {
    consumo: $('diag-consumo'),
    recibo: $('diag-recibo'),
    social: $('diag-social'),
  };
  if (!paneles[nombre]) {
    return;
  }

  document.querySelectorAll('[data-diag]').forEach((tab) => {
    const activo = tab.dataset.diag === nombre;
    tab.classList.toggle('activa', activo);
    tab.setAttribute('aria-selected', activo ? 'true' : 'false');
  });

  Object.entries(paneles).forEach(([clave, panel]) => {
    panel.hidden = clave !== nombre;
  });

  if (nombre === 'consumo') {
    requestAnimationFrame(() => renderDashboard());
  }
}

document.querySelectorAll('[data-diag]').forEach((tab) => {
  tab.addEventListener('click', () => mostrarPanelDiagnostico(tab.dataset.diag));
});

// Menú de acciones secundarias.
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

// Pestañas de vista avanzada: alternar entre Mi casa y Simulador.
// mostrarVistaAvanzada() también recalcula el layout oculto al entrar.
document.querySelectorAll('.vista-tab').forEach((tab) => {
  tab.addEventListener('click', () => mostrarVistaAvanzada(tab.dataset.vista));
});

// Renderizar guía de cuadrícula al iniciar (no-op si el constructor está oculto)
renderizarGuiaGrid();

// Listeners: modal de resumen de simulación
$('modal-resumen-cerrar').addEventListener('click', () => {
  $('modal-resumen-simulacion').hidden = true;
});

$('modal-resumen-volver').addEventListener('click', () => {
  $('modal-resumen-simulacion').hidden = true;
  simReiniciar();
});

// Cierra el resumen y lleva el hallazgo al plano: la fuga queda marcada.
$('resumen-ver-plano').addEventListener('click', () => {
  $('modal-resumen-simulacion').hidden = true;
  marcarFugasReveladas();
  // La fuga puede estar en otro piso: hay que abrirlo antes de enfocarla.
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
