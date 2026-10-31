# SmartGota (TI2)

Simulador educativo de consumo de agua de una vivienda. La app propone el flujo **“El Detective del Agua”**: crear una casa inicial, ver cuánto consume por tipo de aparato y simular cómo se vacía y se llena el tinaco a lo largo del día, cazando fugas sorpresa.

Es un proyecto web estático: `index.html` + `styles.css` + `dominio.js` + `app.js`. No requiere servidor, build ni backend; la interfaz y el código están en español.

## Cómo ejecutar

1. Abre `index.html` directamente en el navegador (`file://` funciona).
2. Si no existe una casa guardada, la app muestra el onboarding para crear una.
3. Para empezar de cero, usa **Reiniciar casa** en el menú **Más** de “Mi casa”. La app borra también los datos antiguos y vuelve a abrir el onboarding.

Internet solo es necesario para el gráfico (Chart.js) y la exportación PDF (jsPDF), que se cargan desde CDN. El resto funciona sin conexión.

## Qué puedes hacer

- Crear una vivienda inicial eligiendo el tamaño (Compacta, Estándar o Amplia): la casa nace con personas y capacidad del tinaco ya preconfiguradas y fijas (no se editan).
- Ver el plano de la casa (inmutable): pisos, habitaciones y dispositivos vienen de la plantilla según el tamaño elegido.
- Consultar el catálogo de dispositivos (ducha, inodoro, lavabo, tina, lavadora, lavavajillas, filtro, grifo, aire lavado y fugas) y cambiar la eficiencia de cada aparato del plano; el consumo se estima según el tamaño de la vivienda, el tipo de habitación y la eficiencia.
- Revisar el consumo por tipo de dispositivo, el mayor gasto y el porcentaje del tinaco.
- Simular el suministro de agua y el tinaco en tiempo real.
- Revisar sensores virtuales de flujo por habitación.
- Exportar un reporte PDF o descargar el gráfico como PNG.

## Las dos vistas

### Mi casa

Reúne el resumen, el constructor y el diagnóstico:

- **Resumen:** consumo diario (con su equivalente mensual) y pérdida por fugas. Personas y capacidad del tinaco se muestran fijas, definidas por el tipo de vivienda.
- **Constructor:** catálogo informativo de dispositivos agrupado en **Baño**, **Cocina y lavandería** y **Casa y exterior**, y el plano inmutable con pisos, habitaciones y dispositivos; el color de cada habitación indica su consumo.
- **Diagnóstico:** vista única, sin pestañas: mayor consumo, porcentaje del tinaco, consumo mensual, y la dona de consumo por tipo de dispositivo con su lista del mismo color (la dona no lleva leyenda aparte).
- **Acciones:** el menú “Más” permite exportar PDF, descargar el gráfico PNG y reiniciar la casa.

La recomendación principal aparece plegada para no saturar la pantalla. El botón **Simular el día** cambia a la vista del simulador.

### Simulador

- **Suministro:** `Normal` (presión baja casi todo el día), `Tandeo` (agua solo de 06–10 h y 18–22 h) o `Corte` (sin entrada). Suministro, bomba y fugas viven en una sola banda de control, con el estado del agua al pie.
- **Bomba del tinaco:** un interruptor. Encendida, arranca sola al 20 % y se detiene al llenar; toma 15 L/min de la red. Apagada, el tinaco solo recibe la presión del suministro. El botón “?” explica el ciclo.
- **Tanque:** vaso con marcas de nivel cada 25 % y la línea del 20 %, con las tres cifras (nivel, consumo y entrada) pegadas debajo. La simulación se puede iniciar, pausar, reiniciar o finalizar.
- **Velocidad:** de 1× a 21600× para recorrer el día simulado.
- **Fugas sorpresa:** un interruptor en el simulador esconde una o dos fugas en aparatos al azar; el botón “?” explica cómo funciona y apagarlo deja una corrida limpia.
- **Hallazgo:** la primera anomalía abre los sensores y marca el aparato en el plano; el resumen de sesión lista la fuga, lo perdido y un botón para verla.
- **Sensores:** fila por habitación con flujo normal, hora pico, fuga, sin suministro o sin consumo.
- **Tanque vacío:** si no hay entrada de agua, la simulación se pausa. Puedes activar la bomba (si hay suministro) o seguir sin agua para observar el corte.
- **Resumen de sesión:** se abre con **Finalizar** y usa el consumo acumulado, no solo la diferencia de nivel del tanque.

