const DEFAULT_SITE_URL = 'https://100nome.netlify.app';
const DISCORD_URL = 'https://discord.gg/FAsYZURnFW';

function resolveSiteUrl() {
  return (process.env.SITE_URL || DEFAULT_SITE_URL).replace(/\/$/, '');
}

function applyGlobalSiteLinks(html) {
  return String(html || '').replace(/https:\/\/discord\.gg\/[A-Za-z0-9]+/g, DISCORD_URL);
}

module.exports = {
  DEFAULT_SITE_URL,
  DISCORD_URL,
  resolveSiteUrl,
  applyGlobalSiteLinks
};
