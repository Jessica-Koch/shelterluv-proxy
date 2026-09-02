const { parseContactsCsv } = require('../../lib/squarespaceContacts');
const { upsertContactByEmail } = require('../../lib/givebutter');

// Squarespace's form Storage feature appends each submission as a row to a
// connected Google Sheet. That sheet is published to the web as CSV (File >
// Share > Publish to web), giving us a stable URL we can poll on a schedule
// instead of requiring a manual export.
exports.handler = async function () {
  const sheetCsvUrl = process.env.SQUARESPACE_SHEET_CSV_URL;
  const givebutterKey = process.env.GIVEBUTTER_API_KEY;

  if (!sheetCsvUrl) {
    throw new Error('SQUARESPACE_SHEET_CSV_URL not configured');
  }
  if (!givebutterKey) {
    throw new Error('GIVEBUTTER_API_KEY not configured');
  }

  const res = await fetch(sheetCsvUrl);
  if (!res.ok) {
    throw new Error(`Failed to fetch Squarespace contacts sheet: ${res.status} ${await res.text()}`);
  }

  const contacts = parseContactsCsv(await res.text());
  console.log(`Fetched ${contacts.length} rows from the Squarespace contacts sheet`);

  let created = 0;
  let updated = 0;
  let skipped = 0;
  let failed = 0;

  for (const { email, firstName, lastName, contactId } of contacts) {
    if (!email) {
      skipped++;
      continue;
    }

    try {
      const { action } = await upsertContactByEmail(givebutterKey, {
        email,
        firstName,
        lastName,
        externalId: contactId ? `squarespace:${contactId}` : undefined,
        tags: ['Squarespace'],
      });
      if (action === 'created') created++;
      else updated++;
    } catch (err) {
      console.error(`Failed to sync ${email}:`, err.message);
      failed++;
    }
  }

  const summary = { total: contacts.length, created, updated, skipped, failed };
  console.log('Sync complete:', summary);

  // Scheduled functions have no caller to read a response body, so return none.
  return { statusCode: 200 };
};
