# SmartGota (TI2) — instrucciones para agentes

## Qué es

Proyecto web estático único: `index.html` + `styles.css` + `app.js` (todo en español). Simulador de consumo de agua de una vivienda, ahora planteado como **“El Detective del Agua”**: onboarding express, plantilla inicial según tamaño de vivienda, promedios automáticos de consumo, constructor de planos, simulación del tanque y sensores virtuales por habitación. No es monorepo, no hay paso de build, tests, tipado ni CI. `package.json` solo contiene ESLint/Prettier de desarrollo; no se necesita para ejecutar la app.

## Cómo ejecutar

- Abrir `index.html` directamente en el navegador (`file://` funciona; no hay servidor que levantar).
- Internet necesario solo para el gráfico (Chart.js 4.4.4) y la exportación PDF (jspdf 2.5.1), cargados desde CDN en `<script defer>`. El resto funciona sin conexión.
- Herramientas de desarrollo (opcional): `npm install` para instalar ESLint/Prettier; `npm run lint` / `npm run lint:fix` para analizar `app.js`; `npm run format` / `npm run format:check` para formatear código.

## Arranque y navegación

- Punto de entrada: `index.html`; el script es `app.js?v=48` (defer). Assets con `?v=48`.
- Arranque: `construirPaleta(); cargarEstado(); iniciarApp(); sincronizarSimDesdeEstado();`.
- No hay modo básico ni asistente de 3 pasos. La app abre directamente la vista “Mi casa”; si no hay onboarding completado, `iniciarApp()` muestra `#modal-onboarding`.
- `#vistas-avanzadas` alterna entre “Mi casa” (`#vista-constructor`) y “Simulador” (`#vista-simulador`) con `mostrarVistaAvanzada()`.
- “Mi casa” agrupa el resumen, el constructor y el diagnóstico. El diagnóstico es una vista única: el desglose de consumo vive directo en `#diag-consumo`, sin pestañas internas.
- El botón “Simular el día” (`#btn-ir-simulador`) cambia a la vista del simulador; no inicia la simulación por sí solo.
- Cambiar de pestaña solo alterna `hidden`; los nodos del DOM (y el tamaño dejado por un resize) se mantienen vivos.
- El gráfico y el layout del constructor se recalculan al volver a la vista de constructor.

## Estado y persistencia

- `app.js` guarda todo en `localStorage` con la clave `smartgota:estado:v3`; sobrevive a recargas. Para reiniciar desde cero, usar “Reiniciar casa” en “Mi casa”. Borrar la clave en DevTools con la pestaña abierta no es fiable: `beforeunload`/`visibilitychange` vuelven a guardar la simulación.
- No hay migración desde `v1`/`v2` ni desde el antiguo wizard. Al arrancar solo se lee `v3`; un estado viejo se ignora y se abre el onboarding. “Reiniciar casa” borra además `smartgota:estado:v1`, `smartgota:estado:v2` y `smartgota:wizard:v1`.
- Sin estado `v3` válido no se siembra una casa de ejemplo: `cargarEstado()` deja el estado limpio y `iniciarApp()` abre el onboarding.
- Si existe `v3` con `onboardingCompletado: true`, se restauran pisos, habitaciones, dispositivos y simulación.
- Un `v3` anterior con `perfil` (`basica`, `familiar` o `amplia`) se normaliza a `bajo`, `medio` o `alto` al cargar. Después, `recalcularUsosPorNivel()` sincroniza el uso y la frecuencia de **todos** los dispositivos con `PROMEDIOS`; ya no se conservan usos capturados en el modelo anterior.
- El estado es un `Proxy`: cualquier cambio repinta las vistas dependientes (resumen/diagnóstico y simulador) y guarda en un `queueMicrotask` (un solo repintado y un solo guardado por evento). No añadir listeners que luchen contra ese ciclo.
- Si `localStorage` falla (cupo lleno/bloqueado/modo privado), se muestra un aviso discreto en pantalla y la app sigue funcionando sin guardar.

## Onboarding y plantillas

