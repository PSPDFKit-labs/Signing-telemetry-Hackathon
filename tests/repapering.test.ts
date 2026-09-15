import { describe, expect, it } from 'vitest';
import { parseRecipientCsv, retargetInstantJsonRecipient } from '@/lib/repapering';

describe('parseRecipientCsv', () => {
  it('rejects ambiguous quoting instead of silently changing recipient names', () => {
    for (const name of ['A"B"', '"Alice"extra', '"Alice']) {
      const result = parseRecipientCsv(`name,email\n${name},alice@example.com`);
      expect(result.recipients).toEqual([]);
      expect(result.errors[0]).toEqual({ row: 2, message: 'Malformed CSV quoting; use one recipient per line' });
    }
  });

  it('preserves actual file row numbers across blank lines', () => {
    const result = parseRecipientCsv('\nname,email\n\nAlice,not-an-email\n');
    expect(result.errors).toEqual([{ row: 4, message: 'Email is invalid' }]);
  });

  it('accepts escaped quotes, CRLF, and a byte order mark', () => {
    expect(parseRecipientCsv('\uFEFFname,email\r\n"Alice ""A""",ALICE@example.com\r\n')).toEqual({
      recipients: [{ name: 'Alice "A"', email: 'alice@example.com' }],
      errors: [],
    });
  });

  it('rejects mismatched columns and ambiguous identity headers', () => {
    expect(parseRecipientCsv('name,email\nAlice,alice@example.com,extra').errors[0].message).toMatch(/Column count/);
    expect(parseRecipientCsv('name,email,email address\nAlice,a@example.com,b@example.com').recipients).toEqual([]);
    expect(parseRecipientCsv('"name,email\nAlice,a@example.com').errors[0].message).toMatch(/header quoting/);
  });
  it('parses quoted names and common Resident headers', () => {
    expect(parseRecipientCsv('Resident Name,Email Address\n"Haberern, Joe",JOE@example.com')).toEqual({
      recipients: [{ name: 'Haberern, Joe', email: 'joe@example.com' }],
      errors: [],
    });
  });

  it('reports invalid and duplicate rows', () => {
    const result = parseRecipientCsv(
      'name,email\nMissing,not-an-email\nResident,resident@example.com\nAgain,RESIDENT@example.com',
    );
    expect(result.recipients).toEqual([{ name: 'Resident', email: 'resident@example.com' }]);
    expect(result.errors).toEqual([
      { row: 2, message: 'Email is invalid' },
      { row: 4, message: 'Email is duplicated' },
    ]);
  });
});

describe('retargetInstantJsonRecipient', () => {
  it('changes field ownership and identity without altering unrelated data', () => {
    const source = {
      annotations: [
        {
          id: 'widget-1',
          customData: {
            signerID: 'template-participant',
            recipientId: 'template-participant',
            signerName: 'Template resident',
            signerEmail: 'template@example.com',
            type: 'signature',
          },
        },
      ],
      formFields: [{ name: 'signature_1' }],
    };
    expect(
      retargetInstantJsonRecipient(source, 'template-participant', {
        participantId: 'resident-42',
        name: 'Resident 42',
        email: 'resident42@example.com',
      }),
    ).toEqual({
      annotations: [
        {
          id: 'widget-1',
          customData: {
            signerID: 'resident-42',
            recipientId: 'resident-42',
            signerName: 'Resident 42',
            signerEmail: 'resident42@example.com',
            type: 'signature',
          },
        },
      ],
      formFields: [{ name: 'signature_1' }],
    });
  });
});
