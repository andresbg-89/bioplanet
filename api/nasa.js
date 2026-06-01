// ══════════════════════════════════════════════════════════
// PROXY PARA NASA EXOPLANET ARCHIVE — Vercel Serverless Function
// ──────────────────────────────────────────────────────────
// Evita problemas de CORS al consultar la API de NASA desde el
// navegador. Dos modos:
//   /api/nasa?q=kepler        → búsqueda por nombre
//   /api/nasa?adql=SELECT...  → consulta ADQL completa (validada)
//
// La API de NASA Exoplanet Archive es gratuita y sin API key.
// ══════════════════════════════════════════════════════════

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  let adql = '';

  // Modo 1: búsqueda por nombre (?q=)
  const q = (req.query.q || '').toString().trim();
  // Modo 2: consulta ADQL completa (?adql=)
  const rawAdql = (req.query.adql || '').toString().trim();

  if (q.length >= 2) {
    const safe = q.replace(/'/g, "''");
    adql = `SELECT TOP 25 pl_name,pl_rade,pl_bmasse,pl_eqt,pl_orbsmax,st_teff,sy_dist,disc_year,discoverymethod `
      + `FROM pscomppars WHERE UPPER(pl_name) LIKE UPPER('%${safe}%') ORDER BY pl_name`;
  } else if (rawAdql) {
    // Validación de seguridad: solo permitir SELECT de solo lectura
    const lower = rawAdql.toLowerCase();
    const forbidden = ['insert', 'update', 'delete', 'drop', 'alter', 'create', ';', '--'];
    if (!lower.startsWith('select') || forbidden.some(f => lower.includes(f))) {
      return res.status(400).json({ error: 'Only read-only SELECT queries allowed' });
    }
    adql = rawAdql;
  } else {
    return res.status(400).json({ error: 'Provide ?q= or ?adql=' });
  }

  const url = `https://exoplanetarchive.ipac.caltech.edu/TAP/sync?query=${encodeURIComponent(adql)}&format=json`;

  try {
    const nasaRes = await fetch(url, { headers: { 'User-Agent': 'BioPlanet/1.0' } });

    if (!nasaRes.ok) {
      return res.status(nasaRes.status).json({ error: 'NASA API error', status: nasaRes.status });
    }

    const text = await nasaRes.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch (e) {
      return res.status(502).json({ error: 'Invalid response from NASA', raw: text.slice(0, 200) });
    }

    res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate');
    return res.status(200).json(data);
  } catch (err) {
    return res.status(500).json({ error: 'Proxy error', detail: err.message });
  }
}