- `#modal-onboarding` es de **selección directa**: muestra solo las tres tarjetas de vivienda (Compacta | Estándar | Amplia) y nada más. No pide personas ni m³; elegir una tarjeta crea la casa al instante con los valores preconfigurados.
- Las tarjetas son `<button class="perfil-opcion" data-perfil="bajo|medio|alto">`; el `value`/clave interna sigue siendo `bajo`/`medio`/`alto` porque `normalizarPerfil()` y `PROMEDIOS` dependen de esas claves. No cambiar las claves sin tocar `ALIAS_PERFIL`.
- `elegirVivienda(perfil)` deriva los datos preconfigurados y llama a `crearCasa()`: habitantes = `HABITANTES_SUGERIDOS[perfil]` (2 / 4 / 5) y capacidad = `CAPACIDAD_POR_PERFIL[perfil]` (450 / 750 / 1100 L).
- `crearCasa(datos)` limpia el estado anterior con `vaciarCasa()`, fija habitantes/perfil/capacidad, genera la casa con `generarPlantilla()` y sincroniza los promedios con `recalcularUsosPorNivel()`. Es la única vía de entrada: ya no hay `procesarOnboarding()` ni validación de campos.
- La plantilla usa las fábricas existentes (`crearPiso`, `crearHabitacion`, `agregarDispositivo`); no escribe Mapas directamente. Los dispositivos llevan `origen: 'plantilla'` y `modo: 'estandar'`.
- Los usos por persona (ducha, inodoro, lavabo) se guardan ya multiplicados por `habitantes`; lavadora, lavavajillas, jardín, tina, aire y fugas son usos del hogar.
- Hay **una sola cuota por uso** para toda la casa: `baseUso(tipo, sala)` devuelve `{ clave, uso, peso }` con la clave de `PROMEDIOS` ya resuelta (el lavabo de cocina es `lavaboCocina`; el de baño es `lavabo`). `recalcularUsosPorNivel()` reparte la cuota entre los aparatos de esa clave según el peso del rol (principal 3, medio 2, secundario 1), con reparto entero y el resto a quien tenga mayor fracción. Dos inodoros iguales en el mismo cuarto suman lo mismo que uno; añadir un baño secundario no duplica la demanda, solo la redistribuye. Los tipos `fijo` (fuga) nunca se dividen porque son caudal, no demanda repartible.
- La composición de la casa es fija (plano inmutable): no se mueven ni se agregan aparatos desde la interfaz. La clase de uso la fija el tipo y el rol de la habitación en la plantilla; lo único editable es la eficiencia (`modo`) de cada aparato.
- Consecuencia buscada: agregar un aparato del mismo uso no cambia el total de la casa. Lo que cambia el consumo es la eficiencia (`modo`), las fugas, el suministro y las personas.
- El tamaño de vivienda no se pregunta por dispositivo: `PROMEDIOS` centraliza los valores educativos por nivel y `usoPromedio(tipo, salaId)` devuelve la cuota total que luego se reparte. `recalcularUsosPorNivel()` sincroniza todos los dispositivos al cargar y al crear la casa (la composición no cambia; las personas son fijas por vivienda).
- El editor ya no pide minutos, cargas, descargas ni frecuencia: solo muestra el cálculo estimado y permite cambiar la eficiencia (`modo`).
- La capacidad del tinaco es fija por tipo de vivienda (`CAPACIDAD_POR_PERFIL`): Compacta 450 L, Estándar 750 L, Amplia 1100 L. Ya no hay selector ni la opción de 2500 L.

## Tipo y rol de habitación

- El modelo ya no se deduce del nombre: cada habitación guarda `tipo` (`recamara`, `bano`, `cocina`, `sala`, `comedor`, `lavanderia`, `patio`, `estudio`) y `rol` (`principal`, `secundario`, `medio`). El nombre es solo una etiqueta.
- `TIPOS_SALA` centraliza icono y género. El rótulo del plano muestra el icono del tipo y el nombre de la habitación.
- El plano es **inmutable**: las habitaciones vienen de la plantilla y no se agregan, borran, mueven ni redimensionan desde la interfaz. El rol (`principal`/`secundario`/`medio` en los baños) queda fijado por la plantilla y sigue pesando en el reparto.
- El rol no cambia la demanda de la casa: `baseUso()` asigna un peso (`principal` 3, `medio` 2, `secundario` 1) y `recalcularUsosPorNivel()` reparte la misma cuota. Un baño principal con 3 personas y uno secundario recibe la ducha en proporción 3:1, no una cuota aparte.
- Calibración vigente de `PROMEDIOS`: Compacta estándar ≈ 92 L/hab/día y eficiente ≈ 52; Estándar ≈ 112 y ≈ 64; Amplia ≈ 187 y ≈ 102. Si se tocan los promedios, recalcular esas cuatro cifras antes de darlas por buenas: son la referencia de calibración del modelo (ya no hay semáforo social).
- El aire lavado es la excepción: es carga puntual, `baseUso()` devuelve `clave: null` y cada aparato conserva sus horas (`aire` 10 en un espacio principal, `aireSecundario` 6 en uno secundario). No se reparte entre aparatos.
- Los estados viejos sin `tipo`/`rol` se migran una sola vez al cargar con `inferirTipoSala()` (regex sobre el nombre). Esa heurística no debe volver al cálculo.

## Resumen y diagnóstico (“Mi casa”)

