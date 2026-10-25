# SmartGota (TI2) — instrucciones para agentes

## Qué es

Proyecto web estático único: `index.html` + `styles.css` + `app.js` (todo en español). Simulador de consumo de agua de una vivienda, ahora planteado como **“El Detective del Agua”**: onboarding express, plantilla inicial según perfil de vivienda, comparación del plano contra el recibo mensual, constructor de planos, simulación del tanque y sensores virtuales por habitación. No es monorepo, no hay paso de build, tests, tipado ni CI. `package.json` solo contiene ESLint/Prettier de desarrollo; no se necesita para ejecutar la app.

## Cómo ejecutar

- Abrir `index.html` directamente en el navegador (`file://` funciona; no hay servidor que levantar).
- Internet necesario solo para el gráfico (Chart.js 4.4.4) y la exportación PDF (jspdf 2.5.1), cargados desde CDN en `<script defer>`. El resto funciona sin conexión.
- Herramientas de desarrollo (opcional): `npm install` para instalar ESLint/Prettier; `npm run lint` / `npm run lint:fix` para analizar `app.js`; `npm run format` / `npm run format:check` para formatear código.

## Arranque y navegación

- Punto de entrada: `index.html`; el script es `app.js?v=18` (defer). Assets con `?v=18`.
- Arranque: `construirPaleta(); cargarEstado(); iniciarApp(); sincronizarSimDesdeEstado();`.
- No hay modo básico ni asistente de 3 pasos. La app abre directamente la vista “Mi casa”; si no hay onboarding completado, `iniciarApp()` muestra `#modal-onboarding`.
- `#vistas-avanzadas` alterna entre “Mi casa” (`#vista-constructor`) y “Simulador” (`#vista-simulador`) con `mostrarVistaAvanzada()`.
- “Mi casa” agrupa el resumen, el constructor y el diagnóstico. El diagnóstico tiene tres paneles internos (`Consumo`, `Recibo`, `Social`) controlados por `[data-diag]` y `mostrarPanelDiagnostico()`.
- El botón “Simular el día” (`#btn-ir-simulador`) cambia a la vista del simulador; no inicia la simulación por sí solo.
- Cambiar de pestaña solo alterna `hidden`; los nodos del DOM (y el tamaño dejado por un resize) se mantienen vivos.
- El gráfico y el layout del constructor se recalculan al volver a la vista de constructor o al panel `Consumo`.

## Estado y persistencia

- `app.js` guarda todo en `localStorage` con la clave `smartgota:estado:v3`; sobrevive a recargas. Para reiniciar desde cero, usar “Reiniciar casa” en “Mi casa” o borrar la clave en DevTools → Application → Local Storage.
- No hay migración desde `v1`/`v2` ni desde el antiguo wizard. Al arrancar solo se lee `v3`; un estado viejo se ignora y se abre el onboarding. “Reiniciar casa” borra además `smartgota:estado:v1`, `smartgota:estado:v2` y `smartgota:wizard:v1`.
- Sin estado `v3` válido no se siembra una casa de ejemplo: `cargarEstado()` deja el estado limpio y `iniciarApp()` abre el onboarding.
- Si existe `v3` con `onboardingCompletado: true`, se restauran pisos, habitaciones, dispositivos y simulación.
- El estado es un `Proxy`: cualquier cambio repinta el dashboard y guarda en un `queueMicrotask` (un solo repintado y un solo guardado por evento). No añadir listeners que luchen contra ese ciclo.
- Si `localStorage` falla (cupo lleno/bloqueado/modo privado), se muestra un aviso discreto en pantalla y la app sigue funcionando sin guardar.

## Onboarding y plantillas

- `#modal-onboarding` pide: habitantes (1–50), m³ del último recibo **mensual** y perfil de vivienda (`basica`, `familiar`, `amplia`).
- `procesarOnboarding()` valida, limpia el estado anterior y genera la casa con `generarPlantilla()`.
- La plantilla usa las fábricas existentes (`crearPiso`, `crearHabitacion`, `agregarDispositivo`); no escribe Mapas directamente. Los dispositivos llevan `origen: 'plantilla'` y `modo: 'estandar'`.
- Los usos por persona (ducha, inodoro, lavabo) se guardan ya multiplicados por `habitantes`; lavadora, lavavajillas, jardín y fugas son usos del hogar.
- La capacidad del tinaco se sugiere con `capacidadParaHabitantes()`: 450 L (1–2), 750 L (3–4), 1100 L (5–6) y 2500 L (7+).
- El recibo se interpreta como consumo mensual: `litrosDiaRecibo = reciboM3 * 1000 / Estado.diasMes` (30 días por defecto).

