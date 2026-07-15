# FileSimulator

Aplicación web estática para importar, controlar la calidad, analizar y presentar datos normalizados de medidas eléctricas de UTE.

La versión actual incorpora el Importador v0.2, el Motor `AnalysisResult/1.0` y la Pantalla de Resultados v0.1. No incluye gráficos, tarifas, reportes, usuarios, base de datos ni backend.

Repositorio oficial: `https://github.com/agusgp7/simuladorconsumos2`.

## Ejecutar

No requiere instalación, compilación, Node.js, npm ni servidor.

1. Descargar o clonar el repositorio.
2. Abrir `index.html` con un navegador moderno.
3. Seleccionar o arrastrar un archivo `.xlsx` de UTE.

También puede publicarse directamente mediante GitHub Pages.

## Publicar en GitHub Pages

1. Subir el contenido de este proyecto a `https://github.com/agusgp7/simuladorconsumos2`, conservando `index.html` en la raíz.
2. En GitHub, abrir `Settings` → `Pages`.
3. En `Build and deployment`, elegir `Deploy from a branch`.
4. Seleccionar la rama `main` y la carpeta `/ (root)`.
5. Guardar y esperar a que GitHub actualice la publicación.

URL pública oficial: `https://agusgp7.github.io/simuladorconsumos2/`.

## Probar

- Aplicación: abrir `index.html`.
- Pruebas del importador: abrir `tests/browser-tests.html`.
- Pruebas del Motor de Análisis: abrir `tests/analysis-tests.html`.
- Pruebas de la Pantalla de Resultados: abrir `tests/results-tests.html`.
- La prueba real solicita seleccionar Hotel La Esmeralda porque el navegador no puede acceder automáticamente a archivos locales.

## Estructura

```text
index.html
css/
  app.css
  components.css
  results.css
js/
  namespace.js
  config.js
  utils.js
  parser.js
  validator.js
  importer.js
  import-worker.js
  ui.js
  app.js
  analysis/
    contract.js
    indexer.js
    statistics.js
    aggregations.js
    analyzer.js
  results/
    results-ui.js
    results-controller.js
  vendor/
data/
assets/
docs/
samples/
tests/
```

La responsabilidad de cada módulo está documentada en `docs/arquitectura-estatica-github-pages-v0.2.md`.

El contrato congelado del Motor de Análisis se documenta en `docs/contrato-analysis-result-v1.md`.

La arquitectura de presentación se documenta en `docs/arquitectura-pantalla-resultados-v0.1.md`.

## Privacidad

- El libro se procesa dentro del navegador.
- No se realizan solicitudes con el archivo ni sus resultados.
- El archivo original no se guarda.
- Descartar o cancelar elimina la referencia activa de la sesión.
- No deben subirse archivos reales de clientes al repositorio público.

Consultar `docs/implementacion-modulo-importacion-estatico-v0.2.md` para los resultados verificados.
