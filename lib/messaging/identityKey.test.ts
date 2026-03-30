import {
  buildIdentityKey,
  parseIdentityKey,
  extractPhoneFromWhatsAppJid,
  buildWhatsAppKeyFromJid,
  isValidIdentityKey,
  getSourceFromKey,
  getExternalIdFromKey,
} from './identityKey';

describe('identityKey', () => {
  it('builds canonical WhatsApp key from local BR number', () => {
    expect(buildIdentityKey('WHATSAPP', '11999990000')).toBe('whatsapp:+5511999990000');
  });

  it('builds canonical Instagram key', () => {
    expect(buildIdentityKey('INSTAGRAM', '17841400000000000')).toBe('instagram:17841400000000000');
  });

  it('rejects invalid ids', () => {
    expect(buildIdentityKey('WHATSAPP', 'invalid')).toBeNull();
    expect(buildIdentityKey('INSTAGRAM', 'id with spaces')).toBeNull();
  });

  it('parses canonical key', () => {
    expect(parseIdentityKey('whatsapp:+5511999990000')).toEqual({
      source: 'WHATSAPP',
      externalId: '+5511999990000',
    });
  });

  it('extracts WhatsApp phone from JID', () => {
    expect(extractPhoneFromWhatsAppJid('5511999990000@c.us')).toBe('+5511999990000');
    expect(extractPhoneFromWhatsAppJid('5511999990000@s.whatsapp.net')).toBe('+5511999990000');
    expect(extractPhoneFromWhatsAppJid('5511999990000-123@g.us')).toBeNull();
  });

  it('builds WhatsApp key from JID', () => {
    expect(buildWhatsAppKeyFromJid('5511999990000@c.us')).toBe('whatsapp:+5511999990000');
  });

  it('validates and extracts parts of key', () => {
    const key = 'instagram:17841400000000000';
    expect(isValidIdentityKey(key)).toBe(true);
    expect(getSourceFromKey(key)).toBe('INSTAGRAM');
    expect(getExternalIdFromKey(key)).toBe('17841400000000000');
  });
});
