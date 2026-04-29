# Farmacia B° Congreso

Aplicación web responsive para una farmacia de San Miguel de Tucumán.

## Probar con backend local

```bash
npm install
npm run build
npm run server
```

Abrir:

`http://127.0.0.1:3000`

## Panel admin

Botón `Admin` en el encabezado.

- Usuario: `admin`
- Contraseña: `congreso2026`

Desde el panel se puede cargar logo, imagen principal y productos. Todas las imágenes se suben manualmente desde archivos locales.

## Publicar gratis en Netlify

La app ya incluye `netlify.toml` y funciones para guardar el catálogo online con Netlify Blobs.

Pasos:

1. Crear una cuenta gratis en Netlify.
2. Subir este proyecto a GitHub.
3. En Netlify elegir `Add new site` y conectar el repositorio.
4. Netlify detecta:
   - Build command: `npm run build`
   - Publish directory: `dist`
   - Functions directory: `netlify/functions`
5. Agregar variables de entorno en Netlify:
   - `ADMIN_USER`: `admin`
   - `ADMIN_PASSWORD`: una contraseña propia
   - `ADMIN_SECRET`: una frase larga privada
6. Publicar.

Netlify entrega un dominio gratuito tipo:

`https://nombre-del-sitio.netlify.app`

## Desarrollo frontend

```bash
npm run dev
```

Para desarrollo completo con API local, usar `npm run build` y `npm run server`.

## Datos

- En local, los datos se guardan en `data/store.json`.
- En Netlify, los datos se guardan con Netlify Blobs.
- Las imágenes se cargan manualmente desde el panel admin.
