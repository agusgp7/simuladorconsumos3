# FileSimulator — Importador estático v0.2

**Especificación funcional:** 0.3  
**Plataforma:** HTML5, CSS3 y JavaScript ES6+  
**Destino:** apertura directa y GitHub Pages  
**Fecha:** 15 de julio de 2026

## Alcance implementado

- Selección y arrastre de un `.xlsx`.
- Nombre, tamaño y progreso del archivo.
- Detección de una única hoja `Measures` y sus ocho encabezados en cualquier orden.
- Normalización de fechas, períodos 1–96, intervalos y valores.
- Excepción `PERIODO 96`: timestamp original 23:59 e intervalo 23:45–24:00.
- AE obligatoria, Q1 opcional y solo `RESULT VALIDACION = VALID` utilizable.
- Asociación por punto, día, período y magnitud.
- Detección de huecos, duplicados, intervalos irregulares, fechas inválidas, valores no numéricos, magnitudes desconocidas, desorden y cambios de origen.
- Conservación de duplicados y valores existentes sin correcciones.
- Resumen, completitud, período, puntos, magnitudes, procedencia, diagnósticos y vista previa.
- Confirmación ante advertencias, cancelación y descarte de memoria.

## Severidades

- **Bloqueante:** archivo ilegible o incompatible, estructura ambigua, encabezados inválidos, varios puntos, intervalo diferente de QH o ninguna AE válida.
- **Advertencia:** filas descartadas, huecos, duplicados, desorden, negativos, magnitudes desconocidas, Q1 ausente y cambios de origen.
- **Información:** lectura local, ceros conservados y normalización del período 96.

No se bloquea por un porcentaje arbitrario de errores.

## Verificación con Hotel La Esmeralda

| Control | Resultado |
| --- | ---: |
| Hoja | `Measures` |
| Período fuente | 01/06/2025 00:15 – 31/05/2026 23:59 |
| Rango normalizado | 01/06/2025 00:00 – 01/06/2026 00:00 |
| Días | 365 |
| Punto de medida | `7714990921` |
| Filas | 69.848 |
| AE | 34.924 de 35.040 |
| Q1 | 34.924 de 35.040 |
| Faltantes AE | 116 |
| Faltantes Q1 | 116 |
| Completitud | 99,6689497717 % |
| Duplicados | 0 |

Hueco detectado independientemente para AE y Q1:

- inicio: `2025-09-09 07:00`;
- fin: `2025-09-10 12:00`;
- cantidad: 116 períodos por magnitud.

Cambio de origen informado por separado:

- `PRIME`, último cierre: `2025-09-09 07:00`;
- `KAIFA`, primer inicio: `2025-09-10 12:00`.

La interfaz no afirma que el cambio de origen haya causado el hueco.

## Pruebas sin instalación

Abrir `tests/browser-tests.html`. Las reglas se comprueban al cargar y la integración real se ejecuta seleccionando Hotel La Esmeralda.

El navegador exige esa selección manual por seguridad; el archivo no se incorpora al repositorio.

## Archivos de esta etapa

### Creados

- `css/app.css` y `css/components.css`;
- `js/namespace.js`, `config.js`, `utils.js`, `parser.js`, `validator.js`, `importer.js`, `import-worker.js`, `ui.js` y `app.js`;
- `js/vendor/xlsx.full.min.js` y `SHEETJS-LICENSE.txt`;
- `tests/browser-tests.html` y `tests/browser-tests.js`;
- `docs/arquitectura-estatica-github-pages-v0.2.md`;
- directorios reservados `assets/`, `data/` y `samples/` con sus instrucciones.

### Modificados

- `index.html`: reemplazado por el punto de entrada estático;
- `README.md`: ejecución directa y publicación en GitHub Pages;
- `.gitignore`: exclusión del archivo real y muestras XLSX;
- documentos v0.1: marcados como históricos donde la plataforma React/Vite dejó de estar vigente.

### Eliminados

- configuración npm, TypeScript y Vite;
- código React y TypeScript de `src/`;
- pruebas dependientes de Vitest;
- directorios generados `node_modules/` y `dist/`.

El archivo Hotel La Esmeralda no fue modificado ni incorporado al proyecto publicable.

## Exclusiones confirmadas

No se implementaron gráficos, análisis de consumo, potencia, Punta/Llano/Valle, tarifas, comparaciones, reportes, autenticación, base de datos ni backend.