## Resumen y diagnóstico (“Mi casa”)

- `renderDashboard()` calcula `litrosTotales()` y `resumenPorSala()`; siguen siendo la única fuente de verdad para el consumo.
- El resumen superior muestra tres KPIs: consumo diario (`#m-litros`), diferencia contra el recibo (`#m-vs-recibo`) y costo mensual (`#m-costo-mes`). El recibo mensual se edita en `#recibo-simas`; tarifa y días del mes quedan en el `details` “Tarifa y periodo”.
- La comparativa `#comparativa-recibo` usa `calcularValidacionSimas()` y muestra m³ virtuales vs m³ reales del recibo. La barra tiene estados `sin-recibo`, `vacio`, `bajo`, `ok` y `alto` (±15 %). Vive en el panel `Recibo`.
- La recomendación se genera con `generarRecomendacion()` y queda plegada en `#alerta-rec-detalle`; la alerta visible es una sola (`#alerta`).
- El semáforo social usa `CONFIG.refEficiente` (80), `CONFIG.litrosOMS` (100) y `CONFIG.refAlto` (180) L/persona/día y vive en el panel `Social`.
- Las acciones secundarias (“Exportar PDF”, “Descargar gráfico PNG”, “Reiniciar casa”) están en el menú `#menu-acciones`, abierto con `#btn-acciones`.
- La paleta se agrupa por `GRUPOS_PALETA` (Baño · Cocina y lavandería · Casa y exterior); no añadir dispositivos fuera de esos grupos sin actualizar la lista.
- “Reiniciar casa” pide confirmación con `modalConfirm()` y recarga la página con el onboarding abierto.

## Simulador y tanque

- Modos de suministro: `normal` (red con presión baja, 0.3 L/min, 24 h), `tandeo` (6 L/min solo de 06–10 h y 18–22 h) y `corte` (sin entrada). Se seleccionan con `[data-modo-suministro]`.
- La bomba del tinaco toma agua de la red a 15 L/min. No hay cisterna ni segunda bomba.
- Control de bomba: `manual` (apagada por defecto) o `auto` (arranca al 20 % y se detiene al 100 %). Se selecciona con `[data-bomba-modo]`; el encendido manual usa `#sim-bomba-toggle`.
- La bomba se apaga sola al llenar el tinaco o si no hay suministro. En `tandeo` solo puede llenar dentro de sus franjas; en `corte` nunca.
- Constantes: `ENTRADA_RED_NORMAL_LMIN`, `ENTRADA_RED_TANDEO_LMIN`, `CAUDAL_BOMBA_LMIN` y `LIMITE_BOMBA`.
- Se conserva el selector de velocidad (1× a 21600×) en `#sim-vel`, dentro de la barra de sesión. No hay entradas técnicas de probabilidad de corte, factor de pico ni suministro extra.
- La barra de sesión muestra `#sim-estado-sesion` (Listo / En marcha / En pausa / Tanque vacío), `#sim-m-tiempo`, `#sim-play`, `#sim-reset` y `#sim-finalizar`. `renderEstadoSesion()` mantiene el estado.
- Los controles de suministro y bomba comparten la fila `.sim__fila`; los tres KPIs del simulador son nivel (`#sim-m-nivel`), consumo (`#sim-m-consumo`) y entrada (`#sim-m-entrada`).
- `#sim-m-franja` resume la franja de tandeo o el estado del suministro; balance, llenado, límite del 20 % y vaciado quedan en el `details` “Ver detalles de la simulación”.
- El nivel del tanque vive en `Sim` (fuera del Proxy para no repintar a 60 fps). Cada hora simulada conserva la integral diaria de `PESOS_HORA`.
- Con la red en presión baja el tinaco se vacía durante el uso normal; la bomba manual o automática lo recupera desde la red.
- Al quedar el tanque vacío sin entrada de agua, la simulación se pausa y muestra `#sim-aviso-vacio` con “Encender bomba” (`#sim-encender-bomba`) y “Seguir sin agua” (`#sim-seguir-sin-agua`). En automático el encendido es implícito y el botón manual se oculta.
- “Seguir sin agua” mantiene el tiempo avanzando con consumo real 0; los sensores también quedan en 0 hasta que vuelva el suministro.
- El resumen de la sesión solo se abre con `#sim-finalizar`.
- “Reiniciar simulación” (`simReiniciar()`) vuelve a llenar el tinaco, reinicia tiempo y consumo acumulado y apaga la bomba; conserva el modo de suministro y el modo de bomba.
- `mostrarResumenSimulacion()` usa `Sim.consumoAcumulado`, no `capacidad - nivel`, porque la bomba puede rellenar durante la sesión.
- `persistirSimulacion()` guarda nivel, tiempo, estado de marcha, `seguirSinAgua`, modo/estado de bomba y consumo acumulado al ocultar o cerrar la pestaña; al recargar se reanuda si estaba corriendo.

