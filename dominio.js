/* SmartGota — dominio.js
 * Núcleo de cálculo del modelo: catálogo, promedios y reglas de reparto.
 * No toca el DOM ni lee estado global, así que se puede probar con node --test.
 * Se carga como script clásico antes de app.js (file:// sigue funcionando).
 */
var SmartGotaDominio = (function () {
  'use strict';

  const CATALOGO = {
    ducha: {
      nombre: 'Ducha',
      icono: '🚿',
      descripcion:
        'Es el mayor gasto por persona. El modo ahorrador reduce el caudal casi a la mitad.',
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
      descripcion: 'Cada descarga gasta agua. El modelo dual ahorra hasta 60 % por descarga.',
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
      descripcion: 'Corre mientras te lavas. Un aireador baja el caudal sin que se note.',
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
      descripcion: 'Llenarla gasta muchísima agua. El medio llenado ahorra un tercio.',
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
      descripcion: 'Cada carga usa decenas de litros. La carga frontal eficiente ahorra por ciclo.',
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
      descripcion: 'Lava con menos agua que a mano. El ciclo eco consume menos por carga.',
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
      descripcion: 'Riego y limpieza exterior. La pistola corta el flujo cuando no se usa.',
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
      descripcion: 'Evapora agua para enfriar. El modo compacto gasta menos por hora.',
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
      descripcion: 'Purifica agua para beber. La ósmosis rechaza agua; la ultrafiltración no.',
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
      descripcion: 'Una pérdida continua que gotea todo el día sin que nadie la use.',
      flujo: 100,
      medida: 'L/día',
      unidad: '',
      sugerido: 1,
      fijo: true,
    },
  };

  // Caudal de fuga continua por tipo de dispositivo en L/día

  const TASAS_FUGA = {
    inodoro: 200,
    ducha: 120,
    grifo: 90,
    tina: 80,
    lavadora: 60,
    lavavajillas: 60,
    lavabo: 50,
  };

  // Promedios educativos por tamaño de vivienda
  const PROMEDIOS = {
    bajo: {
      ducha: 3.5,
      inodoro: 4,
      lavabo: 1.5,
      lavaboCocina: 2,
      tina: 1,
      lavadora: 3,
      lavavajillas: 2,
      grifo: 15,
      aire: 10,
      aireSecundario: 6,
      filtro: 5,
    },
    medio: {
      ducha: 4,
      inodoro: 5,
      lavabo: 2,
      lavaboCocina: 3,
      tina: 1,
      lavadora: 3,
      lavavajillas: 3,
      grifo: 20,
      aire: 10,
      aireSecundario: 6,
      filtro: 5,
    },
    alto: {
      ducha: 7,
      inodoro: 5,
      lavabo: 3,
      lavaboCocina: 5,
      tina: 2,
      lavadora: 5,
      lavavajillas: 5,
      grifo: 30,
      aire: 10,
      aireSecundario: 6,
      filtro: 5,
    },
  };

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

  // Tipo y rol de habitación
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

  const PESO_ROL = { principal: 3, medio: 2, secundario: 1 };

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

  function normalizarCasoFuga(codigo) {
    const n = parseInt(String(codigo).replace(/\D/g, ''), 10);
    if (!Number.isFinite(n) || n < 1000) {
      return 4821;
    }
    return Math.min(n, 9999);
  }

  const limitar = (n, min, max) => Math.min(Math.max(n, min), max);

  /**
   * Reparte una cuota entera entre varios aparatos según su peso.
   * El reparto es entero y el resto va a quien tenga mayor fracción decimal.
   * Una cuota por uso: dos inodoros iguales suman lo mismo que uno.
   *
   * @param {number} total litros o minutos de la cuota
   * @param {number[]} pesos peso relativo de cada aparato (PESO_ROL)
   * @returns {number[]} cuota entera de cada aparato, en el mismo orden
   */
  function repartirCuota(total, pesos) {
    if (!pesos.length) {
      return [];
    }
    const suma = pesos.reduce((s, p) => s + Math.max(0, Number(p) || 0), 0);
    if (suma <= 0) {
      return pesos.map(() => 0);
    }
    const items = pesos.map((p, i) => {
      const exacto = (total * Math.max(0, Number(p) || 0)) / suma;
      const base = Math.floor(exacto);
      return { i, base, resto: exacto - base };
    });
    let sobra = total - items.reduce((s, it) => s + it.base, 0);
    items
      .slice()
      .sort((a, b) => b.resto - a.resto)
      .forEach((it) => {
        if (sobra > 0) {
          it.base += 1;
          sobra -= 1;
        }
      });
    const out = new Array(pesos.length).fill(0);
    items.forEach((it) => {
      out[it.i] = it.base;
    });
    return out;
  }

  /**
   * Cuota de un tipo de aparato en una habitación concreta.
   * No lee estado global: el perfil y los habitantes llegan por contexto.
   *
   * @param {string} tipo clave de CATALOGO
   * @param {{tipo?:string, rol?:string}|null} habitacion
   * @param {{perfil?:string, habitantes?:number}} ctx
   * @returns {{clave: string|null, uso: number, peso: number}}
   *   clave null = carga puntual que no se reparte (fuga, aire)
   */
  function baseUso(tipo, habitacion = null, ctx = {}) {
    const c = CATALOGO[tipo];
    if (!c) {
      return { clave: null, uso: 0, peso: 1 };
    }
    if (c.fijo) {
      return { clave: null, uso: c.sugerido, peso: 1 };
    }

    const tabla = PROMEDIOS[normalizarPerfil(ctx.perfil)] || PROMEDIOS.bajo;
    const habitantes = Math.max(1, Number(ctx.habitantes) || 1);
    const hab = habitacion || null;
    const tipoHab = hab && esTipoSala(hab.tipo) ? hab.tipo : 'recamara';
    const rol = hab && ROLES_SALA.includes(hab.rol) ? hab.rol : 'principal';

    if (tipo === 'aire') {
      return {
        clave: null,
        uso: rol === 'secundario' ? (tabla.aireSecundario ?? 6) : tabla.aire,
        peso: 1,
      };
    }

    const esCocina = tipo === 'lavabo' && tipoHab === 'cocina';
    const esBano = tipoHab === 'bano';
    const clave = esCocina ? 'lavaboCocina' : tipo;
    let uso = esCocina ? (tabla.lavaboCocina ?? tabla.lavabo) : (tabla[tipo] ?? c.sugerido);

    if (c.porHabitante && !esCocina) {
      uso *= habitantes;
    }
    if (tipo === 'lavadora' || tipo === 'lavavajillas') {
      uso = (uso * habitantes) / 4;
    }

    const esUsoBano = tipo === 'ducha' || tipo === 'inodoro' || tipo === 'lavabo';
    const peso = esBano && esUsoBano ? (PESO_ROL[rol] ?? 1) : 1;
    return { clave, uso: limitar(Math.round(uso), 0, 999), peso };
  }

  /**
   * Caso de fuga sorpresa determinista a partir de un código de cuatro dígitos.
   * El último dígito 8 o 9 duplica la fuga; el resto indexa los elegibles.
   *
   * @param {string|number} codigo
   * @param {string[]} elegibles ids de aparatos con TASAS_FUGA > 0
   * @returns {{codigo:number, ids:string[], horas:Map<string,number>}}
   */
  function generarCasoFuga(codigo, elegibles = []) {
    const base = normalizarCasoFuga(codigo);
    if (!elegibles.length) {
      return { codigo: base, ids: [], horas: new Map() };
    }
    const indice = Math.floor(base / 10) % elegibles.length;
    const ids = [elegibles[indice]];
    if (base % 10 >= 8 && elegibles.length > 1) {
      ids.push(elegibles[(indice + 1) % elegibles.length]);
    }
    const horas = new Map();
    ids.forEach((id, i) => {
      horas.set(id, 8 + ((Math.floor(base / 7) + i * 5) % 11));
    });
    return { codigo: base, ids, horas };
  }

  return {
    CATALOGO,
    TASAS_FUGA,
    PROMEDIOS,
    ALIAS_PERFIL,
    TIPOS_SALA,
    ROLES_SALA,
    PESO_ROL,
    normalizarPerfil,
    tipoSala,
    esTipoSala,
    limitar,
    flujoDe,
    litrosConFlujo,
    repartirCuota,
    baseUso,
    normalizarCasoFuga,
    generarCasoFuga,
  };
})();

if (typeof module === 'object' && module.exports) {
  module.exports = SmartGotaDominio;
}
