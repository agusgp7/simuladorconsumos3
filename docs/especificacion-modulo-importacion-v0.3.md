# FileSimulator — Especificación del módulo de importación

**Estado:** diseño funcional validado contra un archivo real  
**Versión:** 0.3  
**Fecha:** 15 de julio de 2026  
**Código:** todavía no autorizado

## 1. Objetivo

El módulo de importación recibe un archivo de medidas de UTE, verifica que pueda interpretarse con seguridad y entrega un conjunto normalizado de registros de consumo al módulo de análisis.

Su responsabilidad termina al producir datos normalizados y un informe de calidad. No calcula consumos acumulados, potencia, franjas horarias, períodos de facturación, costos ni tarifas.

## 2. Decisiones confirmadas

- La primera versión estable admite **un solo archivo por importación**.
- El archivo corresponde al formato Excel de UTE con hoja `Measures`.
- La tabla real contiene ocho encabezados: `PUNTO MEDIDA`, `FECHA-HORA`, `PERIODO`, `MAGNITUD`, `INTERVALO`, `VALOR`, `ORIGEN` y `RESULT VALIDACION`.
- `AE` representa energía activa y es la magnitud principal para FileSimulator.
- `Q1` representa energía reactiva del cuadrante Q1.
- La presencia de `Q1` es opcional: un archivo con AE válida puede continuar al análisis, pero los cálculos de reactiva quedan deshabilitados.
- Los registros esperados son de 15 minutos.
- `FECHA-HORA` representa el **final del intervalo**.
- Ejemplo confirmado: `00:15` corresponde al consumo ocurrido entre `00:00` y `00:15`.
- `PERIODO` toma valores enteros de 1 a 96 e identifica el cuarto de hora dentro del día.
- `PERIODO 1` representa `00:00–00:15`; `PERIODO 2`, `00:15–00:30`; y así sucesivamente hasta `PERIODO 96`, `23:45–24:00`.
- En el archivo UTE, `PERIODO 96` usa `23:59:00` como marca especial para el intervalo real `23:45–24:00`.
- `RESULT VALIDACION` informa si la lectura llegó correctamente desde el medidor; el valor confirmado como correcto es `VALID`.
- Solamente `VALID`, ignorando espacios externos y mayúsculas/minúsculas, habilita la fila para el análisis. Cualquier otro valor o celda vacía se conserva en el informe y se excluye del dataset válido.
- `INTERVALO` usa el código `QH` para indicar cuarto de hora.
- `PUNTO MEDIDA` identifica el punto de medida y se conserva como texto.
- `ORIGEN` identifica el origen de la lectura. Puede cambiar dentro del archivo y no altera por sí mismo el valor energético.
- Si existen algunas filas defectuosas, se importan las filas válidas y se informa cuáles fueron descartadas.
- Los valores existentes no se corrigen, reemplazan, suman ni eliminan automáticamente, incluso si se detectan posibles duplicados.
- El archivo se procesa localmente y no se envía a ningún servidor.
- El archivo bruto no se conserva después de la sesión por defecto.

## 3. Alcance de la primera versión

### Incluye

- Selección mediante botón o arrastrar y soltar.
- Un libro Excel UTE por vez.
- Detección de la hoja `Measures`.
- Detección y validación de los ocho encabezados conocidos.
- Lectura de las magnitudes presentes.
- Validación estructural, temporal y numérica.
- Validación de un único `PUNTO MEDIDA` y del código `INTERVALO = QH`.
- Detección de cambios de `ORIGEN`.
- Identificación de filas válidas e inválidas.
- Detección de huecos, duplicados y desorden temporal.
- Vista previa e informe de calidad.
- Confirmación antes de transferir los datos al análisis.
- Cancelación o reemplazo del archivo.

### No incluye todavía

- Varios archivos en una misma importación.
- Combinación automática de períodos.
- CSV, JSON, XLS u otros formatos.
- Asistente para mapear columnas desconocidas.
- Corrección manual de celdas dentro de FileSimulator.
- Cálculo de métricas o tarifas.
- Guardado automático del archivo original.

## 4. Recorrido del usuario

### Estado 1 — Esperando archivo

La pantalla muestra:

- Zona para arrastrar el Excel.
- Botón `Seleccionar archivo`.
- Texto: `Un archivo Excel UTE con hoja Measures`.
- Aviso de privacidad: `El archivo se procesa en este equipo y no se envía a ningún servidor`.