- `renderDashboard()` calcula `litrosTotales()` y `resumenPorSala()`; siguen siendo la única fuente de verdad para el consumo.
- Todos los números visibles pasan por `NUM_ES` (`Intl.NumberFormat('es-MX')`): `litrosTexto()` para litros y `plural()` para conteos ("1 habitación" / "4 habitaciones"). No volver a llamar `toLocaleString('es-MX')` a mano.
- El resultado vive **dentro** de la banda de datos: `.kpis-resumen` es un flex con `flex: 1 1 520px` y `margin-left: auto`, y cada `.kpi` conserva su caja con `flex: 0 1 300px`. Así la fila se lee de un tirón (datos a la izquierda, resultado a la derecha) sin perder el diseño de las tarjetas. A ≤700 px el bloque pasa a fila propia con dos columnas iguales.
- El resumen superior tiene una tarjeta y una franja: el consumo manda (`.kpi--principal`, `#m-litros` con el equivalente mensual en `#m-litros-mes-corta`) y la pérdida por fugas es un estado, no un indicador comparable: `#m-fugas` y `#m-fugas-detalle` viven en `.kpi-fugas`, cuyo punto pasa a rojo con `data-tono='alerta'` cuando hay fugas en el plano o una fuga sorpresa revelada. Personas y tinaco son valores fijos de la vivienda (`#habitantes`, `#capacidad`); el periodo mensual queda fijo en `CONFIG.diasMes` (30). **No hay recibo mensual**: el plano es inmutable y compararlo contra un dato fijo por vivienda generaba contradicciones, así que ese concepto se eliminó por completo (UI, estado, PDF).
- El diagnóstico ordena los tipos de dispositivo de mayor a menor (`renderTopTipos` y `actualizarGrafico` comparten ese orden, usando `resumenPorTipo()`) y la dona no dibuja leyenda: cada fila de la lista lleva un punto con el color de su segmento y la barra de magnitud. Las tres cifras (`#m-mayor`, `#m-pct-tinaco`, `#m-litros-mes`) van en una franja de tres columnas sobre la dona.
- La recomendación se genera con `generarRecomendacion()` y queda plegada en `#alerta-rec-detalle`; la alerta visible es una sola (`#alerta`).
- El énfasis de los mensajes no usa comillas angulares: `marcar(nombre)` envuelve el término con marcas invisibles y `pintarDestacado(el, texto)` las convierte en `<strong>` al escribir en el DOM (`textContent` por trozo, nunca `innerHTML`). `textoPlano()` las quita antes de jsPDF. Aplica al confirm de borrado y a la recomendación.
- Las acciones secundarias (“Exportar PDF”, “Descargar gráfico PNG”, “Reiniciar casa”) están en el menú `#menu-acciones`, abierto con `#btn-acciones`.
- La paleta se agrupa por `GRUPOS_PALETA` (Baño · Cocina y lavandería · Casa y exterior); no añadir dispositivos fuera de esos grupos sin actualizar la lista.
- La paleta es ahora un **catálogo informativo** (banda horizontal encima del plano, `#paleta` flex, tres `.paleta__grupo` con separadores; en pantallas angostas los grupos se apilan con hairline superior). Cada `.item` es una tarjeta con icono, nombre y flujo base; un botón `?` (`.item__info`) abre la ventana emergente `#modal-info` con la descripción (`abrirInfoDispositivo()`). La tarjeta no se arrastra ni se selecciona.
- El plano ya no hereda el alto de la paleta: `.app-grid` es de una columna y `align-items: start`, y `.col-plano #plano` fuerza `flex: 0 0 auto` con `min-height: 0`. Antes el `stretch` igualaba los 716 px de la columna izquierda y dejaba media tarjeta vacía con una sola fila de habitaciones. El alto lo dictan las filas guía (`FILAS_MIN` 2 → ~330 px); ajustar las columnas al contenido dejaría el plano flotando a la izquierda, así que no se hace.
- El clic sobre un dispositivo del plano (clon) abre su ficha solo-modo (`abrirEditor`) para cambiar la eficiencia. Ya no hay colocación, arrastre ni selección de aparatos.
- “Reiniciar casa” pide confirmación con `modalConfirm()` y recarga la página con el onboarding abierto. El flag `reiniciandoCasa` evita que `persistirSimulacion()` reescriba la casa borrada durante `beforeunload`/`visibilitychange`.

## Simulador y tanque

