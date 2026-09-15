export const MAX_REPAPERING_RECIPIENTS = 500;

export interface RepaperingRecipient {
  name: string;
  email: string;
}

export interface RecipientCsvResult {
  recipients: RepaperingRecipient[];
  errors: Array<{ row: number; message: string }>;
}

function parseRow(line: string): string[] | null {
  const result: string[] = [];
  let value = '';
  let quoted = false;
  let closedQuote = false;
  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    if (character === '"') {
      if (quoted && line[index + 1] === '"') {
        value += '"';
        index += 1;
      } else if (quoted) {
        quoted = false;
        closedQuote = true;
      } else {
        if (closedQuote || value.trim()) return null;
        quoted = true;
      }
    } else if (character === ',' && !quoted) {
      result.push(value.trim());
      value = '';
      closedQuote = false;
    } else {
      if (closedQuote && character.trim()) return null;
      value += character;
    }
  }
  if (quoted) return null;
  result.push(value.trim());
  return result;
}

const normalizeHeader = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, '');

export function parseRecipientCsv(text: string): RecipientCsvResult {
  const lines = text.replace(/^\uFEFF/, '').split(/\r\n|\n|\r/);
  const headerIndex = lines.findIndex((line) => line.trim());
  if (headerIndex < 0) return { recipients: [], errors: [{ row: 1, message: 'CSV is empty' }] };

  const headerValues = parseRow(lines[headerIndex]);
  if (!headerValues)
    return { recipients: [], errors: [{ row: headerIndex + 1, message: 'Malformed CSV header quoting' }] };
  const headers = headerValues.map(normalizeHeader);
  const names = headers
    .map((value, index) => (['name', 'fullname', 'residentname'].includes(value) ? index : -1))
    .filter((index) => index >= 0);
  const emails = headers
    .map((value, index) => (['email', 'emailaddress', 'residentemail'].includes(value) ? index : -1))
    .filter((index) => index >= 0);
  if (names.length !== 1 || emails.length !== 1) {
    return {
      recipients: [],
      errors: [{ row: headerIndex + 1, message: 'Header must include exactly one name and one email column' }],
    };
  }
  const nameIndex = names[0];
  const emailIndex = emails[0];

  const recipients: RepaperingRecipient[] = [];
  const errors: RecipientCsvResult['errors'] = [];
  const seen = new Set<string>();
  for (let index = headerIndex + 1; index < lines.length; index += 1) {
    if (!lines[index].trim()) continue;
    const row = index + 1;
    const values = parseRow(lines[index]);
    if (!values) {
      errors.push({ row, message: 'Malformed CSV quoting; use one recipient per line' });
      continue;
    }
    if (values.length !== headers.length) {
      errors.push({ row, message: 'Column count does not match the header' });
      continue;
    }
    const name = values[nameIndex]?.trim() ?? '';
    const email = (values[emailIndex]?.trim() ?? '').toLowerCase();
    if (!name) errors.push({ row, message: 'Name is required' });
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.push({ row, message: 'Email is invalid' });
    else if (seen.has(email)) errors.push({ row, message: 'Email is duplicated' });
    else {
      seen.add(email);
      recipients.push({ name, email });
    }
  }
  if (recipients.length > MAX_REPAPERING_RECIPIENTS) {
    return {
      recipients: [],
      errors: [{ row: 1, message: `A batch can contain at most ${MAX_REPAPERING_RECIPIENTS} recipients` }],
    };
  }
  return { recipients, errors };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Clones a field layout while changing only its recipient ownership metadata. */
export function retargetInstantJsonRecipient(
  value: unknown,
  sourceParticipantId: string,
  target: RepaperingRecipient & { participantId: string },
): unknown {
  if (Array.isArray(value)) {
    return value.map((entry) => retargetInstantJsonRecipient(entry, sourceParticipantId, target));
  }
  if (!isRecord(value)) return value;

  const result: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(value)) {
    if ((key === 'signerID' || key === 'recipientId') && entry === sourceParticipantId) {
      result[key] = target.participantId;
    } else if ((key === 'signerName' || key === 'recipientName') && typeof entry === 'string') {
      result[key] = target.name;
    } else if ((key === 'signerEmail' || key === 'recipientEmail') && typeof entry === 'string') {
      result[key] = target.email;
    } else result[key] = retargetInstantJsonRecipient(entry, sourceParticipantId, target);
  }
  return result;
}