No se muestra el dashboard anterior mientras no exista una importación aceptada.

### Estado 2 — Inspeccionando

Después de seleccionar el archivo:

1. Se muestra nombre y tamaño.
2. Comienza la inspección en segundo plano.
3. La pantalla informa la etapa actual: apertura, búsqueda de hoja, detección de columnas, lectura y validación.
4. El usuario puede cancelar.

Seleccionar el archivo no implica todavía aceptar sus datos.

### Estado 3 — Resultado de inspección

La pantalla muestra:

- Nombre y tamaño del archivo.
- Hoja utilizada.
- Encabezados encontrados.
- Magnitudes encontradas.
- Cantidad de filas leídas.
- Cantidad de registros válidos e inválidos.
- Primera y última `FECHA-HORA`.
- Intervalo predominante.
- Huecos y duplicados detectados.
- Vista previa de registros.
- Estado general: rechazado, necesita revisión, listo con advertencias o listo.

### Estado 4 — Confirmación

Los botones disponibles son:

- `Cancelar`.
- `Cambiar archivo`.
- `Ver problemas`.
- `Continuar al análisis`.

`Continuar al análisis` permanece deshabilitado si existe un problema bloqueante. Si solamente hay advertencias, el usuario debe confirmar que desea continuar con las filas válidas.

### Estado 5 — Transferencia

Al confirmar:

- Se descartan del dataset las filas marcadas como inválidas.
- Se conservan sus diagnósticos en el informe de calidad.
- Se crea el dataset normalizado.
- El módulo de análisis recibe el resultado.
- La interfaz navega al dashboard.

## 5. Detección del archivo

### Validación previa

Antes de leer contenido:

- Debe existir exactamente un archivo seleccionado.
- Debe ser un libro Excel admitido por la primera versión.
- No debe estar vacío.
- Debe poder abrirse sin contraseña.
- Un archivo nuevo reemplaza la importación pendiente únicamente después de confirmación si ya se había aceptado otro.

### Detección de la hoja

- Se busca primero el nombre exacto `Measures`.
- La comparación puede ignorar espacios externos y diferencias de mayúsculas/minúsculas.
- No se usará coincidencia difusa que pueda confundir una hoja diferente.
- Si no se encuentra una única hoja compatible, la importación se bloquea y explica el motivo.

### Detección de encabezados

- Se localiza la fila que contiene todos los encabezados obligatorios.
- Pueden ignorarse espacios al principio o al final y diferencias de mayúsculas/minúsculas.
- Las columnas pueden estar en distinto orden.
- Se ignoran filas completamente vacías antes o después del encabezado.
- No se aceptan nombres parecidos automáticamente.
- Si falta un encabezado obligatorio, el archivo se rechaza con el nombre exacto de la columna faltante.

## 6. Interpretación temporal

`FECHA-HORA` representa normalmente el instante final del intervalo. La excepción confirmada es `PERIODO 96`, donde UTE escribe `23:59:00` para representar el cierre real a las `24:00`.

Para cada fila válida se conservan el timestamp original y dos límites normalizados. Los límites no se calculan restando siempre 15 minutos al timestamp: se derivan del día y de `PERIODO`.

- **Inicio normalizado:** comienzo del cuarto de hora indicado por `PERIODO`.
- **Fin normalizado:** final exacto de ese cuarto de hora.
- **Timestamp original:** valor de `FECHA-HORA` sin modificación.

Ejemplos:

| FECHA-HORA | Intervalo representado |
| --- | --- |
| 01/06/2026 00:15 | 01/06/2026 00:00 a 00:15 |
| 01/06/2026 18:00 | 01/06/2026 17:45 a 18:00 |
| 01/06/2026 23:59 con PERIODO 96 | 01/06/2026 23:45 a 02/06/2026 00:00 |

El archivo original conserva su timestamp. Los módulos posteriores usarán el inicio y el fin explícitos para evitar errores en medianoche, franjas o períodos de facturación.

La importación no asigna todavía Punta, Llano o Valle.

### Verificación mediante PERIODO

`PERIODO` funciona como una segunda comprobación del timestamp:

| PERIODO | Intervalo esperado | Hora final esperada |
| ---: | --- | --- |
| 1 | 00:00–00:15 | 00:15 |
| 2 | 00:15–00:30 | 00:30 |
| 3 | 00:30–00:45 | 00:45 |
| ... | ... | ... |
| 95 | 23:30–23:45 | 23:45 |
| 96 | 23:45–24:00 | 23:59:00 como marca especial |

El importador comprobará que `PERIODO` y `FECHA-HORA` describan el mismo cuarto de hora, incluyendo la excepción confirmada de `PERIODO 96 = 23:59:00`. Si no coinciden, conservará ambos valores originales y señalará la fila como inconsistente; no intentará corregirla.

Los huecos temporales se detectan recorriendo `día + PERIODO`, no calculando diferencias brutas entre timestamps. Esto evita interpretar los 14 minutos entre `23:45` y `23:59` o los 16 minutos entre `23:59` y `00:15` como intervalos reales diferentes.

## 7. Validación por fila

Una fila de medida es estructuralmente válida cuando:

- Tiene una `FECHA-HORA` interpretable.
- Tiene `MAGNITUD` no vacía.
- Tiene `VALOR` numérico finito.
- Tiene un `PERIODO` entero entre 1 y 96.
- Tiene `INTERVALO` igual a `QH`.
- Tiene `PUNTO MEDIDA` no vacío.
- Puede asociarse al encabezado detectado.
- No es una fila completamente vacía ni un segundo encabezado repetido.

Además, para incorporarse al dataset, `RESULT VALIDACION` debe ser `VALID`. Cualquier otro resultado se interpreta conservadoramente como no aprobado: la fila se conserva en el informe y se excluye del análisis.

El valor cero es válido. Un valor negativo no se corregirá ni convertirá en cero: se conservará con una advertencia hasta que se defina su significado operativo.

Una fila inválida:

- No entra al dataset entregado al análisis.
- Permanece en el informe de calidad.
- Conserva número de fila, valores originales y motivo del descarte.

## 8. Reglas del conjunto de datos

### Orden

- El orden original queda registrado.
- La asociación entre AE y Q1 se realiza por punto de medida, día y período; nunca por cercanía o número consecutivo de fila.
- El dataset normalizado se entrega ordenado cronológicamente.
- Reordenar no cambia valores y se informa como transformación no destructiva.

### Intervalos

- El intervalo esperado es de 15 minutos.
- Se verifica la secuencia `día + PERIODO` por punto de medida y magnitud.
- Los huecos se informan, pero no se rellenan.
- No se crean valores cero ni interpolados.
- Los intervalos distintos de 15 minutos se señalan como problema de calidad.

### Duplicados

La clave lógica inicial es `PUNTO MEDIDA + fecha del día + PERIODO + MAGNITUD`.

- Si dos filas tienen la misma clave y el mismo valor, se considera duplicado exacto.
- Si tienen la misma clave y distinto valor, se considera duplicado conflictivo.
- Como el Excel no debería contener duplicados, su presencia se considera una anomalía del archivo.
- Se conservan todas las filas y todos sus valores exactamente como llegaron.
- No se elimina, combina, promedia, reemplaza ni prioriza ningún registro.
- Se muestra una advertencia indicando las filas afectadas y el posible impacto de contarlas.
- Para continuar, el usuario debe aceptar expresamente la advertencia.

### Magnitudes

- Se presenta el inventario completo de valores encontrados en `MAGNITUD`.
- Las magnitudes desconocidas no se reinterpretan.
- Se conservan como información del archivo, pero no se transfieren al modelo energético hasta definir su significado.
- Debe existir al menos un registro AE válido para continuar al análisis de consumo.
- Q1 es opcional. Si no existe Q1 válida, el análisis de consumo continúa y las funciones de reactiva quedan marcadas como no disponibles.

### Punto de medida, intervalo y origen

- `PUNTO MEDIDA` se trata como identificador textual, no como número para cálculos.
- La primera versión espera un único punto de medida por archivo.
- Si aparecen varios puntos de medida, la importación se bloquea para impedir mezclar suministros.
- `INTERVALO` debe ser `QH`. Otro código indica un formato temporal no soportado por este adaptador.
- `ORIGEN` se conserva en cada registro y puede cambiar dentro del mismo archivo.
- Un cambio de origen se muestra como evento de calidad, pero no invalida los registros marcados `VALID`.
- La aplicación no atribuye automáticamente un hueco al cambio de medidor; solamente muestra que ambos eventos coinciden cuando corresponda.