- Modos de suministro: `normal` (red con presión baja, 0.3 L/min, 24 h), `tandeo` (6 L/min solo de 06–10 h y 18–22 h) y `corte` (sin entrada). Se seleccionan con `[data-modo-suministro]`.
- La bomba del tinaco toma agua de la red a 15 L/min. No hay cisterna ni segunda bomba.
- Control de bomba: un solo interruptor, `#sim-bomba-activa` ("Bomba automática", marcado por defecto). Encendido, el motor se gobierna solo: arranca al 20 % (`LIMITE_BOMBA`) y se detiene al llenar. Apagado, el tinaco solo recibe la presión de la red.
- No existe modo manual: `Sim.bombaEncendida` es estado interno del motor (histéresis), no un control de la interfaz. `cambiarBomba()` lo cambia sin repintar.
- El botón "?" (`#sim-bomba-ayuda`) abre `#sim-bomba-nota`; comparte con las fugas el helper `cerrarNotasSim()`, así que solo hay una nota abierta a la vez.
- La bomba se apaga sola al llenar el tinaco o si no hay suministro. En `tandeo` solo puede llenar dentro de sus franjas; en `corte` nunca.
- Constantes: `ENTRADA_RED_NORMAL_LMIN`, `ENTRADA_RED_TANDEO_LMIN`, `CAUDAL_BOMBA_LMIN` y `LIMITE_BOMBA`.
- Se conserva el selector de velocidad (1× a 21600×) en `#sim-vel`, dentro de la barra de sesión. No hay entradas técnicas de probabilidad de corte, factor de pico ni suministro extra.
- La barra de sesión muestra `#sim-estado-sesion` (Listo / En marcha / En pausa / Tanque vacío), `#sim-m-tiempo`, `#sim-play`, `#sim-reset` y `#sim-finalizar`. `renderEstadoSesion()` mantiene el estado. `#sim-reloj` se lee como marcador (cifras tabulares) y `.btn-sim--principal` es el único botón con peso visual.
- La tarjeta de alerta (`#sim-alerta`) solo se pinta cuando hay algo que decir: `MENSAJES_SIM` tiene `vacio`, `critico` y `sinconsumo`, sin estado “seguro”. Con el tinaco sano la tarjeta queda con `hidden` y sin texto.
- Suministro, bomba y fugas comparten una sola banda (`.sim__banda` con tres `.sim__seg` separados por hairlines), y al pie va `#sim-m-franja` con el estado del agua (hora del día, corte, o “Bomba llenando”). En pantallas angostas la banda se apila.
- El tanque del simulador tiene alto fijo (`clamp(210px, 30vh, 300px)`) y nunca absorbe el alto del panel: el HUD cuelga de él con el `gap` de la columna (10 px), así que no puede aparecer un hueco entre las cifras y el vaso por muchas habitaciones que se abran. El sobrante de la columna queda debajo del HUD.
- El tanque muestra una marca fina cada 25 % del vaso (`.tanque__marcas`) más la línea del 20 % con su etiqueta. Debajo, el HUD de tres filas (`.sim-hud`) reúne nivel (`#sim-m-nivel`), consumo (`#sim-m-consumo`) y entrada (`#sim-m-entrada`); dentro del vaso solo queda el porcentaje grande. En móvil el tanque pasa a 180 px con el HUD en tres chips. Las marcas viven en una capa con `mask-image` que las deja solo en el borde derecho: una retícula completa ensucia el vaso.
- `#sim-m-franja` resume la franja de tandeo o el estado del suministro; balance, llenado, límite del 20 % y vaciado quedan en el `details` “Ver detalles de la simulación”.
- Cada botón de suministro lleva su horario en un `small` (Normal “Todo el día”, Tandeo “06–10 · 18–22”, Corte “Sin entrada”). El modo activo recibe `.modo-suministro--flujo` solo mientras la sesión corre y la red entrega agua (`Sim.corriendo && redDisponible()`); en pausa o antes de iniciar no se enciende aunque el tinaco esté lleno, y `#sim-suministro-titulo` pasa a “Suministro · entrando”: en tandeo se enciende únicamente dentro de sus franjas.
- La bitácora (`#bitacora-lista`, `.bitacora__item`) registra transiciones, no cada fotograma: `registrarEvento()` guarda `{ hora: formatoReloj(Sim.tiempo), texto, tono }` (máximo 30, lo más reciente arriba). `detectarEventos()` compara `Sim.logPrev` en cada frame: llegada/corte de red, arranque/paro de bomba, tinaco vacío/recuperado, inicio/fin de hora pico y la revelación de una fuga. El estado inicial se fija en `simIniciar()` y se limpia en `simReiniciar()` para no registrar rebotes del primer fotograma.
- El nivel del tanque vive en `Sim` (fuera del Proxy para no repintar a 60 fps). Cada hora simulada conserva la integral diaria de `PESOS_HORA`.
- Con la red en presión baja el tinaco se vacía durante el uso normal; la bomba manual o automática lo recupera desde la red.
- Al quedar el tanque vacío sin entrada de agua, la simulación se pausa y muestra `#sim-aviso-vacio` con “Encender bomba” (`#sim-encender-bomba`) y “Seguir sin agua” (`#sim-seguir-sin-agua`). En automático el encendido es implícito, el botón manual se oculta y el texto de `#sim-aviso-texto` explica que la bomba arrancará cuando haya suministro.
- “Seguir sin agua” mantiene el tiempo avanzando con consumo real 0; los sensores también quedan en 0 hasta que vuelva el suministro.
- El resumen de la sesión solo se abre con `#sim-finalizar`.
- “Reiniciar simulación” (`simReiniciar()`) vuelve a llenar el tinaco, reinicia tiempo y consumo acumulado y apaga la bomba; conserva el modo de suministro y el modo de bomba.
- `mostrarResumenSimulacion()` usa `Sim.consumoAcumulado`, no `capacidad - nivel`, porque la bomba puede rellenar durante la sesión.
- `persistirSimulacion()` guarda nivel, tiempo, estado de marcha, `seguirSinAgua`, modo/estado de bomba y consumo acumulado al ocultar o cerrar la pestaña; al recargar se reanuda si estaba corriendo.

