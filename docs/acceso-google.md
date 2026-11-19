# Acceso con Google en la beta de TRAZA

1. En Google Auth Platform crea un cliente OAuth de tipo **Aplicación web** para Supabase. En las URI de redirección autorizadas agrega la URL de callback que aparece en el proveedor Google del proyecto de Supabase. La URL usa el formato `https://<project-ref>.supabase.co/auth/v1/callback`.
2. Habilita Google en **Authentication → Providers** de Supabase y guarda allí el ID y el secreto del cliente. El secreto se queda en Supabase.
3. En **Authentication → URL Configuration → Redirect URLs** agrega `traza://acceso`. Si el proyecto de Google está en modo de prueba, agrega las cuentas de los participantes como usuarios de prueba.
4. Genera una compilación de desarrollo o `preview` de Android y de iOS con `expo-web-browser` incluido. Usa el mismo proyecto de Supabase en la compilación y en los pasos anteriores.

[Configurar Google en Supabase](https://supabase.com/docs/guides/auth/social-login/auth-google) · [Expo WebBrowser](https://docs.expo.dev/versions/v58.0.0/sdk/webbrowser/)

## Pruebas en un teléfono físico

- Inicia sesión con una cuenta de Google nueva. Confirma que se abra TRAZA, que el perfil aparezca y que la sesión siga activa al volver a abrir la app.
- Inicia sesión con Google usando el mismo correo verificado de una cuenta de TRAZA. Confirma que se conserve el mismo usuario de Supabase, su perfil y sus publicaciones. Después comprueba que todavía funcione el acceso con contraseña.
- Cierra el navegador antes de terminar. Comprueba que puedas volver a intentar el acceso con Google o entrar con correo desde la misma pantalla.
- Crea una cuenta por correo, confirma el mensaje recibido e inicia sesión con contraseña.

[Vinculación automática de identidades en Supabase](https://supabase.com/docs/guides/auth/auth-identity-linking)
