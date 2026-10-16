# SmartGota (TI2)

Simulador de consumo de agua de una vivienda. Proyecto web estático único (`index.html` + `styles.css` + `app.js`) desarrollado para el curso TI2.

## ¿Qué hace?

- Construir el plano de una vivienda con múltiples pisos y habitaciones redimensionables por celdas.
- Colocar dispositivos del catálogo (ducha, inodoro, lavabo, tina, lavadora, lavavajillas, grifo, aire lavado, filtro, fuga) y configurar su uso, frecuencia y modalidad de eficiencia.
- Ver el consumo por habitación con mapa de calor hídrico y gráfico de rosquilla.
- Validar el modelo simulado contra el recibo físico de SIMAS (Torreón, Coah.).
- Simular en tiempo real el vaciado/llenado del tanque con la red de agua, con horas pico de consumo y diferentes presiones de red.
- Exportar reportes en PDF y descargar el gráfico en PNG.

## Cómo ejecutar

Abrir `index.html` directamente en el navegador (`file://` funciona; no hay servidor que levantar).

Internet es necesario solo para el gráfico (Chart.js 4.4.4) y la exportación PDF (jspdf 2.5.1), cargados desde CDN. El resto funciona sin conexión.

## Herramientas de desarrollo (opcional)

El `package.json` solo contiene herramientas de desarrollo; no se requiere para ejecutar la app.

```bash
npm install            # instalar ESLint y Prettier
npm run lint           # revisar app.js con ESLint
npm run lint:fix       # autocorregir problemas de estilo
npm run format         # formatear código con Prettier
npm run format:check   # verificar formateo
```

## Persistencia

Todo el estado se guarda en `localStorage` con la clave `smartgota:estado:v2` y sobrevive a recargas. Para reiniciar desde cero, borrar esa clave en DevTools → Application → Local Storage.

Si existe un estado `v1` previo, se migra automáticamente a `v2` al cargar.

## Licencia

Proyecto educativo (TI2).
