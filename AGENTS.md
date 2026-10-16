# SmartGota (TI2) — instrucciones para agentes

## Qué es
Proyecto web estático único: `index.html` + `styles.css` + `app.js` (~1985 líneas, todo en español). Simulador de consumo de agua de una vivienda. No es monorepo, no hay paso de build, tests, tipado ni CI. Se añade `package.json` solo como contenedor de herramientas de desarrollo (ESLint, Prettier); no se requiere para ejecutar la app. Ver `../AGENTS.md` para el panorama de toda la colección.

## Cómo ejecutar
- Abrir `index.html` directamente en el navegador (`file://` funciona; no hay servidor que levantar).
- Internet necesario solo para el gráfico (Chart.js 4.4.4) y la exportación PDF (jspdf 2.5.1), cargados desde CDN en `<script defer>`. El resto funciona sin conexión.
- Herramientas de desarrollo (opcional): `npm install` para instalar ESLint/Prettier; `npm run lint` / `npm run lint:fix` para analizar `app.js`; `npm run format` / `npm run format:check` para formatear código.

## Estado y persistencia
- `app.js` guarda todo en `localStorage` con la clave `smartgota:estado:v2`; sobrevive a recargas. Para reiniciar desde cero, borrar esa clave en DevTools → Application → Local Storage.
- Si existe un estado `v1` previo, se migra automáticamente a `v2` al cargar.
- Si `localStorage` falla (cupo lleno/bloqueado/modo privado), se muestra un aviso discreto en pantalla y la app sigue funcionando sin guardar.
- Sin estado válido, `cargarEstado()` siembra la casa de ejemplo ("Planta Baja" con Cocina, Baño, Salón).
- El estado es un `Proxy`: cualquier cambio repinta el dashboard y guarda en un `queueMicrotask` (un solo repintado y un solo guardado por evento). No añadir listeners que luchen contra ese ciclo.
- El estado de la simulación (nivel, tiempo, velocidad, red, patrón, corriendo) se persiste en `localStorage` y se restaura al recargar.

## Entrada y arranque
- Punto de entrada: `index.html`; el script es `app.js?v=13` (defer).
- Últimas líneas de `app.js`: `construirPaleta(); cargarEstado(); simReiniciar();` — la restauración de `localStorage` ocurre antes de arrancar la simulación.
- Cambiar de pestaña solo alterna `hidden`; los nodos del DOM (y el tamaño dejado por un resize) se mantienen vivos.

## Verificación
- Verificar abriendo `index.html` en el navegador y comprobando visualmente.
- Ejecutar `npm run lint` para revisar `app.js` con ESLint.
- Ejecutar `npm run format:check` para revisar formateo con Prettier.
- Los assets llevan `?v=13`; si un cambio de CSS/JS no se ve, actualizar el parámetro o limpiar caché del navegador.

## Configuración (UI)
- Costo por litro, días por mes, patrón de consumo y factor de pico son ajustables desde el dashboard.
- Patrón "personalizado" permite definir un multiplicador para las horas pico (06-09, 13-15, 19-22).

## Gotchas
- Código, comentarios y strings de UI en español.
- `localStorage` puede fallar silenciosamente (cupo lleno/bloqueado): la app sigue funcionando sin guardar.
- No hay código generado, migraciones, codegen ni flujo de despliegue.
