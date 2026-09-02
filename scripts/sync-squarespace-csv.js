#!/usr/bin/env node
// Squarespace's Email Campaigns "Lists & Segments" contacts (e.g. Form Submitters)
// aren't reachable through any public Squarespace API, so this ingests a manual CSV
// export from that page and upserts each row into Givebutter.
try {
  require('dotenv').config();
} catch {
  // dotenv is optional; env vars can also be exported in the shell.
}

const fs = require('fs');
const path = require('path');
const { parseContactsCsv } = require('../lib/squarespaceContacts');
const { upsertContactByEmail } = require('../lib/givebutter');

async function main() {
  const csvPath = process.argv[2];
  if (!csvPath) {
    console.error('Usage: node scripts/sync-squarespace-csv.js <path-to-export.csv>');
    process.exit(1);
  }

  const givebutterKey = process.env.GIVEBUTTER_API_KEY;
  if (!givebutterKey) {
    console.error('GIVEBUTTER_API_KEY not set (add it to .env or export it in your shell)');
    process.exit(1);
  }

  const raw = fs.readFileSync(path.resolve(csvPath), 'utf8');
  const contacts = parseContactsCsv(raw);

  if (contacts.length === 0) {
    console.error('No rows found in CSV');
    process.exit(1);
  }

  console.log(`Parsed ${contacts.length} rows from ${csvPath}`);

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

  console.log(`Done. created=${created} updated=${updated} skipped(no email)=${skipped} failed=${failed}`);
}

main();
