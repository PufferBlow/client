// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  followRemoteAccount,
  getActorDocument,
  getActorOutbox,
  loadFederatedDirectMessages,
  resolveActorHandle,
  sendFederatedDirectMessage,
} from './activitypub';

const mockFetch = global.fetch as any;

describe('activitypub service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('resolves remote actors through WebFinger on the selected home instance', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ subject: 'acct:alice@example.org' }),
    });

    await resolveActorHandle('acct:alice@example.org', 'chat.pufferblow.social');

    expect(mockFetch).toHaveBeenCalledWith(
      'https://chat.pufferblow.social/.well-known/webfinger?resource=acct%3Aalice%40example.org',
      {
        method: 'GET',
        body: undefined,
        headers: {},
      },
    );
  });

  it('loads actor documents and outboxes from ActivityPub routes', async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ id: 'actor-1', type: 'Person' }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ id: 'outbox-1', type: 'OrderedCollectionPage', orderedItems: [] }),
      });

    await getActorDocument('user-1', 'https://chat.pufferblow.social');
    await getActorOutbox('user-1', 2, 50, 'https://chat.pufferblow.social');

    expect(mockFetch).toHaveBeenNthCalledWith(
      1,
      'https://chat.pufferblow.social/ap/users/user-1',
      {
        method: 'GET',
        body: undefined,
        headers: {},
      },
    );
    expect(mockFetch).toHaveBeenNthCalledWith(
      2,
      'https://chat.pufferblow.social/ap/users/user-1/outbox?page=2&limit=50',
      {
        method: 'GET',
        body: undefined,
        headers: {},
      },
    );
  });

  it('follows remote accounts through the home-instance federation route', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ status_code: 200, message: 'ok', result: {} }),
    });

    await followRemoteAccount('token-1', '@alice@example.org', 'localhost:7575');

    expect(mockFetch).toHaveBeenCalledWith('http://localhost:7575/api/v1/federation/follow', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        auth_token: 'token-1',
        remote_handle: '@alice@example.org',
      }),
    });
  });

  it('sends and loads federated direct messages through the home instance', async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ status_code: 200, message: 'queued', result: {} }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            status_code: 200,
            conversation_id: 'conv-1',
            peer_actor_uri: 'https://example.org/users/alice',
            messages: [],
          }),
      });

    await sendFederatedDirectMessage(
      {
        auth_token: 'token-1',
        peer: '@alice@example.org',
        message: 'hello',
      },
      'https://chat.pufferblow.social',
    );
    await loadFederatedDirectMessages(
      'token-1',
      '@alice@example.org',
      3,
      10,
      'https://chat.pufferblow.social',
    );

    expect(mockFetch).toHaveBeenNthCalledWith(
      1,
      'https://chat.pufferblow.social/api/v1/dms/send',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          auth_token: 'token-1',
          peer: '@alice@example.org',
          message: 'hello',
        }),
      },
    );
    expect(mockFetch).toHaveBeenNthCalledWith(
      2,
      'https://chat.pufferblow.social/api/v1/dms/messages?auth_token=token-1&peer=%40alice%40example.org&page=3&messages_per_page=10',
      {
        method: 'GET',
        body: undefined,
        headers: {},
      },
    );
  });
});
