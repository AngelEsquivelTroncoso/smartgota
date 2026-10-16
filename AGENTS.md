# SmartGota (TI2) — instrucciones para agentes

## Qué es
Proyecto web estático único: `index.html` + `styles.css` + `app.js` (~1985 líneas, todo en español). Simulador de consumo de agua de una vivienda. No es monorepo, no hay `package.json`, ni paso de build, tests, linter, formateador, tipado ni CI. Ver `../AGENTS.md` para el panorama de toda la colección.

## Cómo ejecutar
- Abrir `index.html` directamente en el navegador (`file://` funciona; no hay servidor que levantar).
- Internet necesario solo para el gráfico (Chart.js 4.4.4) y la exportación PDF (jspdf 2.5.1), cargados desde CDN en `<script defer>`. El resto funciona sin conexión.

## Estado y persistencia
- `app.js` guarda todo en `localStorage` con la clave `smartgota:estado:v1`; sobrevive a recargas. Para reiniciar desde cero, borrar esa clave en DevTools → Application → Local Storage.
- Sin estado válido, `cargarEstado()` siembra la casa de ejemplo ("Planta Baja" con Cocina, Baño, Salón).
- El estado es un `Proxy`: cualquier cambio repinta el dashboard y guarda en un `queueMicrotask` (un solo repintado y un solo guardado por evento). No añadir listeners que luchen contra ese ciclo.

## Entrada y arranque
- Punto de entrada: `index.html`; el script es `app.js?v=13` (defer).
- Últimas líneas de `app.js`: `construirPaleta(); cargarEstado(); simReiniciar();` — la restauración de `localStorage` ocurre antes de arrancar la simulación.
- Cambiar de pestaña solo alterna `hidden`; los nodos del DOM (y el tamaño dejado por un resize) se mantienen vivos.

## Verificación
- No hay comandos de test/lint/build. Verificar abriendo `index.html` en el navegador y comprobando visualmente. No inventar `npm`/`yarn`.
- Los assets llevan `?v=13`; si un cambio de CSS/JS no se ve, actualizar el parámetro o limpiar caché del navegador.

## Gotchas
- Código, comentarios y strings de UI en español.
- `localStorage` puede fallar silenciosamente (cupo lleno/bloqueado): la app sigue funcionando sin guardar.
- No hay código generado, migraciones, codegen ni flujo de despliegue.
