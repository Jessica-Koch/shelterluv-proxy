const { upsertContactByEmail } = require('../../lib/givebutter');

const SHOPIFY_API_VERSION = '2024-10';

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

async function fetchAllShopifyCustomers(shopDomain, accessToken) {
  const customers = [];
  let url = `https://${shopDomain}/admin/api/${SHOPIFY_API_VERSION}/customers.json?limit=250`;

  while (url) {
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

exports.handler = async function () {
  const shopDomain = process.env.SHOPIFY_STORE_DOMAIN;
  const shopifyToken = process.env.SHOPIFY_ACCESS_TOKEN;
  const givebutterKey = process.env.GIVEBUTTER_API_KEY;

  if (!shopDomain || !shopifyToken) {
    throw new Error('SHOPIFY_STORE_DOMAIN / SHOPIFY_ACCESS_TOKEN not configured');
  }
  if (!givebutterKey) {
    throw new Error('GIVEBUTTER_API_KEY not configured');
  }

  const customers = await fetchAllShopifyCustomers(shopDomain, shopifyToken);
  console.log(`Fetched ${customers.length} Shopify customers`);

  let created = 0;
  let updated = 0;
  let skipped = 0;
  let failed = 0;

  for (const customer of customers) {
    const email = customer.email;
    if (!email) {
      skipped++;
      continue;
    }

    try {
      const { action } = await upsertContactByEmail(givebutterKey, {
        email,
        firstName: customer.first_name,
        lastName: customer.last_name,
        phone: customer.phone,
        externalId: `shopify:${customer.id}`,
        tags: ['Shopify'],
      });
      if (action === 'created') created++;
      else updated++;
    } catch (err) {
      console.error(`Failed to sync ${email}:`, err.message);
      failed++;
    }
  }

  const summary = { total: customers.length, created, updated, skipped, failed };
  console.log('Sync complete:', summary);

  return {
    statusCode: 200,
    body: JSON.stringify({ ok: true, ...summary }),
  };
};