## Sensores IoT

- `renderSensores()` pinta una fila por habitación en `#sensores-lista` y actualiza el resumen del acordeón `#sensores-panel` (`#sensores-resumen`). El acordeón está cerrado por defecto para no saturar el simulador.
- `flujosPorHabitacion()` reparte el consumo real: fugas de forma continua y consumo humano según `PESOS_HORA`. La suma coincide con `simFlujos().consumo * 60` dentro del redondeo de una décima por habitación (≤ 0,001 L/min).
- Estados visuales: normal, hora pico, flujo anómalo (fuga), sin suministro y sin consumo.
- Con el tanque vacío todos los sensores muestran `0.00 L/min`; si la habitación tenía fuga, la etiqueta lo indica.

## Accesibilidad y navegación por teclado

- El onboarding atrapa el foco, valida con `aria-invalid`/`role="alert"` y no se puede cerrar con Escape.
- La guía de uso (`#modal-ayuda`) atrapa el foco con `trapaFoco()`, cierra con Escape, con el fondo o con sus botones, y devuelve el foco a `#btn-ayuda`.
- Las pestañas de vista y de diagnóstico usan `role="tab"`/`aria-selected`; el menú de acciones usa `aria-expanded` y cierra con Escape o clic fuera.
- Los elementos de la paleta (`.item`) son focables con Tab y activables con Enter/Space.
- Hay estilos `:focus-visible` con anillo verde esmeralda para elementos interactivos.
- La comparativa usa `role="progressbar"` con `aria-valuenow`/`aria-valuetext`; los sensores usan `role="status"`.
- Al cerrar la pestaña con cambios sin guardar se muestra una advertencia del navegador.

## Esquema de estado (`localStorage`)

Clave: `smartgota:estado:v3`

- `version`, `onboardingCompletado`, `perfil`, `habitantes`, `reciboM3`, `capacidad`
- `pisoActivo`, `siguienteId`, `siguienteSala`, `siguientePiso`
- `pisos`: arreglo de `[id, {id, nombre}]`
- `habitaciones`: arreglo de `[id, {id, nombre, piso, cx, cy, cs, rs}]`
- `dispositivos`: arreglo de `[id, {tipo, sala, fx, fy, uso_personalizado, frecuencia, modo, origen?}]`
- `simNivel`, `simTiempo`, `simCorriendo`, `simVelocidad`, `simModoSuministro`, `simSeguirSinAgua`
- `simBombaModo` (`manual` | `auto`), `simBombaEncendida`, `simConsumoAcumulado`
- `costoPorLitro`, `diasMes`

## Verificación

- Abrir `index.html` en el navegador y comprobar visualmente onboarding → “Mi casa” → diagnóstico → simulador.
- `npm run lint` para revisar `app.js` con ESLint.
- `npm run format:check` para revisar formateo con Prettier.
- Comprobar los paneles de diagnóstico (`Consumo`, `Recibo`, `Social`), que el gráfico vuelva a medir al regresar a `Consumo` y que el menú `#btn-acciones` abra/cierre con teclado y clic fuera.
- Comprobar la guía `#modal-ayuda`: abre, atrapa el foco, cierra con Escape y devuelve el foco.
- Comprobar la invariante de sensores: suma de caudales por habitación ≈ consumo real de la casa (tolerancia de redondeo ≤ 0,001 L/min).
- Comprobar la bomba: drenaje con `normal`, llenado manual, arranque automático al 20 %, paro al 100 % y bloqueo en `corte`/fuera de tandeo. En el tanque vacío: “Encender bomba” y “Seguir sin agua”.
- Revisar 360, 500, 768, 1244 y 1440 px sin desbordamiento horizontal (`document.documentElement.scrollWidth <= clientWidth`); en móvil la paleta usa dos columnas y el acordeón de sensores se mantiene cerrado.
- Si un cambio de CSS/JS no se ve, actualizar el parámetro `?v=18` o limpiar caché del navegador.

## Gotchas

- Código, comentarios y strings de UI en español.
- No añadir migraciones desde v1/v2: el onboarding debe crear una casa limpia.
- `localStorage` puede fallar (cupo lleno/bloqueado/modo privado): se muestra un aviso en pantalla y la app sigue funcionando sin guardar.
- No hay código generado, migraciones, codegen ni flujo de despliegue.