## 9. Clasificación de problemas

### Bloqueantes

- Archivo ilegible, vacío, cifrado o formato no admitido.
- No se encuentra una única hoja `Measures` compatible.
- Falta un encabezado obligatorio.
- No existe ninguna fila interpretable.
- No existe ningún registro AE válido.
- No se puede interpretar `FECHA-HORA` de manera consistente.
- Hay más de un `PUNTO MEDIDA` en la primera versión.
- `INTERVALO` no es `QH`.

### Advertencias

- Filas estructuralmente inválidas.
- Huecos entre intervalos.
- Registros fuera de orden.
- Valores negativos.
- Magnitudes desconocidas.
- Q1 ausente.
- Cambio de `ORIGEN`.
- Período parcial.
- Duplicados conservados sin modificación.
- Resultados de validación de origen que deban revisarse.

No se usará un porcentaje arbitrario de errores para bloquear. Mientras exista información AE válida y no haya un problema estructural bloqueante, el usuario podrá decidir continuar con una advertencia clara de cobertura incompleta.

## 10. Informe de calidad

### Resumen

- Total de filas físicas.
- Filas vacías ignoradas.
- Filas de datos detectadas.
- Filas válidas.
- Filas inválidas descartadas.
- Registros por magnitud.
- Fecha-hora inicial y final.
- Intervalo predominante.
- Huecos.
- Duplicados exactos y conflictivos.
- Valores negativos.
- Valores de `RESULT VALIDACION` encontrados.
- Puntos de medida encontrados.
- Valores y cambios de `ORIGEN`.
- Valores encontrados en `INTERVALO`.
- Distribución de registros por `PERIODO` del 1 al 96.
- Inconsistencias entre `PERIODO` y `FECHA-HORA`.
- Estado general.

### Detalle de problemas

Cada diagnóstico incluye:

- Severidad.
- Tipo de problema.
- Número de fila original.
- Fecha-hora, si puede interpretarse.
- Magnitud.
- Columna afectada.
- Valor original.
- Explicación en lenguaje claro.
- Acción tomada: ignorada, descartada, conservada con advertencia o bloqueada.

El informe puede filtrarse por tipo y severidad.

## 11. Vista previa

La vista previa muestra una muestra suficiente para verificar el mapeo sin intentar representar todo el Excel:

- Primeros registros válidos.
- Últimos registros válidos.
- Algunas filas con problemas, si existen.
- Columnas originales y campos temporales derivados.

La vista previa no modifica el archivo ni ofrece edición de celdas en la primera versión.

## 12. Resultado entregado al análisis

La salida conceptual contiene:

### Metadatos

- Nombre y tamaño del archivo.
- Hoja utilizada.
- Encabezado detectado.
- Fecha de importación de la sesión.
- Primera y última fecha-hora.
- Cantidades por magnitud.
- Punto de medida.
- Orígenes encontrados y momentos de cambio.

### Registros normalizados

- Timestamp original.
- Inicio del intervalo.
- Fin del intervalo.
- Duración esperada.
- Magnitud canónica o magnitud desconocida.
- Valor numérico.
- Punto de medida original.
- Código de intervalo original.
- Origen de lectura.
- Período original.
- Resultado de validación original.
- Número de fila original.

### Calidad

- Diagnósticos.
- Transformaciones realizadas.
- Advertencias aceptadas por el usuario.
- Indicador de cobertura completa o incompleta.

## 13. Privacidad y ciclo de vida

- El archivo se lee localmente.
- No se realiza ninguna solicitud de red con sus datos.
- No hay telemetría de nombres, contenidos o resultados.
- El archivo bruto no se guarda por defecto.
- Cancelar elimina la importación pendiente de la memoria de la sesión.
- Reemplazar el archivo descarta el dataset pendiente anterior.
- La persistencia opcional de sesiones será un módulo posterior y requerirá acción explícita del usuario.

## 14. Mensajes principales

Los mensajes deben decir qué ocurrió y cómo resolverlo.

Ejemplos conceptuales:

