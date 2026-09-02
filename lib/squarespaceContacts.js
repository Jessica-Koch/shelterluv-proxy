const { parse } = require('csv-parse/sync');

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

// Parses CSV text shaped like Squarespace's "Lists & Segments" contacts export
// (Email / First Name / Last Name / ...), whether it came from a manual export
// or a Google Sheet fed by a form's Storage connection.
function parseContactsCsv(csvText) {
  const rows = parse(csvText, { columns: true, skip_empty_lines: true, trim: true });

  return rows.map((row) => ({
    email: findColumn(row, COLUMN_CANDIDATES.email),
    firstName: findColumn(row, COLUMN_CANDIDATES.firstName),
    lastName: findColumn(row, COLUMN_CANDIDATES.lastName),
    contactId: findColumn(row, COLUMN_CANDIDATES.contactId),
  }));
}

module.exports = { parseContactsCsv };
