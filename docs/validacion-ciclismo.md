# Validación de campo de TRAZA

Usa una compilación de desarrollo en un Android y un iPhone físicos. El perfil `development` está configurado para distribución interna.

```sh
npx eas-cli@latest build --profile development --platform android
npx eas-cli@latest build --profile development --platform ios
npx expo start --dev-client
```

Abre la compilación y carga el proyecto antes de probar el registro sin conexión. Concede el permiso de ubicación en segundo plano para los casos que lo requieran. En Android, revisa si TRAZA muestra la notificación de registro mientras está activa.

| Caso | Qué hacer | Resultado esperado |
| --- | --- | --- |
| Pantalla bloqueada | Empieza una rodada al aire libre, espera una lectura de GPS, bloquea la pantalla y recorre varios minutos. Desbloquea, pausa y guarda. | Tiempo, distancia y trazado incluyen el tramo recorrido con la pantalla bloqueada. |
| Pausa y reanudación | Pausa, desplázate unos metros y reanuda desde otro punto. | El tiempo activo excluye la pausa. El mapa muestra dos tramos y la distancia excluye el desplazamiento durante la pausa. |
| Interrupción | Durante el registro, quita la app de recientes y vuelve a abrirla. Repite apagando y encendiendo el teléfono. | Con el servicio activo y una lectura reciente, la rodada sigue en curso. Si el sistema detuvo el registro, reaparece pausada con los puntos y métricas guardados. Puedes reanudarla o guardarla. |
| Señal débil | Pasa de una zona abierta a una con mala recepción y vuelve a cielo abierto. | La velocidad actual desaparece cuando la lectura pierde vigencia. El registro incorpora puntos válidos al recuperar señal. Después de más de 30 segundos entre puntos guardados, el mapa inicia otro tramo sin sumar la distancia del hueco. |
| Sin conexión | Tras cargar la app y conceder los permisos, desactiva Wi-Fi y datos móviles y realiza una rodada. | Puedes guardar, consultar el historial y abrir el trazado guardado sin conexión. |
| Permisos limitados | Repite con permiso solo mientras se usa la app, ubicación aproximada y ubicación denegada. | En Android, el servicio iniciado desde la app puede seguir registrando con permiso de ubicación precisa mientras se usa. En iOS, el bloqueo requiere permiso de ubicación en segundo plano. Con ubicación aproximada aparece un aviso en modo de segundo plano. Con ubicación denegada se registra el tiempo y se pausa al salir de la app. |

Por cada caso registra el modelo, versión de sistema, compilación, resultado y, si falla, el paso exacto y la distancia o tiempo observado.