### Fugas sorpresa

- El bloque `.sim__fugas` es ortogonal al suministro y mínimo a propósito: `#sim-fugas-activo` enciende o apaga las fugas y `#sim-fugas-ayuda` (botón “?”) abre la nota `#sim-fugas-nota` con una explicación de tres líneas. La nota cierra con Escape o con clic fuera (`cerrarNotaFugas()`), y el botón mantiene `aria-expanded`/`aria-controls`.
- No hay selector de caso en la interfaz: el código de cuatro dígitos es interno y vive en `Estado.simCasoFuga`. `casoFugaAleatorio()` sortea uno nuevo al activar el interruptor y en cada `simReiniciar()`, así que la sorpresa se repite por corrida.
- `TASAS_FUGA` fija el caudal continuo por tipo (inodoro 200, ducha 120, grifo 90, tina 80, lavadora 60, lavavajillas 60, lavabo 50 L/día). El ítem `fuga` aparece en el catálogo como informativo (`CATALOGO[tipo].fijo`).
- `generarCasoFuga(codigo)` sigue siendo determinista: último dígito 8 o 9 → dos fugas (~20 %), cualquier otro → una (~80 %); el resto de los dígitos indexa la lista de dispositivos elegibles. Devuelve `{ codigo, ids, horas }`: `horas` es un `Map<id, hora>` con una hora de inicio entre 8 y 18 h (`8 + ((floor(base/7) + i*5) % 11)`). Sirve para reproducir un caso cuando se conoce el código guardado, aunque ya no se edite a mano.
- **Activación diferida:** la fuga no gotea desde el minuto cero. `Sim.horaInicioFuga` guarda la hora de cada aparato y `fugaIniciada(id)` compara `Sim.tiempo >= hora * 3600` (tiempo absoluto, no se rearma a medianoche). Antes de esa hora el caudal es 0 y el sensor sigue normal; al llegar, cambia a “Anómalo” en vivo. `fugasIniciadas()` devuelve solo las que ya empezaron.
- `Sim.fugasActivas`, `Sim.casoFuga`, `Sim.horaInicioFuga`, `Sim.fugasActivo` y `Sim.aguaPerdida` viven fuera del Proxy; `aplicarCasoFuga()` publica en `Estado` los que se persisten (la hora no: se deriva del código).
- `resumenFugas()` y `resumenPorSala()` siguen midiendo el plano estático: la fuga sorpresa solo se superpone en `simFlujos()` (vía `fugasSimPorSala(true)`) y en `flujosPorHabitacion()`. “Mi casa” no cambian.
- `fugaSimDe(d, id, enVivo)` recibe el id del mapa; no se inyecta `id` en el registro del dispositivo. `enVivo` es el interruptor que respeta la hora de inicio; sin él (PDF y escenario) se describe la fuga completa.
- `Sim.aguaPerdida` acumula litros perdidos en `simPaso()`.
- Al cargar se respeta el caso guardado (no se vuelve a sortear) y se descartan ids de dispositivos borrados; `sincronizarSimDesdeEstado()` reconstruye `Sim.horaInicioFuga` desde `generarCasoFuga(Sim.casoFuga)` (`?? 0`). `simReiniciar()` limpia `aguaPerdida` y asigna un caso nuevo si las fugas están activas.
- Anti-spoiler: `#sensores-resumen` solo agrega “· N alerta(s)” cuando `Sim.corriendo` o `Sim.fugasReveladas`. El acordeón cerrado no debe delatar la fuga antes de empezar ni antes de su hora.
- Revelación incremental: `marcarFugasReveladas()` marca solo `fugasIniciadas()`, sin guard global, y es idempotente; así la segunda fuga (con otra hora) se enciende cuando arranca, no antes. `renderSensores()` abre `#sensores-panel` una sola vez por corrida (flag `Sim.sensoresAvisados`) en la primera anomalía y en cada frame llama a `marcarFugasReveladas()` mientras corre. `mostrarResumenSimulacion()` también revela al cerrar. `simPaso()` parte el avance en fronteras horarias y, tras cada tramo, compara `fugasIniciadas().length` con el valor previo: si cambió, llama a `marcarFugasReveladas()` en ese mismo punto (la bitácora anota la hora exacta de inicio, también a 3600× y 21600×) y pone `Sim.ultimoSensores = 0` para saltarse el throttle de 900 ms de `simRender()`; cruzar cualquier hora fuerza igualmente el repintado de sensores.
- El resumen de sesión agrega el bloque “Fugas de la sesión” (`#resumen-fugas-resumen`, `#resumen-fugas-lista`, `#resumen-ver-plano`): cantidad, L/día, L perdidos (`Sim.aguaPerdida`) y aparato exacto, sin códigos. Si el caso existía pero ninguna fuga llegó a su hora, dice “La corrida terminó antes de que apareciera una anomalía” en vez de inventar un resultado. “Ver en el plano” abre el piso de la fuga y enfoca el clon.
- `#m-fugas-detalle` distingue plano y simulación: “sin fugas en el plano · fuga sorpresa detectada”, y ese texto es el que pinta la franja en rojo, para no contradecir el KPI de 0 L/día.
- El PDF incluye “Escenario de fugas sorpresa” con el detalle por aparato; la advertencia ambiental suma `fugasSim.total`.

