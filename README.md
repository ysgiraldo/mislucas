# Mis lucas — web

Cliente estatico sin dependencias. **Aqui nunca se sube un secreto**: `config.js` solo lleva datos publicos
(URL de la API, dominio de login, id del cliente). El codigo del servidor vive en otro repositorio, privado.

## Publicar en GitHub Pages
1. Crea un repositorio publico con estos archivos en la raiz. Settings > Pages > "Deploy from branch" > `main` / root.
2. Llena `config.js` con los datos de AWS (ver el `AWS-API.md` del servidor).
3. En iPhone: abre la direccion en Safari > Compartir > "Agregar a pantalla de inicio".

## Pensado para cambiar despues
- Todas las rutas son relativas y el `redirect_uri` se calcula solo: mover la web a otro dominio o carpeta no requiere tocar codigo
  (solo agregar la nueva direccion en Cognito). Quien ya la instalo en el iPhone tendra que reinstalarla.
- `app.js` separa la capa `Api` (habla con el servidor) de las vistas. Una app nativa (Expo/React Native) reutiliza ese contrato.
- Contrato del servidor: GET /resumen · GET /transacciones · POST /transacciones · PATCH|DELETE /transacciones/{id}.

## Seguridad
El navegador guarda la sesion en localStorage: no abras sitios de terceros bajo el mismo `usuario.github.io`.
Lo ideal es que este repositorio sea el unico sitio publicado en esa cuenta.
