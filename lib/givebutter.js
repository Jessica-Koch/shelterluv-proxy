const GIVEBUTTER_BASE = 'https://api.givebutter.com/v1';

function authHeaders(apiKey) {
  return {
    Authorization: `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };
}

async function findContactByEmail(apiKey, email) {
  const url = new URL(`${GIVEBUTTER_BASE}/contacts`);
  url.searchParams.set('email', email);

  const res = await fetch(url, { headers: authHeaders(apiKey) });
  if (!res.ok) {
    throw new Error(`Givebutter GET contacts failed: ${res.status} ${await res.text()}`);
  }

  const data = await res.json();
  return data.data && data.data.length > 0 ? data.data[0] : null;
}

async function createContact(apiKey, payload) {
  const res = await fetch(`${GIVEBUTTER_BASE}/contacts`, {
    method: 'POST',
    headers: authHeaders(apiKey),
    body: JSON.stringify(payload),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(`Givebutter POST contacts failed: ${res.status} ${JSON.stringify(data)}`);
  }

  return data;
}

async function updateContact(apiKey, contactId, payload) {
  const res = await fetch(`${GIVEBUTTER_BASE}/contacts/${contactId}`, {
    method: 'PUT',
    headers: authHeaders(apiKey),
    body: JSON.stringify(payload),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(`Givebutter PUT contacts/${contactId} failed: ${res.status} ${JSON.stringify(data)}`);
  }

  return data;
}

// Looks up the contact by email first (Givebutter's own dedup on POST is undocumented,
// so we check explicitly) and creates or updates accordingly.
async function upsertContactByEmail(apiKey, { email, firstName, lastName, phone, externalId, tags }) {
  if (!email) {
    throw new Error('upsertContactByEmail requires an email');
  }

  const existing = await findContactByEmail(apiKey, email);

  const payload = {
    primary_email: email,
    first_name: firstName || null,
    last_name: lastName || null,
    ...(phone ? { primary_phone: phone } : {}),
    ...(externalId ? { external_id: externalId } : {}),
    ...(tags && tags.length ? { tags } : {}),
  };

  if (existing) {
    const contact = await updateContact(apiKey, existing.id, payload);
    return { action: 'updated', contact };
  }

  const contact = await createContact(apiKey, payload);
  return { action: 'created', contact };
}

module.exports = { findContactByEmail, createContact, updateContact, upsertContactByEmail };