## Sensores IoT

- `renderSensores()` pinta una fila por habitación en `#sensores-lista` y actualiza el resumen del acordeón `#sensores-panel` (`#sensores-resumen`). El acordeón está cerrado por defecto para no saturar el simulador.
- `flujosPorHabitacion()` reparte el consumo real: fugas de forma continua y consumo humano según `PESOS_HORA`. Suma además la fuga sorpresa de `fugasSimPorSala()` para que la habitación afectada la delate. La suma coincide con `simFlujos().consumo * 60` dentro del redondeo de una décima por habitación (≤ 0,001 L/min).
- Estados visuales: normal, hora pico, flujo anómalo (fuga), sin suministro y sin consumo. La etiqueta se repite en cada fila, así que usa la forma corta (`Normal`, `Pico`, `Anómalo`, `Sin consumo`, `Sin suministro`, `Fuga · sin suministro`) y se pinta como píldora junto al caudal, no como columna aparte. En hora pico la píldora nombra al culpable (`Pico · Ducha`): `dispositivoPicoDeSala()` elige el aparato con mayor aporte actual (`litrosDe(d) * factor`, o el caudal fijo de una fuga), no el más eficiente.
- Con el tanque vacío todos los sensores muestran `0.00 L/min`; si la habitación tenía fuga, la etiqueta lo indica.

## Estilo visual

- El cian es el color del agua y de nada más: `--agua`, `--agua-2` y `--agua-tenue` solo se usan en el agua del tanque. Nunca significa estado ni acción; el esmeralda sigue siendo "está bien" y las acciones, y el ámbar/rojo son avisos.
- `.tarjeta` tiene profundidad real: `box-shadow: var(--sombra)` (brillo interior de 1 px arriba + sombra suave) y un degradado blanco al 2,8 % en la mitad superior. El fondo general es `#080f0d` con dos radiales muy tenues (esmeralda arriba a la izquierda, cian arriba a la derecha).
- `#plano` lleva una retícula de azulejo de 1 px al 2,2 % cada 26 px: es textura de fondo, no estructura. La grilla de colocación la siguen dibujando las `.celda-guia`.
- Los números van en peso 800 (`.kpi strong`, `.mini strong`, `.sim-hud__fila strong`, `#sim-pct`) con `tabular-nums`; los rótulos no suben de 700. `#sim-pct` lleva sombra de texto porque en un tanque lleno queda sobre el agua.

## Accesibilidad y navegación por teclado

- El onboarding atrapa el foco y no se puede cerrar con Escape. Las tarjetas son botones focables; al elegir una se genera la casa y el foco pasa al `h2` de “Mi casa”.
- Al cerrarse, `cerrarOnboarding()` mueve el foco al `h2` de “Mi casa” con `tabindex="-1"`; la regla `[tabindex='-1']:focus-visible { outline: none }` evita que el encabezado quede con un anillo verde permanente (no es interactivo ni alcanzable con Tab).
- Los modales scrollean cuando no caben: `.modal` usa `align-items: start` + `overflow-y: auto` y el centrado lo aporta `margin-block: auto` en `.modal__caja`. Con el centrado del grid, una caja más alta que la ventana dejaba el título y el botón final fuera de la zona alcanzable.
- La guía de uso (`#modal-ayuda`) atrapa el foco con `trapaFoco()`, cierra con Escape, con el fondo o con sus botones, y devuelve el foco a `#btn-ayuda`.
- Las pestañas de vista usan `role="tab"`/`aria-selected`/`aria-controls`; los paneles de vista usan `role="tabpanel"`.
- El menú de acciones usa `aria-expanded`, cierra con Escape o clic fuera y al cerrar con Escape devuelve el foco a `#btn-acciones`.
- Los clones de dispositivos (`.clon`) son focables con Tab y abren su ficha con Enter/Space. La paleta (catálogo) no es interactiva.
- Hay estilos `:focus-visible` con anillo verde esmeralda para elementos interactivos.
- Los sensores usan `role="status"`.
- Al cerrar la pestaña con cambios sin guardar se muestra una advertencia del navegador.

## Esquema de estado (`localStorage`)

Clave: `smartgota:estado:v3`

