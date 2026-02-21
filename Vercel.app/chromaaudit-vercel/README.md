# ChromaAudit — Deployment Guide

## Estructura del proyecto

```
chromaaudit/
├── api/
│   └── proxy.js       ← Serverless function (fetch desde servidor, sin CORS)
├── public/
│   └── index.html     ← App principal
├── vercel.json        ← Configuración de rutas
└── README.md
```

## Desplegar en Vercel (gratis)

### Opción A — Vercel CLI (más rápido)

```bash
# 1. Instalar Vercel CLI si no lo tienes
npm i -g vercel

# 2. Dentro de la carpeta del proyecto
cd chromaaudit
vercel

# 3. Seguir el wizard (acepta los defaults)
# → Tu app queda en https://chromaaudit-xxx.vercel.app
```

### Opción B — GitHub + Vercel Dashboard

1. Sube esta carpeta a un repo en GitHub
2. Ve a [vercel.com](https://vercel.com) → **New Project**
3. Importa el repo → **Deploy**
4. Listo ✓

---

## Cómo funciona el proxy

El scanner de URL funciona así en producción:

```
Cliente (navegador)
    │
    │  GET /api/proxy?url=https://ejemplo.com
    ▼
Vercel Edge Function (api/proxy.js)
    │
    │  fetch("https://ejemplo.com")   ← sin restricciones CORS
    ▼
Sitio externo
    │
    └──► devuelve HTML/CSS al cliente
```

El archivo `api/proxy.js` es una **Edge Function** de Vercel que:
- Corre en el servidor (no en el navegador), sin restricciones CORS
- Valida que la URL no apunte a IPs privadas (seguridad)
- Cachea la respuesta 5 minutos en el edge de Vercel
- Es gratis dentro del plan Hobby de Vercel (100k req/mes)

---

## Desplegar en otros servicios

### Netlify

Renombra `api/proxy.js` → `netlify/functions/proxy.js` y ajusta la firma:

```js
// netlify/functions/proxy.js
exports.handler = async (event) => {
  const url = event.queryStringParameters?.url;
  // ... mismo código de fetch ...
  return { statusCode: 200, body: text };
};
```

### Cloudflare Pages

El `api/proxy.js` ya es compatible con Cloudflare Workers con mínimos cambios.
Renómbralo a `functions/api/proxy.js`.

### Servidor propio (Node.js/Express)

```js
app.get('/api/proxy', async (req, res) => {
  const { url } = req.query;
  const response = await fetch(url);
  const text = await response.text();
  res.set('Access-Control-Allow-Origin', '*');
  res.send(text);
});
```

---

## Uso sin servidor (archivo local)

Si abres `index.html` directamente como archivo (`file://`), el proxy propio
no estará disponible y el scanner usará proxies CORS públicos como fallback.

La alternativa siempre disponible: pegar el HTML/CSS del sitio directamente en el campo.
