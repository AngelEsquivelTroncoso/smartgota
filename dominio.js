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
      icono: 'ducha',
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
      icono: 'inodoro',
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
      icono: 'lavabo',
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
      icono: 'tina',
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
      icono: 'lavadora',
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
      icono: 'lavavajillas',
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
      icono: 'grifo',
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
      icono: 'aire',
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
      icono: 'filtro',
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
      icono: 'fuga',
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

  // Ahorro por nivel bajo del tinaco: por debajo del 20 % los aparatos de uso
  // humano consumen la mitad. La banda de salida al 25 % evita que el factor
  // oscile justo en el umbral (el mismo patrón que usa el vacío del tinaco).
  // Las fugas no se ahorran: una fuga no negocia su caudal porque baje el nivel.
  const UMBRAL_AHORRO = 0.2;
  const UMBRAL_AHORRO_SALIDA = 0.25;
  const FACTOR_AHORRO = 0.5;

  /**
   * Factor de consumo según el nivel del tinaco, con histéresis.
   *
   * @param {number|null} nivel litros disponibles en el tinaco
   * @param {number} capacidad litros del tinaco
   * @param {boolean} activoPrevio si el ahorro ya estaba activo
   * @returns {{activo: boolean, factor: number}} factor 0.5 o 1
   */
  function evaluarAhorro(nivel, capacidad, activoPrevio = false) {
    const cap = Number(capacidad);
    if (nivel === null || nivel === undefined || !Number.isFinite(cap) || cap <= 0) {
      return { activo: false, factor: 1 };
    }
    const n = Number(nivel);
    if (!Number.isFinite(n)) {
      return { activo: false, factor: 1 };
    }
    if (n <= cap * UMBRAL_AHORRO) {
      return { activo: true, factor: FACTOR_AHORRO };
    }
    if (activoPrevio && n <= cap * UMBRAL_AHORRO_SALIDA) {
      return { activo: true, factor: FACTOR_AHORRO };
    }
    return { activo: false, factor: 1 };
  }

  // Suministro de la red. Un solo régimen: la madrugada llena el tinaco a
  // caudal fuerte y el resto del día entra una fracción de la demanda, así el
  // tinaco baja de día y se recupera de noche. Los cortes son deterministas a
  // partir de una semilla, para poder reproducir una corrida sin Math.random.
  const ENTRADA_MADRUGADA_LMIN = 6;
  const MADRUGADA = { desde: 0, hasta: 5 };
  const ENTREGA_DIA_FRACCION = 0.7;
  const DURACIONES_CORTE = [2, 2, 3, 3, 4, 4, 5, 6, 6, 8, 8, 12];
  const CORTE_GRAVE_HORAS = 24;
  const SEG_DIA = 86400;

  /**
   * Si una hora del día cae en la madrugada de llenado.
   *
   * @param {number} hora hora del día (0–23)
   * @returns {boolean}
   */
  function enMadrugada(hora) {
    return hora >= MADRUGADA.desde && hora < MADRUGADA.hasta;
  }

  /**
   * Número pseudoaleatorio estable en [0, 1) a partir de una semilla y un día.
   * Es determinista: la misma pareja da siempre el mismo corte, así que una
   * corrida se puede repetir y probar.
   *
   * @param {number} semilla entero de la corrida
   * @param {number} dia número de día simulado
   * @returns {number}
   */
  function mezclarSemilla(semilla, dia) {
    let x = (semilla ^ Math.imul(dia, 2654435761)) >>> 0;
    x ^= x >>> 15;
    x = Math.imul(x, 2246822507);
    x ^= x >>> 13;
    x = Math.imul(x, 3266489909);
    x ^= x >>> 16;
    return (x >>> 0) / 4294967296;
  }

  /**
   * Meta de llenado de la madrugada, como fracción de la capacidad.
   *
   * La noche deja de llenar el tinaco a tope todas las veces: la red solo
   * entrega hasta la meta y se cierra. El 6 % de las noches no entra nada, y
   * una de cada ocho semanas trae una sequía de dos noches seguidas, que es lo
   * que permite que el nivel llegue al 20 % sin inventar un corte gigante.
   *
   * @param {number} dia número de día simulado
   * @param {number} semilla entero de la corrida
   * @returns {number} fracción entre 0 y 1; 0 = esa noche no entra agua
   */
  function metaNoche(dia, semilla) {
    const semana = Math.floor(dia / 7);
    if (mezclarSemilla(semilla ^ 0xdead, semana) < 0.12) {
      const inicio = Math.floor(mezclarSemilla(semilla ^ 0xf00d, semana) * 6);
      if (dia % 7 === inicio || dia % 7 === inicio + 1) {
        return 0;
      }
    }
    if (mezclarSemilla(semilla ^ 0xa5a5, dia) < 0.06) {
      return 0;
    }
    // 68–100 %, sesgado a lleno: la raíz concentra los valores altos.
    return 0.68 + 0.32 * Math.sqrt(mezclarSemilla(semilla ^ 0x5a5a, dia));
  }

  /**
   * Corte de agua programado para un día, si toca.
   *
   * El plan se sortea por SEMANA, no por día: hay semanas sin ningún corte y
   * otras con hasta tres, así que aparecen rachas tranquilas y rachas malas.
   * La duración también varía (2–12 h). Una de cada ocho semanas trae un corte
   * grave de 26–36 h que cruza la madrugada y es el único que puede dejar el
   * tinaco en el 20 % por sí solo.
   *
   * @param {number} dia número de día simulado
   * @param {number} semilla entero de la corrida
   * @returns {{desde: number, hasta: number, grave: boolean}|null}
   */
  function corteDelDia(dia, semilla) {
    const semana = Math.floor(dia / 7);
    const r = mezclarSemilla(semilla ^ 0xbeef, semana);
    const cuantos = r < 0.3 ? 0 : r < 0.66 ? 1 : r < 0.88 ? 2 : 3;
    if (cuantos === 0) {
      return null;
    }
    const dias = Array.from({ length: 7 }, (_, d) => ({
      d,
      r: mezclarSemilla(semilla ^ 0xc0ffee, semana * 7 + d),
    }))
      .sort((a, b) => a.r - b.r)
      .slice(0, cuantos)
      .map((o) => o.d);
    if (!dias.includes(dia % 7)) {
      return null;
    }

    const ru = mezclarSemilla(semilla ^ 0x1234, dia);
    const rd = mezclarSemilla(semilla ^ 0x9876, dia);
    const grave =
      mezclarSemilla(semilla ^ 0x6666, semana) < 0.12 &&
      mezclarSemilla(semilla ^ 0x7777, dia) < 0.25;
    const horas =
      (grave ? CORTE_GRAVE_HORAS : 0) + DURACIONES_CORTE[Math.floor(rd * DURACIONES_CORTE.length)];
    const desde = grave
      ? 18 + Math.floor(ru * 3)
      : horas >= 8
        ? 17 + Math.floor(ru * 5)
        : 7 + Math.floor(ru * 14);
    return { desde, hasta: desde + horas, grave };
  }

  /**
   * Si la red está cortada en un instante absoluto de simulación.
   *
   * @param {number} horaAbsoluta horas transcurridas de simulación
   * @param {number} semilla entero de la corrida
   * @returns {boolean}
   */
  function enCorte(horaAbsoluta, semilla) {
    const dia = Math.floor(horaAbsoluta / 24);
    // Un corte grave dura más de un día: hay que mirar también el de ayer, o
    // el de 26–36 h se cortaría en la medianoche del día siguiente.
    for (const d of [dia, dia - 1]) {
      const corte = corteDelDia(d, semilla);
      if (!corte) {
        continue;
      }
      if (horaAbsoluta >= d * 24 + corte.desde && horaAbsoluta < d * 24 + corte.hasta) {
        return true;
      }
    }
    return false;
  }

  /**
   * Caudal de entrada durante el día: una fracción de la demanda diaria de la
   * casa, repartida en 24 h. Tiene que superar FACTOR_AHORRO; si no, el ahorro
   * del 20 % iguala la entrada y el tinaco se queda clavado en el umbral.
   *
   * @param {number} humanoDia litros al día de uso humano de la casa
   * @returns {number} litros por segundo
   */
  function flujoDiaLps(humanoDia) {
    const dia = Number(humanoDia);
    if (!Number.isFinite(dia) || dia <= 0) {
      return 0;
    }
    return (ENTREGA_DIA_FRACCION * dia) / SEG_DIA;
  }

  // Tipo y rol de habitación
  const TIPOS_SALA = [
    { id: 'recamara', nombre: 'Recámara', icono: 'recamara', genero: 'f' },
    { id: 'bano', nombre: 'Baño', icono: 'bano', genero: 'm' },
    { id: 'cocina', nombre: 'Cocina', icono: 'cocina', genero: 'f' },
    { id: 'sala', nombre: 'Sala', icono: 'sala', genero: 'f' },
    { id: 'comedor', nombre: 'Comedor', icono: 'comedor', genero: 'm' },
    { id: 'lavanderia', nombre: 'Lavandería', icono: 'lavanderia', genero: 'f' },
    { id: 'patio', nombre: 'Patio', icono: 'patio', genero: 'm' },
    { id: 'estudio', nombre: 'Estudio', icono: 'estudio', genero: 'm' },
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

  /**
   * Decide si una fuga del caso está corriendo en este instante.
   * El interruptor manda: con la sorpresa apagada la fuga no existe, aunque
   * `Sim.fugasActivas` siga guardando los ids del caso. Sin esta condición el
   * plano y la bitácora revelaban anomalías con el check desactivado.
   *
   * @param {boolean} activo
   * @param {number} [inicioSegundos] instante absoluto de inicio; sin él, la
   *   fuga ya corre
   * @param {number} segundos tiempo simulado transcurrido
   * @returns {boolean}
   */
  function fugaEnCurso(activo, inicioSegundos, segundos) {
    if (activo !== true) {
      return false;
    }
    if (
      inicioSegundos === undefined ||
      inicioSegundos === null ||
      !Number.isFinite(inicioSegundos)
    ) {
      return true;
    }
    return segundos >= inicioSegundos;
  }

  /**
   * Momento absoluto en que arranca una fuga, a partir de la hora del caso y
   * del instante en que se armó. Si esa hora ya pasó, va al día siguiente: la
   * sorpresa no puede nacer vencida al encenderla a mitad de corrida.
   *
   * @param {number} [hora] hora del día (0–23); sin hora, arranca en el ancla
   * @param {number} anclaSegundos instante en que se armó el caso
   * @returns {number} segundos absolutos de simulación
   */
  function inicioFugaDesde(hora, anclaSegundos) {
    const ancla = Number.isFinite(anclaSegundos) ? anclaSegundos : 0;
    if (!Number.isFinite(hora)) {
      return ancla;
    }
    const dia = Math.floor(ancla / 86400) * 86400;
    const candidato = dia + hora * 3600;
    return candidato >= ancla ? candidato : candidato + 86400;
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
    evaluarAhorro,
    UMBRAL_AHORRO,
    UMBRAL_AHORRO_SALIDA,
    FACTOR_AHORRO,
    ENTRADA_MADRUGADA_LMIN,
    MADRUGADA,
    ENTREGA_DIA_FRACCION,
    DURACIONES_CORTE,
    CORTE_GRAVE_HORAS,
    metaNoche,
    SEG_DIA,
    enMadrugada,
    mezclarSemilla,
    corteDelDia,
    enCorte,
    flujoDiaLps,
    tipoSala,
    esTipoSala,
    limitar,
    flujoDe,
    litrosConFlujo,
    repartirCuota,
    baseUso,
    normalizarCasoFuga,
    generarCasoFuga,
    fugaEnCurso,
    inicioFugaDesde,
  };
})();

if (typeof module === 'object' && module.exports) {
  module.exports = SmartGotaDominio;
}