- `No encontramos la hoja Measures.`
- `Falta la columna RESULT VALIDACION.`
- `El archivo contiene más de un punto de medida. La primera versión admite uno por importación.`
- `Encontramos un intervalo distinto de QH; este archivo no puede procesarse como datos de 15 minutos.`
- `Se importaron 17.498 filas válidas y se descartaron 6. Revisá el informe antes de continuar.`
- `Detectamos 4 intervalos sin datos. FileSimulator no completará esos valores automáticamente.`
- `El archivo contiene AE, pero no contiene Q1.`
- `Podés continuar con el análisis de consumo, pero las funciones de energía reactiva no estarán disponibles.`
- `Hay dos valores diferentes para AE en la misma fecha y hora.`
- `Los registros duplicados se conservarán sin cambios. Si continuás, todos los valores existentes formarán parte del dataset.`
- `Detectamos un cambio de origen de las lecturas. Los registros válidos se conservarán y el evento aparecerá en el informe.`

No se mostrarán errores técnicos internos al usuario final.

## 15. Criterios de aceptación

El módulo se considerará correctamente diseñado e implementado cuando:

1. Un archivo UTE válido con hoja `Measures` puede inspeccionarse y aceptarse.
2. Las columnas se detectan aunque cambien de orden.
3. Las filas vacías externas a la tabla no afectan la importación.
4. `00:15` produce un intervalo `00:00–00:15`.
5. `23:59` con `PERIODO 96` produce el intervalo normalizado `23:45–24:00`.
6. Las filas defectuosas se excluyen y aparecen en el informe.
7. Ningún hueco se rellena automáticamente.
8. Ningún duplicado se elimina o modifica; se conserva y se advierte antes de continuar.
9. El usuario ve fechas, magnitudes y cantidades antes de continuar.
10. Los errores bloqueantes impiden avanzar.
11. Las advertencias requieren confirmación.
12. Cancelar o reemplazar no deja datos anteriores activos.
13. El análisis recibe solamente datos normalizados y diagnósticos, nunca el libro Excel directamente.
14. El archivo no se transmite ni se conserva por defecto.
15. Un archivo sin Q1 puede continuar con las funciones de reactiva deshabilitadas.
16. `PERIODO` se valida como entero entre 1 y 96 y se contrasta con `FECHA-HORA`.
17. Solamente las filas con `RESULT VALIDACION = VALID` entran al dataset.
18. `PUNTO MEDIDA` se conserva como texto y no se mezclan varios puntos.
19. `INTERVALO = QH` confirma la granularidad de 15 minutos.
20. Los cambios de `ORIGEN` se conservan y se informan sin alterar valores.
21. Un archivo de referencia de aproximadamente 70.000 filas y 3 MB se procesa sin bloquear la interfaz.

## 16. Hallazgos del archivo real de referencia

- Formato `.xlsx`, una hoja `Measures`, encabezado en la primera fila y ocho columnas.
- 69.848 filas de datos y ninguna fila vacía dentro del rango utilizado.
- Un punto de medida.
- 34.924 registros AE y 34.924 registros Q1.
- El archivo organiza cada día en un bloque AE seguido por un bloque Q1; las magnitudes no aparecen alternadas fila a fila.
- Todos los registros usan `INTERVALO = QH` y `RESULT VALIDACION = VALID`.
- Dos orígenes: `PRIME` y `KAIFA`.
- Fechas desde el 1 de junio de 2025 a las 00:15 hasta el 31 de mayo de 2026 a las 23:59.
- `PERIODO` y `FECHA-HORA` coinciden en todos los registros, incluyendo `PERIODO 96 = 23:59`.
- No hay filas duplicadas ni claves temporales duplicadas.
- No hay valores negativos; existen tres valores cero en AE y tres en Q1, todos válidos.
- Faltan 116 intervalos AE y los mismos 116 intervalos Q1: desde el 9 de septiembre de 2025 a las 07:00 hasta el 10 de septiembre de 2025 a las 12:00.
- El hueco coincide con el cambio de `ORIGEN` de `PRIME` a `KAIFA`, pero la aplicación no afirmará causalidad.
- En un año completo se esperarían 35.040 registros por magnitud; el archivo contiene 34.924 debido a ese hueco.
- El libro no contiene fórmulas.

## 17. Decisiones técnicas restantes

No quedan reglas de negocio pendientes para comenzar la primera implementación vertical del importador. Durante las pruebas técnicas se fijarán:

1. Tamaño máximo admitido, usando como mínimo verificable este archivo de 2,7 MB y casi 70.000 filas.
2. Tiempo objetivo de importación en las computadoras de uso real.
3. Cantidad máxima de problemas individuales mostrados en pantalla antes de resumir o paginar el informe.
