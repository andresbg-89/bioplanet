// ══════════════════════════════════════════════════════════
// PROXY SEGURO PARA LA API DE CLAUDE — Vercel Serverless Function
// ──────────────────────────────────────────────────────────
// La API key NUNCA llega al navegador. Vive solo en el servidor
// como variable de entorno (process.env.ANTHROPIC_API_KEY).
//
// Configuración en Vercel:
//   Settings → Environment Variables → ANTHROPIC_API_KEY = sk-ant-...
//
// El frontend llama a /api/claude en lugar de api.anthropic.com
// ══════════════════════════════════════════════════════════

export default async function handler(req, res) {
  // Solo aceptar POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // CORS — permitir solo desde tu dominio en producción
  const allowedOrigins = [
    'https://bioplanet-iota.vercel.app',
    'http://localhost:3000',
    'http://localhost:5173',
  ];
  const origin = req.headers.origin || '';
  if (allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({
      error: 'Server not configured',
      detail: 'ANTHROPIC_API_KEY environment variable is missing.',
    });
  }

  try {
    // Validar y limitar el payload entrante (evita abuso)
    const { model, max_tokens, messages } = req.body || {};

    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: 'Invalid request: messages required' });
    }

    // Límites de seguridad — el cliente no puede pedir cualquier cosa
    const safeModel = (typeof model === 'string' && model.startsWith('claude-'))
      ? model
      : 'claude-sonnet-4-20250514';
    const safeMaxTokens = Math.min(Math.max(parseInt(max_tokens) || 1000, 1), 2000);

    // Llamada real a Anthropic (la key vive aquí, en el servidor)
    const anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: safeModel,
        max_tokens: safeMaxTokens,
        messages: messages,
      }),
    });

    const data = await anthropicRes.json();

    if (!anthropicRes.ok) {
      return res.status(anthropicRes.status).json({
        error: 'Anthropic API error',
        detail: data.error?.message || 'Unknown error',
      });
    }

    return res.status(200).json(data);
  } catch (err) {
    return res.status(500).json({
      error: 'Proxy error',
      detail: err.message,
    });
  }
}
