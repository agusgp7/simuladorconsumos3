# Implementación del Motor de Análisis v1

## Alcance entregado

Se implementó la primera versión estable del Motor de Análisis como módulos JavaScript ES6+ ejecutables directamente en el navegador y compatibles con GitHub Pages.

El motor:

- recibe únicamente `NormalizedDataset/1.0`;
- valida el contrato antes de analizar;
- construye los 96 intervalos esperados de cada día;
- relaciona datos por punto, día, período y magnitud;
- calcula la potencia de cada observación AE mediante `kW = kWh × 4`;
- conserva duplicados y marca el intervalo como ambiguo;
- separa resultados observados de resultados confiables;
- calcula cobertura, totales y estadísticas;
- genera agregaciones diarias, mensuales, por ciclo de facturación, día de semana y perfiles de 96 períodos;
- conserva huecos, duplicados y cambios de origen sin afirmar relaciones causales.

No se modificó el diseño visual ni se agregó una interfaz de resultados.

## Archivos creados

- `js/analysis/contract.js`: contrato, adaptador y validación.
- `js/analysis/indexer.js`: serie temporal completa, asociación exacta y potencia.
- `js/analysis/statistics.js`: estadísticas y separación observado/confiable.
- `js/analysis/aggregations.js`: agregaciones calendario y de facturación.
- `js/analysis/analyzer.js`: orquestador público del motor.
- `tests/analysis-tests.html`: ejecutor de pruebas en navegador.
- `tests/analysis-tests.js`: pruebas sintéticas y prueba con el Excel real.
- `docs/contrato-analysis-result-v1.md`: contrato congelado.
- `docs/implementacion-motor-analisis-v1.md`: registro de esta entrega.

## Archivos modificados

- `index.html`: carga los cinco módulos del motor, sin cambiar la interfaz ni iniciar cálculos automáticamente.
- `README.md`: incorpora la estructura, alcance y ruta de pruebas del motor.

No se modificaron el importador, el parser, el validador, la interfaz ni los estilos.

## API pública

- `FileSimulator.analysis.fromImportAnalysis(importResult)`: crea el dataset normalizado de frontera.
- `FileSimulator.analysis.analyze(dataset, { billingCycleStartDay })`: devuelve `AnalysisResult/1.0`.

## Verificación con Hotel La Esmeralda

Configuración utilizada: inicio del ciclo de facturación en el día 3.

- Estado del importador: `ready-with-warnings`.
- Estado del motor: `partial`.
- Punto de medida: `7714990921`.
- Período: `2025-06-01` a `2026-05-31`.
- Intervalos esperados: `35.040`.
- AE: `34.924` observaciones, `116` intervalos faltantes, `0` ambiguos.
- Q1: `34.924` observaciones, `116` intervalos faltantes, `0` ambiguos.
- Completitud AE: `99,6689497716895 %`.
- Completitud Q1: `99,6689497716895 %`.
- Hueco AE: `2025-09-09T07:00:00` a `2025-09-10T12:00:00`.
- Hueco Q1: `2025-09-09T07:00:00` a `2025-09-10T12:00:00`.
- Cambio de origen: `PRIME → KAIFA` entre los intervalos informados por el importador.
- Relaciones causales declaradas: ninguna.
- Meses calendario: `12`.
- Ciclos de facturación con inicio día 3: `13`, incluidos los dos ciclos parciales de frontera.
- Primera observación AE: `3,132 kWh`.
- Potencia calculada para esa observación: `12,528 kW`.

## Casos automatizados cubiertos

- dataset completo;
- hueco AE sin valor inventado;
- duplicado AE con todas sus observaciones conservadas;
- energía y potencia canónicas nulas ante ambigüedad;
- separación de total observado y total confiable;
- ciclos configurables con cambio en el día 3;
- rechazo de días de inicio fuera de 1–28;
- rechazo de intervalos que contradicen el día y período normalizados;
- 96 posiciones en cada perfil horario;
- integración completa con Hotel La Esmeralda.

## Ejecución y pruebas

La aplicación no requiere instalación, compilación, npm, Node.js ni servidor.

1. Abrir `index.html` para verificar que el importador aprobado continúa funcionando.
2. Abrir `tests/analysis-tests.html`.
3. Confirmar que las pruebas sintéticas aparecen en verde.
4. En la sección Hotel La Esmeralda, seleccionar el Excel original.
5. Presionar `Ejecutar integración` y confirmar que todas las comprobaciones aparecen en verde.

En GitHub Pages se utilizan las mismas rutas relativas. El Excel real no debe incorporarse al repositorio público: se selecciona localmente desde el navegador.
