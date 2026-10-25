# SmartGota (TI2)

Simulador educativo de consumo de agua de una vivienda. La app propone el flujo **“El Detective del Agua”**: crear una casa inicial, comparar el consumo estimado contra el recibo mensual y simular cómo se vacía y se llena el tinaco a lo largo del día.

Es un proyecto web estático: `index.html` + `styles.css` + `app.js`. No requiere servidor, build ni backend; la interfaz y el código están en español.

## Cómo ejecutar

1. Abre `index.html` directamente en el navegador (`file://` funciona).
2. Si no existe una casa guardada, la app muestra el onboarding para crear una.
3. Para empezar de cero, usa **Reiniciar casa** en el menú **Más** de “Mi casa”. La app borra también los datos antiguos y vuelve a abrir el onboarding.

Internet solo es necesario para el gráfico (Chart.js) y la exportación PDF (jsPDF), que se cargan desde CDN. El resto funciona sin conexión.

## Qué puedes hacer

- Crear una vivienda inicial con habitantes, recibo mensual y perfil de vivienda (básica, familiar o amplia).
- Construir el plano con varios pisos y habitaciones redimensionables.
- Colocar y configurar dispositivos como ducha, inodoro, lavabo, tina, lavadora, lavavajillas, filtro, grifo, aire lavado y fugas.
- Comparar los m³ estimados por el plano contra los m³ reales del recibo.
- Revisar el consumo por habitación, el límite OMS y el consumo por persona.
- Simular el suministro de agua y el tinaco en tiempo real.
- Revisar sensores virtuales de flujo por habitación.
- Exportar un reporte PDF o descargar el gráfico como PNG.

## Las dos vistas

### Mi casa

Reúne el resumen, el constructor y el diagnóstico:

- **Resumen:** consumo diario, diferencia contra el recibo y costo mensual. Desde aquí se editan las personas, el recibo, la capacidad del tinaco, la tarifa y los días del mes.
- **Constructor:** paleta agrupada en **Baño**, **Cocina y lavandería** y **Casa y exterior**; plano con pisos, habitaciones y dispositivos; el color de cada habitación indica su consumo.
- **Diagnóstico:** tres pestañas internas:
  - **Consumo:** gráfico de consumo por habitación y lista de las habitaciones con más consumo.
  - **Recibo:** comparación entre los m³ estimados y el recibo real (±15 %), costo diario y diferencia mensual.
  - **Social:** consumo por persona y referencias de 80, 100 y 180 L/persona/día.
- **Acciones:** el menú “Más” permite exportar PDF, descargar el gráfico PNG y reiniciar la casa.

La recomendación principal aparece plegada para no saturar la pantalla. El botón **Simular el día** cambia a la vista del simulador.

### Simulador

- **Suministro:** `Normal` (presión baja casi todo el día), `Tandeo` (agua solo de 06–10 h y 18–22 h) o `Corte` (sin entrada).
- **Bomba del tinaco:** manual o automática. La automática arranca al 20 % y se detiene al 100 %; toma 15 L/min de la red.
- **Tanque:** nivel, consumo de la casa y entrada de agua. La simulación se puede iniciar, pausar, reiniciar o finalizar.
- **Velocidad:** de 1× a 21600× para recorrer el día simulado.
- **Sensores:** fila por habitación con flujo normal, hora pico, fuga, sin suministro o sin consumo.
- **Tanque vacío:** si no hay entrada de agua, la simulación se pausa. Puedes encender la bomba (si hay suministro) o seguir sin agua para observar el corte.
- **Resumen de sesión:** se abre con **Finalizar** y usa el consumo acumulado, no solo la diferencia de nivel del tanque.

## Onboarding y plantillas

El onboarding pide tres datos:

- Personas que viven en la casa (1–50).
- m³ del último recibo mensual.
- Perfil de vivienda: básica, familiar o amplia.

La casa inicial se genera con una plantilla. La capacidad sugerida del tinaco es 450 L (1–2 personas), 750 L (3–4), 1100 L (5–6) y 2500 L (7+). El recibo se interpreta como consumo mensual; por defecto se usan 30 días.

## Persistencia

Todo el estado se guarda en `localStorage` con la clave:

```text
smartgota:estado:v3
```

- Los cambios se guardan automáticamente.
- La simulación guarda nivel, tiempo, consumo acumulado y estado de bomba al ocultar o cerrar la pestaña.
- Si no hay un `v3` válido, se abre el onboarding; los datos de `v1` o `v2` no se migran.
- Para reiniciar de forma soportada, usa **Reiniciar casa**. Borrar la clave con la pestaña abierta puede no ser suficiente: la simulación se vuelve a guardar al recargar o cerrar.
- Si `localStorage` no está disponible (modo privado, cupo lleno o bloqueado), la app sigue funcionando en memoria y muestra un aviso.
- Los datos no salen del navegador.

## Estructura del proyecto

```text
TI2/
├── index.html      # Estructura, vistas, modales y controles
├── styles.css      # Tema visual y estilos responsive
├── app.js          # Estado, plantillas, constructor, diagnóstico y simulación
├── package.json    # Solo ESLint y Prettier de desarrollo
├── AGENTS.md       # Instrucciones para agentes que trabajen en el proyecto
└── README.md       # Este documento
```

No hay código compartido con otras carpetas del repositorio, ni paso de build, tests, tipado o CI.

## Herramientas de desarrollo (opcional)

```bash
npm install            # instalar ESLint y Prettier
npm run lint           # revisar app.js
npm run lint:fix       # autocorregir problemas de estilo
npm run format         # formatear app.js, styles.css e index.html
npm run format:check   # verificar formateo
```

Si un cambio de CSS o JavaScript no se ve en el navegador, actualiza el parámetro `?v=19` de los assets o limpia la caché.

## Verificación manual

- Completar el onboarding y comprobar que se crea la casa inicial.
- Cambiar personas, recibo, tinaco, tarifa y días del mes; verificar que los KPIs y el diagnóstico se actualicen.
- Probar las pestañas **Consumo**, **Recibo** y **Social**.
- Arrastrar o tocar un dispositivo de la paleta y colocarlo en una habitación; comprobar que se abre el editor.
- Revisar el menú **Más** con teclado y ratón, y la guía de uso con Escape.
- Probar los modos de suministro, la bomba manual/automática y el tanque vacío.
- Comprobar que la suma de los sensores por habitación coincide con el consumo real dentro del redondeo.
- Recargar la página y confirmar que se conserva la casa y la simulación.
- Usar **Reiniciar casa**, confirmar y verificar que vuelve el onboarding sin recrear la casa anterior.
- Revisar 360, 500, 768, 1244 y 1440 px sin desbordamiento horizontal.

## Alcance y notas

- Es un modelo educativo; no sustituye una medición real ni un recibo oficial.
- La bomba y el tinaco están simplificados. No hay cisterna ni segunda bomba.
- Los tiempos de “se llena” o “se vacía” son de la vivienda simulada, no del reloj real.
- El gráfico y el PDF requieren conexión a internet para cargar sus librerías desde CDN.

## Licencia

Proyecto educativo (TI2).
