/**
 * ChromaAudit — Serverless Proxy
 * Vercel Edge Function: /api/proxy?url=https://...
 *
 * Hace el fetch desde el servidor (Node.js), sin restricciones CORS.
 * El cliente llama a /api/proxy?url=... en lugar de llamar al sitio externo directamente.
 */

export const config = {
  runtime: 'edge', // Edge runtime: más rápido, disponible globalmente
};

// Dominios que no queremos proxiar (seguridad básica)
const BLOCKED = [
  'localhost',
  '127.0.0.1',
  '0.0.0.0',
  '169.254.',   // link-local
  '10.',        // private
  '192.168.',   // private
  '172.16.',    // private
];

export default async function handler(req) {
  // Solo GET
  if (req.method !== 'GET') {
    return new Response('Method not allowed', { status: 405 });
  }

  const { searchParams } = new URL(req.url);
  const targetUrl = searchParams.get('url');

  if (!targetUrl) {
    return new Response(JSON.stringify({ error: 'Missing ?url= parameter' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Validar URL
  let parsed;
  try {
    parsed = new URL(targetUrl);
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid URL' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Solo HTTP/HTTPS
  if (!['http:', 'https:'].includes(parsed.protocol)) {
    return new Response(JSON.stringify({ error: 'Only http/https allowed' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Bloquear IPs privadas
  const host = parsed.hostname.toLowerCase();
  for (const blocked of BLOCKED) {
    if (host.startsWith(blocked) || host === blocked.replace('.', '')) {
      return new Response(JSON.stringify({ error: 'Private/local URLs not allowed' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  }

  try {
    const response = await fetch(targetUrl, {
      headers: {
        // Simular navegador para evitar bloqueos básicos de user-agent
        'User-Agent': 'Mozilla/5.0 (compatible; ChromaAudit/1.0; +https://chromaaudit.vercel.app)',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'es,en;q=0.9',
      },
      // Sin seguir redirects infinitos
      redirect: 'follow',
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) {
      return new Response(
        JSON.stringify({ error: `Target returned HTTP ${response.status}` }),
        { status: 502, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const body = await response.text();

    return new Response(body, {
      status: 200,
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        // Permitir llamadas desde cualquier origen (el cliente es el mismo dominio, pero por si acaso)
        'Access-Control-Allow-Origin': '*',
        // Cache 5 minutos en edge
        'Cache-Control': 'public, max-age=300, s-maxage=300',
      },
    });

  } catch (err) {
    const message = err.name === 'TimeoutError'
      ? 'Request timed out (15s)'
      : err.message || 'Fetch failed';

    return new Response(
      JSON.stringify({ error: message }),
      { status: 502, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
