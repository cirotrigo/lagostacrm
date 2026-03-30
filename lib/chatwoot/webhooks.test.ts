import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { ChatwootWebhookPayload } from './types';
import { processWebhookEvent } from './webhooks';
import { resolveContactByIdentity } from '@/lib/messaging';

vi.mock('@/lib/messaging', () => ({
  resolveContactByIdentity: vi.fn(),
  linkContactToIdentity: vi.fn(),
}));

type QueryStub = {
  upsert: ReturnType<typeof vi.fn>;
  select: ReturnType<typeof vi.fn>;
  eq: ReturnType<typeof vi.fn>;
  is: ReturnType<typeof vi.fn>;
  maybeSingle: ReturnType<typeof vi.fn>;
  update: ReturnType<typeof vi.fn>;
  insert: ReturnType<typeof vi.fn>;
};

function createSupabaseStub() {
  const upsert = vi.fn().mockResolvedValue({ data: null, error: null });
  const maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });
  const update = vi.fn().mockResolvedValue({ data: null, error: null });
  const insert = vi.fn().mockResolvedValue({ data: null, error: null });

  const query: QueryStub = {
    upsert,
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    is: vi.fn().mockReturnThis(),
    maybeSingle,
    update,
    insert,
  };

  const from = vi.fn().mockImplementation(() => query);

  return {
    supabase: { from } as unknown as SupabaseClient,
    from,
    upsert,
  };
}

describe('processWebhookEvent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('resolves Instagram identity and upserts conversation link', async () => {
    const { supabase, upsert } = createSupabaseStub();
    vi.mocked(resolveContactByIdentity).mockResolvedValue({
      ok: true,
      data: {
        contactId: 'contact-instagram-1',
        identityId: 'identity-1',
        source: 'INSTAGRAM',
        externalId: '17841400000000000',
        resolutionMethod: 'identity',
      },
    });

    const payload = {
      event: 'conversation_created',
      account: { id: 1, name: 'acme' },
      inbox: { id: 10, channel_type: 'Channel::Instagram' },
      conversation: {
        id: 100,
        account_id: 1,
        inbox_id: 10,
        status: 'open',
        unread_count: 2,
        assignee: null,
        meta: {
          sender: {
            id: 50,
            name: 'Lead IG',
            identifier: '17841400000000000',
            created_at: '2026-02-15T00:00:00Z',
          },
          channel: 'Channel::Instagram',
        },
      },
    } as unknown as ChatwootWebhookPayload;

    await processWebhookEvent(
      supabase,
      'org-1',
      payload,
      'https://chatwoot.example.com'
    );

    expect(resolveContactByIdentity).toHaveBeenCalledWith(
      supabase,
      expect.objectContaining({
        organizationId: 'org-1',
        source: 'INSTAGRAM',
        externalId: '17841400000000000',
      })
    );

    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        organization_id: 'org-1',
        chatwoot_conversation_id: 100,
        chatwoot_inbox_id: 10,
        contact_id: 'contact-instagram-1',
      }),
      expect.objectContaining({ onConflict: 'organization_id,chatwoot_conversation_id' })
    );
  });

  it('resolves WhatsApp identity from phone and persists link', async () => {
    const { supabase, upsert } = createSupabaseStub();
    vi.mocked(resolveContactByIdentity).mockResolvedValue({
      ok: true,
      data: {
        contactId: 'contact-whatsapp-1',
        identityId: 'identity-2',
        source: 'WHATSAPP',
        externalId: '+5511999990000',
        resolutionMethod: 'phone',
      },
    });

    const payload = {
      event: 'conversation_created',
      account: { id: 2, name: 'acme' },
      inbox: { id: 11, channel_type: 'Channel::Whatsapp' },
      conversation: {
        id: 200,
        account_id: 2,
        inbox_id: 11,
        status: 'pending',
        unread_count: 0,
        assignee: null,
        meta: {
          sender: {
            id: 60,
            name: 'Lead WPP',
            phone_number: '+5511999990000',
            created_at: '2026-02-15T00:00:00Z',
          },
          channel: 'Channel::Whatsapp',
        },
      },
    } as unknown as ChatwootWebhookPayload;

    await processWebhookEvent(
      supabase,
      'org-2',
      payload,
      'https://chatwoot.example.com'
    );

    expect(resolveContactByIdentity).toHaveBeenCalledWith(
      supabase,
      expect.objectContaining({
        organizationId: 'org-2',
        source: 'WHATSAPP',
        externalId: '+5511999990000',
      })
    );

    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        organization_id: 'org-2',
        chatwoot_conversation_id: 200,
        status: 'pending',
        contact_id: 'contact-whatsapp-1',
      }),
      expect.any(Object)
    );
  });

  it('handles webhook reentry idempotently using upsert conflict key', async () => {
    const { supabase, upsert } = createSupabaseStub();
    vi.mocked(resolveContactByIdentity).mockResolvedValue({
      ok: true,
      data: {
        contactId: 'contact-instagram-1',
        identityId: 'identity-1',
        source: 'INSTAGRAM',
        externalId: '17841400000000000',
        resolutionMethod: 'identity',
      },
    });

    const payload = {
      event: 'conversation_created',
      account: { id: 1, name: 'acme' },
      inbox: { id: 10, channel_type: 'Channel::Instagram' },
      conversation: {
        id: 100,
        account_id: 1,
        inbox_id: 10,
        status: 'open',
        unread_count: 1,
        assignee: null,
        meta: {
          sender: {
            id: 50,
            name: 'Lead IG',
            identifier: '17841400000000000',
            created_at: '2026-02-15T00:00:00Z',
          },
          channel: 'Channel::Instagram',
        },
      },
    } as unknown as ChatwootWebhookPayload;

    await processWebhookEvent(supabase, 'org-1', payload, 'https://chatwoot.example.com');
    await processWebhookEvent(supabase, 'org-1', payload, 'https://chatwoot.example.com');

    expect(upsert).toHaveBeenCalledTimes(2);
    expect(upsert).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        organization_id: 'org-1',
        chatwoot_conversation_id: 100,
      }),
      expect.objectContaining({ onConflict: 'organization_id,chatwoot_conversation_id' })
    );
    expect(upsert).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        organization_id: 'org-1',
        chatwoot_conversation_id: 100,
      }),
      expect.objectContaining({ onConflict: 'organization_id,chatwoot_conversation_id' })
    );
  });
});
