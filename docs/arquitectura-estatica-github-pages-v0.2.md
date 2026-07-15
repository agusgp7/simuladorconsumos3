# FileSimulator — Arquitectura estática para GitHub Pages

**Estado:** aprobada para el desarrollo real  
**Versión:** 0.2  
**Fecha:** 15 de julio de 2026

## Decisión

FileSimulator es un monolito modular estático compuesto exclusivamente por HTML, CSS y JavaScript ejecutado en el navegador. No tiene proceso de compilación ni servidor de aplicación.

Esta decisión sustituye solamente la plataforma técnica propuesta en `arquitectura-filesimulator-v0.1.md`. Se mantienen sus principios: dominio separado, procesamiento local, reglas versionadas, cambios pequeños y ausencia de dependencias prematuras de backend.

## Compatibilidad doble

La aplicación debe funcionar publicada mediante GitHub Pages y abriendo `index.html` directamente mediante `file://`.

Por esta razón los módulos se encapsulan en funciones IIFE y se registran bajo un único espacio de nombres `globalThis.FileSimulator`. No se utilizan imports ES nativos: los navegadores suelen restringirlos al abrir archivos locales.

En GitHub Pages, el archivo se procesa en un Web Worker. En apertura directa se usa el mismo núcleo en el hilo principal con entregas periódicas al navegador. Ambas rutas producen el mismo contrato de salida.

## Módulos

| Módulo | Responsabilidad única |
| --- | --- |
| `namespace.js` | Crear el único nombre global de la aplicación |
| `config.js` | Definir encabezados, magnitudes y constantes confirmadas |
| `utils.js` | Texto, números, formato y utilidades neutrales |
| `parser.js` | Interpretar fecha civil, período y límites normalizados |
| `validator.js` | Construir registros y diagnósticos de calidad |
| `importer.js` | Abrir XLSX y detectar hoja, encabezado y filas |
| `import-worker.js` | Ejecutar el importador fuera del hilo visual cuando el protocolo lo permite |
| `ui.js` | Renderizar estados, resúmenes, muestras y problemas |
| `app.js` | Coordinar eventos, cancelación, confirmación y ciclo de vida |

## Dependencia XLSX

SheetJS Community 0.18.5 se incluye de forma versionada en `js/vendor/` con su licencia Apache 2.0.

Ventajas:

- funcionamiento sin CDN ni conexión;
- ninguna solicitud externa durante la importación;
- versión reproducible;
- apertura directa de `index.html`.

Desventaja: la biblioteca agrega aproximadamente 862 KB al repositorio y sus actualizaciones son manuales.

## Contratos entre módulos

`importer.js` entrega una tabla detectada a `validator.js`. El validador devuelve metadatos, registros normalizados, resumen de calidad, diagnósticos, indicador de continuidad y una muestra inicial y final.

La clave lógica es `PUNTO MEDIDA + día + PERIODO + MAGNITUD`. El orden físico de las filas nunca forma parte de una relación entre mediciones.

## Evolución

Los módulos futuros deberán consumir el contrato normalizado y no el libro Excel. `analyzer.js` se creará cuando se apruebe la etapa de análisis; no existe todavía para evitar un módulo vacío o responsabilidades anticipadas.

Si la complejidad futura supera de forma demostrable esta arquitectura, se propondrá una migración antes de introducir herramientas de compilación. GitHub Pages seguirá siendo el destino mientras no aparezca una necesidad real de servidor.
