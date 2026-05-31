// ══════════════════════════════════════════════════════════
// PROXY SEGURO PARA LA API DE CLAUDE — Vercel Serverless Function
// ──────────────────────────────────────────────────────────
// La API key NUNCA llega al navegador. Vive solo en el servidor
// como variable de entorno (process.env.ANTHROPIC_API_KEY).
//
// RATE LIMITING (protege tu factura):
//   - Límite por IP: máx N llamadas por ventana de tiempo
//   - Tope global diario: techo de seguridad para toda la app
//   Usa Supabase como almacén persistente (serverless = stateless).
//
// Variables de entorno en Vercel:
//   ANTHROPIC_API_KEY   = sk-ant-...
//   SUPABASE_URL        = https://xxxx.supabase.co
//   SUPABASE_SERVICE_KEY= eyJ...  (service_role key, NO la anon)
//   RL_PER_IP_LIMIT     = 30      (opcional, default 30)
//   RL_WINDOW_MIN       = 60      (opcional, default 60 min)
//   RL_GLOBAL_DAILY     = 5000    (opcional, default 5000)
// ══════════════════════════════════════════════════════════

const PER_IP_LIMIT   = parseInt(process.env.RL_PER_IP_LIMIT) || 30;
const WINDOW_MIN     = parseInt(process.env.RL_WINDOW_MIN)   || 60;
const GLOBAL_DAILY   = parseInt(process.env.RL_GLOBAL_DAILY) || 5000;

// ── Helper: consulta/actualiza contador en Supabase via REST ──
async function rlCheck(supaUrl, supaKey, ip) {
  const now = new Date();
  const windowStart = new Date(now.getTime() - WINDOW_MIN * 60000).toISOString();
  const today = now.toISOString().slice(0, 10); // YYYY-MM-DD

  const headers = {
    'apikey': supaKey,
    'Authorization': `Bearer ${supaKey}`,
    'Content-Type': 'application/json',
  };

  // 1. Contar llamadas de esta IP en la ventana
  const ipQ = `${supaUrl}/rest/v1/api_usage?select=id&ip=eq.${encodeURIComponent(ip)}&created_at=gte.${windowStart}`;
  const ipRes = await fetch(ipQ, { headers: { ...headers, 'Prefer': 'count=exact' } });
  const ipCount = parseInt((ipRes.headers.get('content-range') || '0/0').split('/')[1]) || 0;
  if (ipCount >= PER_IP_LIMIT) {
    return { ok: false, reason: 'ip_limit', count: ipCount };
  }

  // 2. Contar llamadas globales de hoy
  const gQ = `${supaUrl}/rest/v1/api_usage?select=id&created_at=gte.${today}T00:00:00`;
  const gRes = await fetch(gQ, { headers: { ...headers, 'Prefer': 'count=exact' } });
  const gCount = parseInt((gRes.headers.get('content-range') || '0/0').split('/')[1]) || 0;
  if (gCount >= GLOBAL_DAILY) {
    return { ok: false, reason: 'global_limit', count: gCount };
  }

  return { ok: true, ipCount, gCount };
}

// ── Helper: registra una llamada ──
async function rlRecord(supaUrl, supaKey, ip) {
  try {
    await fetch(`${supaUrl}/rest/v1/api_usage`, {
      method: 'POST',
      headers: {
        'apikey': supaKey,
        'Authorization': `Bearer ${supaKey}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal',
      },
      body: JSON.stringify({ ip, created_at: new Date().toISOString() }),
    });
  } catch (e) { /* no bloquear si falla el registro */ }
}

export default async function handler(req, res) {
  if (req.method !== 'POST' && req.method !== 'OPTIONS') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // CORS
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

  if (req.method === 'OPTIONS') return res.status(200).end();

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({
      error: 'Server not configured',
      detail: 'ANTHROPIC_API_KEY environment variable is missing.',
    });
  }

  // ── RATE LIMITING ──
  const supaUrl = process.env.SUPABASE_URL;
  const supaKey = process.env.SUPABASE_SERVICE_KEY;
  // IP del cliente (Vercel la pone en x-forwarded-for)
  const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim()
    || req.headers['x-real-ip'] || 'unknown';

  if (supaUrl && supaKey) {
    try {
      const rl = await rlCheck(supaUrl, supaKey, ip);
      if (!rl.ok) {
        const msg = rl.reason === 'ip_limit'
          ? `Rate limit reached: max ${PER_IP_LIMIT} AI requests per ${WINDOW_MIN} min. Please wait and try again.`
          : `Daily AI capacity reached. Please try again tomorrow.`;
        return res.status(429).json({ error: 'Rate limit', detail: msg, reason: rl.reason });
      }
    } catch (e) {
      // Si el rate limit falla, dejamos pasar (no romper el servicio) pero lo logueamos
      console.error('Rate limit check failed:', e.message);
    }
  }

  try {
    const { model, max_tokens, messages } = req.body || {};
    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: 'Invalid request: messages required' });
    }

    const safeModel = (typeof model === 'string' && model.startsWith('claude-'))
      ? model
      : 'claude-sonnet-4-20250514';
    const safeMaxTokens = Math.min(Math.max(parseInt(max_tokens) || 1000, 1), 2000);

    const anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({ model: safeModel, max_tokens: safeMaxTokens, messages }),
    });

    const data = await anthropicRes.json();

    if (!anthropicRes.ok) {
      return res.status(anthropicRes.status).json({
        error: 'Anthropic API error',
        detail: data.error?.message || 'Unknown error',
      });
    }

    // Registrar la llamada exitosa para el rate limit
    if (supaUrl && supaKey) {
      await rlRecord(supaUrl, supaKey, ip);
    }

    return res.status(200).json(data);
  } catch (err) {
    return res.status(500).json({ error: 'Proxy error', detail: err.message });
  }
}
