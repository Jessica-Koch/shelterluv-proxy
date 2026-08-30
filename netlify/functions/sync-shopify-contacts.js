const { fetchAllCustomers } = require('../../lib/shopify');
const { upsertContactByEmail } = require('../../lib/givebutter');

exports.handler = async function () {
  const shop = process.env.SHOPIFY_SHOP;
  const clientId = process.env.SHOPIFY_CLIENT_ID;
  const clientSecret = process.env.SHOPIFY_CLIENT_SECRET;
  const givebutterKey = process.env.GIVEBUTTER_API_KEY;

  if (!shop || !clientId || !clientSecret) {
    throw new Error('SHOPIFY_SHOP / SHOPIFY_CLIENT_ID / SHOPIFY_CLIENT_SECRET not configured');
  }
  if (!givebutterKey) {
    throw new Error('GIVEBUTTER_API_KEY not configured');
  }

  const customers = await fetchAllCustomers(shop, clientId, clientSecret);
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
