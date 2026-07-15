# Arquitectura de la Pantalla de Resultados v0.1

## Estado

- Pantalla de Resultados: `v0.1`.
- Importador consumido: `v0.2`, congelado.
- Motor consumido: `AnalysisResult/1.0`, congelado.
- Repositorio oficial: `https://github.com/agusgp7/simuladorconsumos2`.
- Plataforma: HTML5, CSS3 y JavaScript ES6+ sin compilación.

## Flujo aprobado

```text
Importador
    ↓
NormalizedDataset/1.0
    ↓
Motor de Análisis
    ↓
AnalysisResult/1.0
    ↓
Controlador de resultados
    ↓
Presentador de resultados
```

El botón `Continuar con el análisis` es el único punto de transición. `js/app.js` adapta el resultado normalizado, invoca una sola vez al Motor y entrega el `AnalysisResult` completo al controlador.

`AnalysisResult/1.0` todavía exige un valor técnico para `billingCycleStartDay`. Mientras no exista una configuración confiable del servicio, la aplicación entrega `1` únicamente como compatibilidad con ese contrato. La interfaz ignora `config` y `aggregations.billingPeriods`; no interpreta ni presenta ese valor como ciclo de facturación. Todos los resúmenes visibles consumen `aggregations.calendarMonthly`, que representa meses calendario.

## Responsabilidades

### `js/app.js`

- mantiene el estado de la importación activa;
- invoca el adaptador y el Motor;
- conserva el `AnalysisResult` activo;
- entrega el resultado al controlador;
- descarta toda la sesión cuando el usuario carga otro archivo.

No calcula métricas ni modifica el resultado.

### `js/results/results-controller.js`

- recibe exclusivamente `AnalysisResult`;
- controla la entrada y salida de la vista;
- conserva la referencia exacta al resultado para módulos futuros;
- solicita al presentador que lo represente.

No recibe registros del importador ni invoca al Motor.

### `js/results/results-ui.js`

- transforma campos existentes de `AnalysisResult` en HTML semántico;
- formatea números, porcentajes y fechas;
- representa valores `null` como `No disponible`;
- presenta tablas ya agregadas por el Motor;
- separa advertencias heredadas y diagnósticos del Motor.

No accede a `intervalSeries` y no suma, agrupa, promedia ni reconstruye valores.

### `css/results.css`

Contiene únicamente reglas de presentación para la nueva pantalla. Reutiliza las variables, colores, tipografía, paneles y comportamiento responsive existentes.

## Mapeo de datos

| Información visible | Fuente exclusiva |
|---|---|
| Estado | `status` |
| Punto y período | `subject` |
| Magnitudes disponibles | `capabilities` |
| Registros por magnitud | `coverage.measurements.*.observationCount` |
| Cobertura | `coverage.measurements` |
| AE y Q1 acumuladas | `totals.measurements.*.reliableTotal` |
| Potencia máxima y promedio | `statistics.power.reliable` |
| Meses | `aggregations.calendarMonthly` |
| Días | `aggregations.daily` |
| Perfil de 96 períodos | `aggregations.averageProfile96` |
| Huecos, duplicados y orígenes | `quality` |
| Advertencias del importador | `quality.issues` |
| Diagnósticos del Motor | `diagnostics` |

La pantalla informa registros por magnitud. No calcula un total general porque ese campo no forma parte de `AnalysisResult/1.0`.

## Política de confiabilidad

Los indicadores principales utilizan exclusivamente la rama `reliable` o `reliableTotal`.

- Los intervalos faltantes no se inventan.
- Los duplicados no tienen valor canónico.
- Los resultados parciales se identifican expresamente.
- Un valor ausente no se convierte en cero.
- Los cambios de origen y los huecos se muestran como hechos independientes.

## Componentes visibles

1. Estado y datos generales del análisis.
2. Indicadores principales AE, Q1 y potencia.
3. Cobertura y registros por magnitud.
4. Calidad: huecos, duplicados y cambios de origen.
5. Tabla mensual.
6. Tabla diaria desplazable.
7. Perfil promedio de 96 períodos.
8. Advertencias del importador y del Motor.
9. Acción para descartar y cargar otro archivo.

## Compatibilidad

- Todos los recursos usan rutas relativas.
- La aplicación funciona abriendo `index.html`.
- En protocolo `file:` la importación conserva su fallback al hilo principal.
- En GitHub Pages se conserva el worker de importación existente.
- No existen imports de módulos, solicitudes de backend ni pasos de compilación.

## Fuera de alcance

- gráficos;
- Punta, Llano y Valle;
- simulación tarifaria;
- configuración del ciclo de facturación;
- exportación y reportes;
- persistencia, autenticación e IA.
