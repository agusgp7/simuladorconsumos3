# FileSimulator — Implementación vertical del módulo de importación

> Documento histórico de la implementación React/Vite descartada. La versión vigente es `implementacion-modulo-importacion-estatico-v0.2.md` y no requiere compilación, Node.js ni servidor.

**Implementación:** 0.1  
**Especificación aplicada:** 0.3  
**Fecha:** 15 de julio de 2026

## 1. Resultado

Se implementó el recorrido completo desde la selección de un `.xlsx` hasta la confirmación de un dataset normalizado. El archivo se lee en memoria en el navegador y el trabajo intensivo se ejecuta en un Web Worker para no bloquear la interfaz.

La etapa termina al entregar registros normalizados y diagnósticos. No contiene gráficos, cálculo de potencia, Punta/Llano/Valle, tarifas, reportes, persistencia, autenticación ni backend.

## 2. Criterios de severidad aplicados

### Error bloqueante

Impide continuar porque no puede construirse con seguridad el dataset mínimo:

- archivo vacío, ilegible, cifrado, dañado o distinto de `.xlsx`;
- ninguna hoja `Measures`, o más de una coincidencia compatible;
- encabezado obligatorio ausente o duplicado;
- hoja sin filas de datos;
- ningún registro AE utilizable;
- más de un punto de medida;
- cualquier código `INTERVALO` distinto de `QH`;
- imposibilidad estructural de interpretar los datos temporales.

### Advertencia

Permite continuar con confirmación explícita si todavía existe AE utilizable y no hay bloqueantes:

- fila con punto, fecha, período, magnitud o valor inválido;
- `RESULT VALIDACION` distinto de `VALID`;
- desacuerdo entre `FECHA-HORA` y `PERIODO`;
- huecos y cobertura parcial;
- duplicados exactos o conflictivos, conservados sin cambios;
- registros fuera de orden;
- valores negativos;
- magnitudes desconocidas;
- ausencia de Q1;
- cambios o conflictos de `ORIGEN`.

### Información

Describe hechos o normalizaciones no destructivas:

- archivo y hoja inspeccionados localmente;
- valores cero válidos y conservados;
- normalización de `PERIODO 96`: se conserva `23:59` como timestamp original y se deriva `23:45–24:00`.

No se usa un porcentaje arbitrario de filas defectuosas para bloquear.

## 3. Arquitectura implementada

- **Dominio (`src/domain/import`)**: contiene tipos, constantes, interpretación temporal y reglas de calidad sin dependencias de React ni Excel.
- **Adaptador XLSX (`src/infrastructure/xlsx`)**: abre el libro, localiza `Measures`, detecta encabezados por nombre exacto normalizado y transforma filas hacia el dominio.
- **Web Worker (`src/workers`)**: aísla la lectura y validación de libros grandes del hilo de la interfaz.
- **Interfaz (`src/features/file-import`)**: administra carga, progreso, resumen, vista previa, diagnósticos, confirmación y descarte.

La asociación lógica siempre usa `PUNTO MEDIDA + día + PERIODO + MAGNITUD`. No se relacionan AE y Q1 por proximidad entre filas.

## 4. Comportamiento implementado

- Selección y arrastre de un `.xlsx`.
- Lectura completa y exclusivamente local.
- Detección de una hoja `Measures` y de los ocho encabezados, aunque cambie el orden de columnas.
- Normalización independiente de zona horaria mediante fecha civil, día y período.
- AE obligatoria; Q1 opcional.
- Solo las filas `VALID` entran al dataset utilizable.
- Detección de fechas y horas inválidas, períodos inválidos, valores no numéricos, códigos distintos de QH y magnitudes desconocidas.
- Detección de huecos recorriendo los 96 períodos diarios por magnitud.
- Detección de duplicados exactos y conflictivos sin eliminar, combinar, promediar ni priorizar filas.
- Detección de desorden temporal y cambios de origen.
- Registro separado de huecos y cambios de origen, sin atribuir causalidad.
- Resumen de filas, puntos, fechas, magnitudes, completitud, validaciones, orígenes, duplicados y valores cero.
- Vista previa de los cinco primeros y cinco últimos registros válidos.
- Distribución de registros por `PERIODO` del 1 al 96.
- Filtro de diagnósticos por severidad.
- Confirmación explícita para continuar con advertencias.
- Cancelación o descarte que termina el worker y elimina el dataset pendiente de la memoria de la interfaz.