- `version`, `onboardingCompletado`, `perfil` (`bajo` | `medio` | `alto`; se muestra como Compacta | Estándar | Amplia), `habitantes`, `capacidad`
- `pisoActivo`, `siguienteId`, `siguienteSala`, `siguientePiso`
- `pisos`: arreglo de `[id, {id, nombre}]`
- `habitaciones`: arreglo de `[id, {id, nombre, tipo, rol, piso, cx, cy, cs, rs}]`
- `dispositivos`: arreglo de `[id, {tipo, sala, fx, fy, uso_personalizado, frecuencia, modo, origen?}]`
- `simNivel`, `simTiempo`, `simCorriendo`, `simVelocidad`, `simModoSuministro`, `simSeguirSinAgua`
- `simBombaActiva` (bool, `true` por defecto), `simConsumoAcumulado`
- `simCasoFuga` (código de cuatro dígitos, 4821 por defecto), `simFugasActivas` (ids marcados), `simFugasActivo` (bool), `simAguaPerdida` (L perdidas en la sesión)

## Verificación

- Abrir `index.html` en el navegador y comprobar visualmente onboarding → “Mi casa” → diagnóstico → simulador.
- `npm run lint` para revisar `app.js` con ESLint.
- `npm run format:check` para revisar formateo con Prettier.
- Comprobar que el diagnóstico muestra directamente la dona de consumo (sin pestañas ni panel de recibo), que el gráfico se mide bien al volver a la vista y que el menú `#btn-acciones` abra/cierre con teclado y clic fuera.
- Comprobar el onboarding de selección directa: muestra solo las tres tarjetas (Compacta, Estándar, Amplia) sin campos de personas ni m³; elegir una crea la casa al instante con habitantes 2 / 4 / 5 y capacidad según el tamaño.
- Comprobar que la banda de datos muestra `#habitantes` y `#capacidad` como valores fijos (sin inputs), derivados del tipo de vivienda: Compacta 2 / 450 L, Estándar 4 / 750 L, Amplia 5 / 1100 L, y que no aparece ningún indicador de recibo (ni en el resumen, ni en el diagnóstico, ni en el PDF).
- Comprobar el catálogo: cada tarjeta muestra icono, nombre, flujo base y descripción; la paleta no responde al clic ni al arrastre. Tocar un clon del plano abre la ficha solo-modo (`#ed-modo`).
- Comprobar que no existen campos de minutos, cargas, descargas ni frecuencia en la ficha del dispositivo y que `#ed-modo` sigue siendo editable.
- Agregar un segundo aparato del mismo uso baja el uso de ambos y deja igual el total; borrarlo lo devuelve. Añadir un baño secundario completo tampoco cambia el total: solo cambia el reparto entre baños.
- Comprobar que el plano es inmutable: no hay botones de agregar/borrar piso ni habitación, ni asas de tamaño, ni papelera; el rótulo no responde al doble clic.
- Comprobar la guía `#modal-ayuda`: abre, atrapa el foco, cierra con Escape y devuelve el foco.
- Comprobar “Reiniciar casa”: confirmar, esperar la recarga y verificar que aparece el onboarding y que el `v3` guardado tiene `onboardingCompletado: false`, sin pisos ni dispositivos.
- Comprobar la invariante de sensores: suma de caudales por habitación ≈ consumo real de la casa (tolerancia de redondeo ≤ 0,001 L/min).
- Comprobar que la alerta del simulador está oculta con el tinaco en nivel normal y que aparece con nivel bajo, tanque vacío o plano sin dispositivos.
- Comprobar la bomba: drenaje con `normal`, arranque al 20 %, paro al 100 %, bloqueo en `corte`/fuera de tandeo y que apagar el interruptor corta el llenado. En el tanque vacío: “Activar bomba” (oculto si la bomba ya está activa) y “Seguir sin agua”.
- Comprobar el horario del suministro: cada botón muestra su `small`; en Tandeo el botón se enciende solo entre 06–10 y 18–22 y `#sim-suministro-titulo` dice “Suministro · entrando”; en Corte nunca se enciende.
- Comprobar la bitácora: al iniciar registra “Comienza la simulación”; en tandeo anota la llegada y el corte de red en la hora exacta; anota arranque/paro de bomba, tinaco vacío y el inicio/fin de cada hora pico; al revelarse una fuga anota la habitación; “Reiniciar” la deja vacía.
- Comprobar el pico en los sensores: en una hora pico la píldora muestra `Pico · <aparato>` y el aparato nombrado es el de mayor consumo actual de esa habitación, no siempre el mismo.
- Comprobar las fugas sorpresa: el interruptor enciende y apaga; al reactivar y al reiniciar cambia el aparato elegido; al arrancar no se pierde agua (`Sim.aguaPerdida` queda en 0 y el tanque no baja por fuga); el caudal aparece recién en la hora del caso (8–18 h) y el sensor de esa habitación cambia a “Anómalo”; apagado devuelve el consumo base y “Mi casa” no cambia en ningún caso. El “?” abre la nota y Escape la cierra.
- Comprobar que `#sensores-resumen` no muestra “alerta(s)” antes de iniciar (sería un spoiler) y que sí lo hace al correr.
- Comprobar que la fuga sorpresa aparece en el sensor de su habitación y que al recargar se conserva el caso (`simCasoFuga`) sin volver a sortearlo.
- Comprobar la revelación: al iniciar no hay `.clon--fuga` aunque las fugas estén activas; la primera anomalía (a la hora del caso) abre el acordeón una sola vez y marca los clones ya iniciados; si el caso tiene dos fugas con horas distintas, la segunda se enciende en su hora, no antes; “Ver en el plano” abre el piso correcto y enfoca el aparato. `simReiniciar()` y apagar `#sim-fugas-activo` limpian brillo y aviso. Si la corrida se finaliza antes de la hora, el resumen dice “La corrida terminó antes de que apareciera una anomalía”.
- Comprobar la paridad de `/*` y `*/` en `styles.css` tras borrar bloques: un comentario sin cerrar se traga las reglas siguientes sin avisar (ya ocurrió con el pulido de botones).
- Comprobar que el confirm de borrado y la recomendación muestran el nombre en negrita, sin `«»`, y que seleccionar el texto y copiarlo no arrastra caracteres raros.
- Comprobar que la lista de habitaciones muestra todas las habitaciones y que el color del punto coincide con su segmento de la dona.
- Abrir el resumen de sesión con fugas en una ventana de 600–768 px de alto: el modal debe scrollear y dejar alcanzable “Volver al simulador”.
- Comprobar que el cian aparece solo en el agua del tanque: ningún estado, botón ni cifra de consumo lo usa.
- Revisar 360, 500, 768, 1244 y 1440 px sin desbordamiento horizontal (`document.documentElement.scrollWidth <= clientWidth`); en móvil la paleta apila sus grupos y el acordeón de sensores sigue cerrado hasta la primera anomalía.
- Comprobar que la banda de dispositivos no deja hueco bajo el plano: con una sola fila de habitaciones el plano debe medir ~330 px (dos filas guía), no 640.
- Comprobar que dos aires, uno en un espacio principal y otro en uno secundario, suman 16 h (100 L + 60 L/día) y ninguno se reduce a la mitad; y que en la vivienda Amplia la ducha se reparte 3:1 entre el baño principal y el secundario (26 y 9 min de 35, total sin cambios).
- Comprobar el desfase de fugas: a 3600× y a 21600× la bitácora registra “Anomalía detectada en …” con la hora exacta de inicio del caso (la del `simCasoFuga`, entre 08:00 y 18:00) y no horas después, y la fila del sensor pasa a “Anómalo” sin esperar el throttle.
- Comprobar el botón de suministro: con el tinaco al 100 % y la simulación sin iniciar o en pausa no brilla (`.modo-suministro--flujo`) ni dice “Suministro · entrando”; solo lo hace con la simulación corriendo y la red entregando agua.
- Abrir el resumen de sesión: las tres cifras (`.resumen__kpis`) van en tres columnas iguales en escritorio y apiladas a ≤480 px, sin hueco vacío.
- Si un cambio de CSS/JS no se ve, actualizar el parámetro `?v=48` o limpiar caché del navegador.

