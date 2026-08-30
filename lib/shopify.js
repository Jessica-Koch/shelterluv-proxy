const SHOPIFY_API_VERSION = '2024-10';

// Custom apps created via the Dev Dashboard (required as of Jan 2026) don't hand
// you a static Admin API token in the UI. Instead you exchange the app's Client ID
// and Client secret for a short-lived token via the client credentials grant.
// Tokens expire after 24h, so we cache and refresh a minute early.
let cachedToken = null;
let cachedTokenExpiresAt = 0;

async function getAccessToken(shop, clientId, clientSecret) {
  if (cachedToken && Date.now() < cachedTokenExpiresAt - 60_000) {
    return cachedToken;
  }

  const res = await fetch(`https://${shop}.myshopify.com/admin/oauth/access_token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: clientId,
      client_secret: clientSecret,
    }),
  });

  if (!res.ok) {
    throw new Error(`Shopify token exchange failed: ${res.status} ${await res.text()}`);
  }

  const data = await res.json();
  cachedToken = data.access_token;
  cachedTokenExpiresAt = Date.now() + data.expires_in * 1000;
  return cachedToken;
}

function parseNextLink(linkHeader) {
  if (!linkHeader) return null;

  for (const part of linkHeader.split(',')) {
    const [urlPart, relPart] = part.split(';').map((s) => s.trim());
    if (relPart === 'rel="next"') {
      return urlPart.slice(1, -1); // strip surrounding < >
    }
  }

  return null;
}

async function fetchAllCustomers(shop, clientId, clientSecret) {
  const customers = [];
  let url = `https://${shop}.myshopify.com/admin/api/${SHOPIFY_API_VERSION}/customers.json?limit=250`;

  while (url) {
    const accessToken = await getAccessToken(shop, clientId, clientSecret);
    const res = await fetch(url, {
      headers: { 'X-Shopify-Access-Token': accessToken },
    });

    if (!res.ok) {
      throw new Error(`Shopify API error: ${res.status} ${await res.text()}`);
    }

    const data = await res.json();
    customers.push(...(data.customers || []));
    url = parseNextLink(res.headers.get('link'));
  }

  return customers;
}

module.exports = { getAccessToken, fetchAllCustomers };
