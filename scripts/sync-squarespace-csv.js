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
const { parse } = require('csv-parse/sync');
const { upsertContactByEmail } = require('../lib/givebutter');

const COLUMN_CANDIDATES = {
  email: ['email', 'e-mail', 'email address'],
  firstName: ['first name', 'firstname'],
  lastName: ['last name', 'lastname'],
  contactId: ['contact id', 'id'],
};

function findColumn(row, candidates) {
  const keys = Object.keys(row);
  const match = keys.find((k) => candidates.includes(k.trim().toLowerCase()));
  return match ? row[match] : undefined;
}

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
  const rows = parse(raw, { columns: true, skip_empty_lines: true, trim: true });

  if (rows.length === 0) {
    console.error('No rows found in CSV');
    process.exit(1);
  }

  console.log(`Parsed ${rows.length} rows from ${csvPath}`);
  console.log('Detected columns:', Object.keys(rows[0]).join(', '));

  let created = 0;
  let updated = 0;
  let skipped = 0;
  let failed = 0;

  for (const row of rows) {
    const email = findColumn(row, COLUMN_CANDIDATES.email);
    if (!email) {
      skipped++;
      continue;
    }

    const firstName = findColumn(row, COLUMN_CANDIDATES.firstName);
    const lastName = findColumn(row, COLUMN_CANDIDATES.lastName);
    const contactId = findColumn(row, COLUMN_CANDIDATES.contactId);

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