## Gotchas

- Código, comentarios y strings de UI en español.
- No añadir migraciones desde v1/v2: el onboarding debe crear una casa limpia. Dentro de `v3` se permite normalizar el `perfil` antiguo y sincronizar usos/frecuencias con `PROMEDIOS`.
- Los promedios viven en `PROMEDIOS`; no volver a pedir minutos, cargas, descargas ni frecuencia en el editor.
- `localStorage` puede fallar (cupo lleno/bloqueado/modo privado): se muestra un aviso en pantalla y la app sigue funcionando sin guardar.
- Al buscar clases CSS muertas, `sensor--*`, `ambar`/`rojo` y `ocupada` no aparecen en el HTML porque se arman por concatenación en JS: comprobar los literales antes de borrar.
- Un comentario CSS sin cerrar (`/* ... ==== .selector {`) se traga todas las reglas siguientes hasta el próximo `*/` y no da error: al borrar bloques, comprobar la paridad de `/*` y `*/` y que ningún comentario contenga `{`.
- No uses `innerHTML` para resaltar nombres de habitación o dispositivo: son texto libre del usuario. Usa `marcar()` + `pintarDestacado()`; si el destino no es el DOM (PDF, `aria-label`), pasa por `textoPlano()`.
- `pintarDestacado()` necesita que el elemento exista y reemplaza su contenido completo; no lo llames sobre un nodo que ya tenga hijos propios.
- No reintroducir el recibo mensual (`reciboM3`, comparativa, panel `Recibo`): con el plano inmutable y los valores fijos por vivienda, comparar contra un recibo producía contradicciones matemáticas.
- No hay código generado, codegen ni flujo de despliegue.
