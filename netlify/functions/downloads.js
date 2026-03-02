const DEFAULT_UPSTREAM_BASE = 'https://100nome-api.netlify.app/.netlify/functions';

function json(statusCode, payload) {
  return {
    statusCode,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store'
    },
    body: JSON.stringify(payload)
  };
}

function buildPrivateHeaders() {
  const headers = { accept: 'application/json' };
  const apiKey = String(process.env.DOWNLOADS_API_PRIVATE_KEY || '').trim();
  const apiKeyHeader = String(process.env.DOWNLOADS_API_KEY_HEADER || 'x-api-key').trim();
  const bearerToken = String(process.env.DOWNLOADS_API_BEARER_TOKEN || '').trim();

  if (apiKey && apiKeyHeader) {
    headers[apiKeyHeader] = apiKey;
  }
  if (bearerToken) {
    headers.authorization = `Bearer ${bearerToken}`;
  }

  return headers;
}

exports.handler = async function handler(event) {
  const action = String(event?.queryStringParameters?.action || 'count').trim().toLowerCase();
  const id = String(event?.queryStringParameters?.id || '').trim();

  if (!id) {
    return json(400, { error: 'Parâmetro "id" em falta.' });
  }
  if (!['count', 'download'].includes(action)) {
    return json(400, { error: 'Parâmetro "action" inválido. Usa "count" ou "download".' });
  }

  const upstreamBase = String(process.env.DOWNLOADS_UPSTREAM_BASE_URL || DEFAULT_UPSTREAM_BASE).trim().replace(/\/$/, '');
  const upstreamUrl = `${upstreamBase}/${action}?id=${encodeURIComponent(id)}`;

  try {
    const response = await fetch(upstreamUrl, {
      method: 'GET',
      headers: buildPrivateHeaders()
    });
    const text = await response.text();
    const payload = text ? JSON.parse(text) : {};

    return json(response.status, payload);
  } catch (error) {
    return json(502, {
      error: 'Falha ao contactar serviço de downloads.',
      details: error?.message || String(error)
    });
  }
};
