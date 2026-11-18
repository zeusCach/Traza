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
| Interrupción | Durante el registro, cierra la app desde el sistema. Vuelve a abrirla. | La rodada reaparece pausada, con las métricas y puntos del último guardado local. Puedes reanudar o guardar. |
| Señal débil | Pasa de una zona abierta a una con mala recepción y vuelve a cielo abierto. | La velocidad actual desaparece cuando la lectura pierde vigencia. El registro vuelve a incorporar puntos válidos cuando se recupera la señal. |
| Sin conexión | Tras cargar la app y conceder los permisos, desactiva Wi-Fi y datos móviles y realiza una rodada. | Puedes guardar, consultar el historial y abrir el trazado guardado sin conexión. |
| Permisos limitados | Repite con permiso solo mientras se usa la app y luego con ubicación denegada. | Con el primer permiso puedes registrar GPS con la app abierta. Con la ubicación denegada puedes guardar el tiempo. Ambas modalidades pausan al pasar a segundo plano. |

Por cada caso registra el modelo, versión de sistema, compilación, resultado y, si falla, el paso exacto y la distancia o tiempo observado.
