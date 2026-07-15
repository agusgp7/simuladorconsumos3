# Contrato del Motor de Análisis — AnalysisResult v1

## Estado del contrato

- Contrato: `AnalysisResult/1.0`.
- Dataset de entrada: `NormalizedDataset/1.0`.
- Motor: `1.0.0`.
- Estado: congelado para la primera versión del Motor de Análisis.

El motor opera exclusivamente sobre datos normalizados. No conoce archivos, hojas, columnas, SheetJS, controles de interfaz ni el DOM.

## Límite entre importación y análisis

`FileSimulator.analysis.fromImportAnalysis(importResult)` es el adaptador de frontera. Copia únicamente:

- punto de medida;
- rango normalizado;
- registros normalizados;
- magnitudes;
- diagnósticos de calidad ya detectados;
- nombre informativo de la fuente, cuando existe.

El resultado es un `NormalizedDataset/1.0`. El análisis se ejecuta mediante:

`FileSimulator.analysis.analyze(dataset, { billingCycleStartDay })`

`billingCycleStartDay` es obligatorio y admite enteros del 1 al 28. Este límite evita reglas implícitas sobre meses que no contienen los días 29, 30 o 31. Ampliarlo requerirá definir explícitamente una política de cierre de mes y una nueva revisión del contrato.

## Reglas invariantes

- La clave lógica de un intervalo es `punto + día + período`.
- Una medición se identifica por `punto + día + período + magnitud`.
- Nunca se relacionan observaciones por cercanía ni posición de fila.
- Existen 96 períodos diarios de 15 minutos.
- AE se expresa en `kWh` y representa la energía activa consumida en el intervalo.
- Q1 se expresa en `kvarh` y representa la energía reactiva del mismo intervalo.
- La potencia demandada del intervalo se expresa en `kW` y se calcula como `AE × 4`.
- No se completan, interpolan, corrigen, eliminan ni inventan mediciones.
- Los cambios de origen y los huecos se conservan como hechos independientes. El motor no atribuye causalidad.

## Política de duplicados

Cada medición contiene `observations`, que conserva todas las observaciones recibidas.

- Sin observaciones: `isMissing = true` y `value = null`.
- Una observación: `value` contiene el valor canónico.
- Más de una observación: `isAmbiguous = true` y `value = null`.

La potencia aplica la misma política:

- `observationsKW` contiene el cálculo `AE × 4` para cada observación AE;
- `valueKW` existe solamente cuando hay una única observación AE;
- ante un duplicado AE, `valueKW = null`.

Los resúmenes separan siempre:

- `observedTotal`: suma de todas las observaciones, incluidos duplicados;
- `reliableTotal`: suma exclusiva de intervalos con una observación;
- `observationCount`;
- `reliableIntervalCount`;
- `ambiguousIntervalCount`.

La suma observada permite auditoría, pero no se presenta como resultado confiable.
Cuando no existe ninguna observación aplicable, los totales y sumas estadísticas son `null`, no cero.

## Estados del resultado

- `complete`: AE y Q1 cubren todos los intervalos y no existen ambigüedades.
- `partial`: falta al menos un AE o Q1, o Q1 no está disponible; el cálculo posible se conserva sin inventar datos.
- `ambiguous`: existe al menos un intervalo duplicado en alguna magnitud.
- `invalid-input`: el dataset o la configuración incumplen el contrato y no se analiza.

`ambiguous` tiene prioridad sobre `partial` para hacer visible el riesgo de escoger valores duplicados.

## Organización de AnalysisResult v1

### `meta`

- `schemaVersion`: versión del contrato de salida.
- `engineVersion`: versión del motor.
- `datasetSchemaVersion`: versión de la entrada.
- `generatedAt`: instante de generación en ISO 8601.

### `status` y `config`

- `status`: uno de los cuatro estados definidos.
- `config.billingCycleStartDay`: día de inicio aplicado a los períodos de facturación.

### `subject`

- punto de medida;
- duración del intervalo;
- cantidad de períodos diarios;
- rango completo del dataset;
- unidades explícitas para AE, Q1 y potencia.

### `capabilities`

Indica qué datos y cálculos están disponibles. La simulación tarifaria permanece expresamente deshabilitada en esta etapa.

### `coverage`

Para cada magnitud y para potencia informa:

- intervalos esperados;
- observaciones recibidas;
- intervalos presentes;
- intervalos confiables;
- intervalos faltantes;
- intervalos ambiguos;
- porcentaje de completitud;
- porcentaje de cobertura confiable.

La completitud cuenta un intervalo ambiguo como presente. La cobertura confiable exige exactamente una observación.

### `intervalSeries`

Contiene un elemento por cada intervalo esperado, incluso cuando falta la medición. Cada elemento incluye:

- clave lógica, punto, día y período;
- inicio y fin normalizados;
- día de semana y clasificación neutral `weekday` o `weekend`;
- mediciones por magnitud;
- potencia demandada;
- indicadores `isAmbiguous` e `isReliable`.

No contiene clasificación Punta, Llano, Valle, feriados ni eventos de consumo.

### `totals`

Totales observados y confiables para cada magnitud. No suma valores de potencia, porque sumar kW de intervalos no constituye una magnitud energética válida.

### `statistics`

Para cada magnitud y para potencia devuelve estadísticas observadas y confiables:

- cantidad;
- suma;
- mínimo;
- máximo;
- media;
- mediana;
- percentil 95 con interpolación lineal;
- desviación estándar poblacional.

### `aggregations`

- `daily`: un grupo por día.
- `calendarMonthly`: meses calendario.
- `billingPeriods`: ciclos definidos por `billingCycleStartDay`.
- `byDayOfWeek`: agrupación neutral por día de semana.
- `averageProfile96`: perfil por período sobre todos los días.
- `weekdayProfile96`: perfil por período para lunes a viernes.
- `weekendProfile96`: perfil por período para sábado y domingo.

Cada período mensual o de facturación informa tanto el rango completo que le corresponde como la intersección cubierta por el dataset. `isBoundaryPartial` permite distinguir los períodos incompletos de los extremos sin inventar observaciones fuera del rango importado.

### `quality`

Conserva issues, huecos, duplicados y cambios de origen detectados durante la importación. Además fija:

- `causalRelationships: []`;
- `originChangesAreIndependentFromGaps: true`.

### `diagnostics`

Lista estructurada de errores, advertencias e información generados por el motor. Un `invalid-input` devuelve diagnósticos y deja vacías las secciones analíticas.

## Módulos

- `js/analysis/contract.js`: versiones, adaptador y validación de entrada.
- `js/analysis/indexer.js`: índice por clave lógica, serie completa y potencia por intervalo.
- `js/analysis/statistics.js`: estadísticas y separación observado/confiable.
- `js/analysis/aggregations.js`: agregaciones temporales y ciclos configurables.
- `js/analysis/analyzer.js`: orquestación y construcción de `AnalysisResult v1`.

Ningún módulo modifica el dataset recibido.

## Fuera de alcance

- detección de saltos, consumos bajos u otros eventos;
- gráficos e interfaz de resultados;
- Punta, Llano y Valle;
- simulación y comparación tarifaria;
- exportaciones y reportes;
- persistencia, autenticación y backend.
