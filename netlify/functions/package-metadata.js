function json(statusCode, payload) {
  return {
    statusCode,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'public, max-age=120'
    },
    body: JSON.stringify(payload)
  };
}

function normalizeRecord(item) {
  const slug = String(item?.slug || '').trim();
  if (!slug) return null;

  const sizeRaw = Number(item?.tamanho);
  const sizeBytes = Number.isFinite(sizeRaw) && sizeRaw >= 0 ? Math.round(sizeRaw) : null;
  const updatedRaw = String(item?.ultimaModificacao || '').trim();
  const updatedAt = updatedRaw && !Number.isNaN(Date.parse(updatedRaw)) ? new Date(updatedRaw).toISOString() : null;

  return {
    slug,
    packageVersion: String(item?.versao || '').trim() || null,
    packageLastModified: updatedAt,
    packageSizeBytes: sizeBytes,
    packageChecksum: String(item?.checksum || '').trim() || null,
    packageFilename: String(item?.nomeFicheiro || '').trim() || null
  };
}

function buildPrivateHeaders() {
  const headers = { accept: 'application/json' };
  const apiKey = String(process.env.SHEETS_METADATA_API_KEY || '').trim();
  const apiKeyHeader = String(process.env.SHEETS_METADATA_API_KEY_HEADER || 'x-api-key').trim();
  const bearerToken = String(process.env.SHEETS_METADATA_BEARER_TOKEN || '').trim();

  if (apiKey && apiKeyHeader) {
    headers[apiKeyHeader] = apiKey;
  }
  if (bearerToken) {
    headers.authorization = `Bearer ${bearerToken}`;
  }

  return headers;
}

exports.handler = async function handler(event) {
  const sourceUrl = String(process.env.SHEETS_METADATA_URL || '').trim();
  if (!sourceUrl) {
    return json(500, { error: 'SHEETS_METADATA_URL não configurado no ambiente.' });
  }

  const slug = String(event?.queryStringParameters?.slug || '').trim();
  if (!slug) {
    return json(400, { error: 'Parâmetro "slug" em falta.' });
  }

  try {
    const response = await fetch(sourceUrl, {
      method: 'GET',
      headers: buildPrivateHeaders()
    });

    if (!response.ok) {
      return json(response.status, { error: `Fonte de metadata respondeu HTTP ${response.status}.` });
    }

    const payload = await response.json();
    const files = Array.isArray(payload?.files) ? payload.files : [];
    const found = files
      .map(normalizeRecord)
      .filter(Boolean)
      .find(item => item.slug === slug);

    if (!found) {
      return json(404, { error: 'Metadata não encontrada para este slug.' });
    }

    return json(200, { slug, ...found });
  } catch (error) {
    return json(502, {
      error: 'Falha ao obter metadata de pacotes.',
      details: error?.message || String(error)
    });
  }
};