## 5. Archivos creados

| Área | Archivos | Responsabilidad |
| --- | --- | --- |
| Configuración | `package.json`, `package-lock.json`, `tsconfig*.json`, `vite.config.ts`, `index.html`, `.gitignore` | Aplicación, compilación y pruebas |
| Dominio | `src/domain/import/constants.ts`, `types.ts`, `dateTime.ts`, `analyzeTable.ts` | Contrato normalizado y reglas de calidad |
| Excel | `src/infrastructure/xlsx/processWorkbook.ts` | Detección y lectura del formato UTE |
| Worker | `src/workers/import.worker.ts` | Procesamiento en segundo plano |
| Interfaz | `src/features/file-import/*.tsx`, `src/App.tsx`, `src/main.tsx`, `src/styles.css` | Recorrido visible y accesible |
| Pruebas | `tests/dateTime.test.ts`, `analyzeTable.test.ts`, `hotel-la-esmeralda.integration.test.ts` | Reglas críticas y archivo real |

No se modificó el Excel original.

## 6. Resultado con Hotel La Esmeralda

Archivo probado: 2.697.321 bytes y 69.848 filas de datos.

| Comprobación | Resultado |
| --- | ---: |
| Hoja detectada | `Measures` |
| Puntos de medida | 1 |
| AE válidos | 34.924 |
| Q1 válidos | 34.924 |
| Esperados por magnitud | 35.040 |
| Faltantes AE | 116 |
| Faltantes Q1 | 116 |
| Completitud AE | 99,67 % |
| Duplicados | 0 |
| Valores negativos | 0 |
| Valores cero | 6 (3 AE y 3 Q1) |

Hueco detectado por separado para AE y Q1:

- inicio: **9 de septiembre de 2025, 07:00**;
- fin: **10 de septiembre de 2025, 12:00**;
- extensión: **116 intervalos de 15 minutos por magnitud**.

Cambio de origen informado:

- último cierre de `PRIME`: **9 de septiembre de 2025, 07:00**;
- primer inicio de `KAIFA`: **10 de septiembre de 2025, 12:00**.

El diagnóstico presenta el hueco y el cambio de origen como dos hechos. No afirma que uno haya causado al otro.

## 7. Pruebas ejecutadas

- Suite normal: 5 pruebas aprobadas; la integración real queda omitida si no se proporciona `HOTEL_XLSX_PATH`.
- Integración con Hotel La Esmeralda: 1 prueba aprobada; procesamiento y aserciones en 5,84 s en el entorno de desarrollo.
- Compilación de producción: TypeScript y Vite completaron correctamente.

Las aserciones de integración fijan las cantidades, el rango exacto del hueco, la ausencia de duplicados y la transición PRIME→KAIFA. Un cambio accidental en esas reglas hace fallar la prueba.

## 8. Decisiones y límites técnicos

- No se fijó todavía un límite arbitrario de tamaño: la implementación está verificada con 2,7 MB y casi 70.000 filas. Antes de admitir archivos mucho mayores debe definirse el límite mediante pruebas en las computadoras objetivo.
- Los ejemplos de cada tipo de problema se limitan para mantener legible la interfaz, mientras el contador conserva el total detectado.
- El botón de continuación confirma el dataset en memoria; el dashboard de análisis corresponde a la siguiente etapa.
- Los cambios futuros deben mantener pequeñas las modificaciones y conservar estas pruebas como red de seguridad.