## Onboarding y plantillas

El onboarding es de selección directa: muestra solo tres tarjetas de vivienda (Compacta, Estándar, Amplia) y, al elegir una, crea la casa al instante con valores preconfigurados:

- **Personas:** 2, 4 o 5 según el tamaño.
- **Capacidad del tinaco:** según la cantidad de personas.

La casa inicial se genera con una plantilla. El tamaño define tanto la vivienda inicial como los promedios de consumo: minutos de ducha, descargas del inodoro, cargas de lavadora o lavavajillas, etc. No se piden esos valores por dispositivo. Al tocar un dispositivo se abre una ficha con el cálculo estimado y un selector de eficiencia. Si cambias las personas, los usos se recalculan: cada uso (ducha, inodoro, lavabo de baño) es una sola cuota para la casa que se reparte entre los aparatos según el rol de su baño (principal, secundario o medio); el lavabo de cocina es un uso aparte del hogar.

Cada habitación guarda su tipo (recámara, baño, cocina, sala, comedor, lavandería, patio, estudio) y su rol (principal, secundario o medio en los baños). El nombre es solo una etiqueta: el cálculo del consumo depende del tipo y del rol, no de cómo se llame la habitación.

La capacidad del tinaco es fija por vivienda: Compacta 450 L, Estándar 750 L, Amplia 1100 L. El consumo mensual estimado usa 30 días por defecto.

## Persistencia

Todo el estado se guarda en `localStorage` con la clave:

```text
smartgota:estado:v3
```

- Los cambios se guardan automáticamente.
- La simulación guarda nivel, tiempo, consumo acumulado y estado de bomba al ocultar o cerrar la pestaña.
- Si no hay un `v3` válido, se abre el onboarding; los datos de `v1` o `v2` no se migran.
- Un `v3` anterior con perfil de vivienda (`basica`, `familiar` o `amplia`) se normaliza al tamaño equivalente (`bajo`, `medio` o `alto`); al cargar, todos los dispositivos sincronizan su uso y frecuencia con los promedios del tamaño y los contextos de la habitación.
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
npm run lint           # revisar app.js y dominio.js
npm run lint:fix       # autocorregir problemas de estilo
npm test               # tests del núcleo de cálculo (node --test)
npm run format         # formatear app.js, dominio.js, styles.css e index.html
npm run format:check   # verificar formateo
```

Si un cambio de CSS o JavaScript no se ve en el navegador, actualiza el parámetro `?v=49` de los assets o limpia la caché.

## Verificación manual

- Completar el onboarding y comprobar que se crea la casa inicial.
- Verificar que personas y tinaco aparecen fijos según el tamaño elegido (2/4/5 personas · 450/750/1100 L) y que no hay inputs editables ni indicador de recibo.
- Revisar el diagnóstico: dona y lista de consumo por tipo de dispositivo, sin pestañas.
- Revisar el catálogo de dispositivos (icono, flujo base y descripción) y tocar un aparato del plano para abrir su ficha y cambiar la eficiencia.
- Revisar el menú **Más** con teclado y ratón, y la guía de uso con Escape.
- Probar los modos de suministro, el interruptor de la bomba y el tanque vacío.
- Comprobar que la suma de los sensores por habitación coincide con el consumo real dentro del redondeo. Cada fila muestra el estado en una píldora corta (`Normal`, `Pico`, `Anómalo`) y el número usa el mismo formato que el resto (`1,133 L`).
- Recargar la página y confirmar que se conserva la casa y la simulación.
- Usar **Reiniciar casa**, confirmar y verificar que vuelve el onboarding sin recrear la casa anterior.
- Revisar 360, 500, 768, 1244 y 1440 px sin desbordamiento horizontal.

## Alcance y notas

- Es un modelo educativo; no sustituye una medición real.
- La bomba y el tinaco están simplificados. No hay cisterna ni segunda bomba.
- Los tiempos de “se llena” o “se vacía” son de la vivienda simulada, no del reloj real.
- El gráfico y el PDF requieren conexión a internet para cargar sus librerías desde CDN.

## Licencia

Proyecto educativo (TI2).
