/**
 * `useComposeSession` — a compose session and the draft behind it.
 *
 * A saved draft could not be sent: it opened read-only, the composer could not
 * be seeded from it, and a send never named it, so even a message composed in
 * one sitting left its autosaved copy in Drafts. These pin the whole cycle:
 * reopen, edit, send by draft id; undo; discard; and the signature that used
 * to count as content.
 */

const toast = Object.assign(jest.fn(), {
  success: jest.fn(),
  info: jest.fn(),
  warning: jest.fn(),
  error: jest.fn(),
});
jest.mock('@oxy.so/bloom', () => ({ toast }));

const sendWithUndo = jest.fn();
const scheduleMutate = jest.fn();
const saveDraft = jest.fn();
const discardDraft = jest.fn();
jest.mock('@/hooks/mutations/useMessageMutations', () => ({
  useSendMessageWithUndo: () => ({ sendWithUndo, isPending: false }),
  useSendMessage: () => ({ mutate: scheduleMutate, isPending: false }),
  useSaveDraft: () => ({ mutateAsync: saveDraft }),
  useDiscardDraft: () => ({ mutateAsync: discardDraft }),
}));

const getSettings = jest.fn();
jest.mock('@/hooks/useEmail', () => ({
  useEmailStore: (selector: (s: unknown) => unknown) => selector({ _api: { getSettings } }),
}));

const t = (key: string) => key;
jest.mock('@/lib/i18n', () => ({ useTranslation: () => ({ t }) }));

const storage = new Map<string, string>();
jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: async (key: string) => storage.get(key) ?? null,
    setItem: async (key: string, value: string) => void storage.set(key, value),
    removeItem: async (key: string) => void storage.delete(key),
  },
}));

import { act, renderHook } from '@testing-library/react';
import { __setOxyState } from '@oxy.so/services';
import { useComposeSession, type ComposeSessionOptions } from '@/hooks/useComposeSession';
import { MessageSchema } from '@/schemas/emailSchemas';
import { wireMessage } from '../fixtures/wire';
import { composeRecoveryStorageKey, saveComposeRecovery } from '@/utils/composeRecovery';

const DRAFT_FLAGS = { seen: true, starred: false, answered: false, forwarded: false, draft: true, pinned: false };

function savedDraft(overrides: Record<string, unknown> = {}) {
  return MessageSchema.parse(
    wireMessage({
      _id: 'draft-1',
      id: 'draft-1',
      mailboxId: 'drafts',
      flags: DRAFT_FLAGS,
      from: { name: 'Nate', address: 'nate@oxy.so' },
      to: [{ name: 'Ann', address: 'ann@example.com' }],
      cc: [{ name: '', address: 'cc@example.com' }],
      subject: 'Plan',
      text: 'Half written',
      html: null,
      attachments: [
        { fileId: 'f1', name: 'plan.pdf', contentType: 'application/pdf', size: 2048, contentId: null, isInline: false },
      ],
      inReplyTo: '<parent@example.com>',
      references: ['<root@example.com>', '<parent@example.com>'],
      draftRevision: 3,
      ...overrides,
    }),
  );
}

function options(overrides: Partial<ComposeSessionOptions> = {}): ComposeSessionOptions {
  return {
    recoveryIdentity: 'new',
    awaitingReplyHeaders: false,
    insertSignature: false,
    onFinished: jest.fn(),
    ...overrides,
  };
}

/** Let the recovery load and any queued promise chains settle. */
async function settle() {
  await act(async () => {
    for (let i = 0; i < 10; i++) await Promise.resolve();
  });
}

async function advance(ms: number) {
  await act(async () => {
    await jest.advanceTimersByTimeAsync(ms);
  });
}

beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
  storage.clear();
  __setOxyState({ user: { id: 'user-1', username: 'nate' } });
  getSettings.mockResolvedValue({ signature: '' });
  saveDraft.mockImplementation(async (payload: { existingDraftId?: string }) => ({
    _id: payload.existingDraftId ?? 'created-1',
    draftRevision: 1,
  }));
  discardDraft.mockResolvedValue(undefined);
});

afterEach(() => {
  jest.useRealTimers();
});

describe('reopening a saved draft', () => {
  it('seeds every field from the draft and starts saved', async () => {
    const { result } = renderHook(() => useComposeSession(options({ draft: savedDraft(), recoveryIdentity: 'draft:draft-1' })));
    await settle();

    // The recipient fields hold bare addresses (`joinAddresses`).
    expect(result.current.to).toBe('ann@example.com');
    expect(result.current.cc).toBe('cc@example.com');
    expect(result.current.subject).toBe('Plan');
    expect(result.current.body).toBe('Half written');
    expect(result.current.attachments).toEqual([
      { fileId: 'f1', name: 'plan.pdf', contentType: 'application/pdf', size: 2048 },
    ]);
    expect(result.current.isDirty).toBe(false);

    // Nothing changed, so nothing is saved.
    await advance(10_000);
    expect(saveDraft).not.toHaveBeenCalled();
  });

  it('saves edits over the same draft, at its revision', async () => {
    const { result } = renderHook(() => useComposeSession(options({ draft: savedDraft(), recoveryIdentity: 'draft:draft-1' })));
    await settle();

    act(() => result.current.setSubject('Plan v2'));
    await advance(8_000);

    expect(saveDraft).toHaveBeenCalledWith(
      expect.objectContaining({ existingDraftId: 'draft-1', expectedRevision: 3, subject: 'Plan v2' }),
    );
  });

  it('sends it by its id, with its attachments and threading headers', async () => {
    const draft = savedDraft();
    const { result } = renderHook(() =>
      useComposeSession(
        options({
          draft,
          recoveryIdentity: 'draft:draft-1',
          replyHeaders: { inReplyTo: '<parent@example.com>', references: draft.references },
        }),
      ),
    );
    await settle();

    await act(async () => {
      await result.current.send();
    });

    expect(sendWithUndo).toHaveBeenCalledWith(
      expect.objectContaining({
        draftId: 'draft-1',
        to: [{ address: 'ann@example.com' }],
        cc: [{ address: 'cc@example.com' }],
        subject: 'Plan',
        text: 'Half written',
        attachments: [{ fileId: 'f1' }],
        inReplyTo: '<parent@example.com>',
        references: ['<root@example.com>', '<parent@example.com>'],
      }),
      expect.any(Object),
    );
  });

  it('schedules it by its id too', async () => {
    const { result } = renderHook(() => useComposeSession(options({ draft: savedDraft(), recoveryIdentity: 'draft:draft-1' })));
    await settle();

    const when = new Date(Date.now() + 3_600_000);
    await act(async () => {
      await result.current.schedule(when);
    });

    expect(scheduleMutate).toHaveBeenCalledWith(
      expect.objectContaining({ draftId: 'draft-1', scheduledAt: when.toISOString() }),
      expect.any(Object),
    );
  });

  it('keeps the draft when only the unsaved changes are discarded', async () => {
    const onFinished = jest.fn();
    const { result } = renderHook(() =>
      useComposeSession(options({ draft: savedDraft(), recoveryIdentity: 'draft:draft-1', onFinished })),
    );
    await settle();
    act(() => result.current.setSubject('Never mind'));

    await act(async () => {
      await result.current.discardChanges();
    });

    expect(onFinished).toHaveBeenCalled();
    expect(discardDraft).not.toHaveBeenCalled();
  });

  it('deletes it when the draft itself is discarded', async () => {
    const { result } = renderHook(() => useComposeSession(options({ draft: savedDraft(), recoveryIdentity: 'draft:draft-1' })));
    await settle();

    await act(async () => {
      await result.current.discardDraft();
    });

    expect(discardDraft).toHaveBeenCalledWith('draft-1');
  });
});

describe('a new message', () => {
  it('sends with the id of the draft its autosave created', async () => {
    const { result } = renderHook(() => useComposeSession(options()));
    await settle();

    act(() => {
      result.current.setTo('ann@example.com');
      result.current.updateBody('Hello');
    });
    await advance(8_000);
    expect(saveDraft).toHaveBeenCalledTimes(1);

    await act(async () => {
      await result.current.send();
    });

    expect(sendWithUndo).toHaveBeenCalledWith(
      expect.objectContaining({ draftId: 'created-1', to: [{ address: 'ann@example.com' }] }),
      expect.any(Object),
    );
  });

  it('waits for a save in flight, so the send names the draft it is creating', async () => {
    let finishSave: (value: unknown) => void = () => {};
    saveDraft.mockImplementationOnce(() => new Promise((resolve) => (finishSave = resolve)));
    const { result } = renderHook(() => useComposeSession(options()));
    await settle();
    act(() => {
      result.current.setTo('ann@example.com');
      result.current.updateBody('Hello');
    });
    await advance(8_000); // the autosave is now in flight

    let sent: Promise<void> = Promise.resolve();
    act(() => {
      sent = result.current.send();
    });
    await settle();
    expect(sendWithUndo).not.toHaveBeenCalled();

    await act(async () => {
      finishSave({ _id: 'created-late', draftRevision: 1 });
      await sent;
    });
    expect(sendWithUndo).toHaveBeenCalledWith(
      expect.objectContaining({ draftId: 'created-late' }),
      expect.any(Object),
    );
  });

  it('sends without a draft id when nothing was ever saved', async () => {
    const { result } = renderHook(() => useComposeSession(options()));
    await settle();
    act(() => result.current.setTo('ann@example.com'));

    await act(async () => {
      await result.current.send();
    });

    expect(sendWithUndo.mock.calls[0][0]).not.toHaveProperty('draftId');
  });

  it('refuses to send when any address is invalid, instead of dropping it', async () => {
    const { result } = renderHook(() => useComposeSession(options()));
    await settle();
    act(() => {
      result.current.setTo('ann@example.com');
      result.current.setCc('not-an-address');
    });

    await act(async () => {
      await result.current.send();
    });

    expect(sendWithUndo).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledWith('compose.toast.invalidEmail (not-an-address)');
  });

  it('deletes the draft its autosave created when the changes are discarded', async () => {
    const { result } = renderHook(() => useComposeSession(options()));
    await settle();
    act(() => result.current.updateBody('Hello'));
    await advance(8_000);

    await act(async () => {
      await result.current.discardChanges();
    });

    expect(discardDraft).toHaveBeenCalledWith('created-1');
  });
});

describe('a reply or a link', () => {
  it('starts with nothing unsaved: no junk draft, and closing saves nothing', async () => {
    const onFinished = jest.fn();
    const { result } = renderHook(() =>
      useComposeSession(
        options({ initial: { to: 'ann@example.com', subject: 'Re: Plan' }, onFinished }),
      ),
    );
    await settle();
    await advance(8_000);

    expect(result.current.isDirty).toBe(false);
    expect(saveDraft).not.toHaveBeenCalled();
    await act(async () => {
      await result.current.saveAndClose();
    });
    expect(saveDraft).not.toHaveBeenCalled();
    expect(onFinished).toHaveBeenCalledTimes(1);
  });
});

describe('an address that does not parse yet', () => {
  it('keeps the edits unsaved, since the server draft left it out', async () => {
    const { result } = renderHook(() => useComposeSession(options()));
    await settle();
    act(() => {
      result.current.setTo('bob@example');
      result.current.updateBody('Hello');
    });
    await advance(8_000);

    expect(saveDraft).toHaveBeenCalledTimes(1);
    expect(result.current.isDirty).toBe(true);
  });
});

describe('a recovered message whose send was queued', () => {
  async function recoverQueued() {
    await saveComposeRecovery(composeRecoveryStorageKey('user-1', 'new'), {
      to: 'ann@example.com',
      cc: '',
      bcc: '',
      subject: 'Plan',
      body: 'Queued text',
      attachments: [],
      idempotencyKey: 'inbox-send-queued',
      queued: true,
    });
    const rendered = renderHook(() => useComposeSession(options()));
    await settle();
    return rendered;
  }

  it('sends again as the same message while it is unchanged', async () => {
    const { result } = await recoverQueued();
    expect(result.current.alreadyQueued).toBe(true);

    await act(async () => {
      await result.current.send();
    });
    expect(sendWithUndo.mock.calls[0][0]).toMatchObject({ idempotencyKey: 'inbox-send-queued' });
  });

  it('is a new message once it is edited, with a new key', async () => {
    const { result } = await recoverQueued();
    act(() => result.current.updateBody('Something else entirely'));
    await settle();
    expect(result.current.alreadyQueued).toBe(false);

    await act(async () => {
      await result.current.send();
    });
    expect(sendWithUndo.mock.calls[0][0].idempotencyKey).not.toBe('inbox-send-queued');
  });
});

describe('discarding inside the undo window', () => {
  it('calls the send off', async () => {
    const cancel = jest.fn(() => true);
    sendWithUndo.mockReturnValue({ cancel });
    const { result } = renderHook(() => useComposeSession(options()));
    await settle();
    act(() => result.current.setTo('ann@example.com'));
    await act(async () => {
      await result.current.send();
    });

    await act(async () => {
      await result.current.discardDraft();
    });
    expect(cancel).toHaveBeenCalledTimes(1);
  });
});

describe('undo', () => {
  it('leaves the composer live: saving works again after Undo', async () => {
    const { result } = renderHook(() => useComposeSession(options()));
    await settle();
    act(() => result.current.setTo('ann@example.com'));

    await act(async () => {
      await result.current.send();
    });
    const callbacks = sendWithUndo.mock.calls[0][1] as { onCancel: () => void };
    act(() => callbacks.onCancel());

    act(() => result.current.updateBody('One more line'));
    await advance(8_000);

    expect(saveDraft).toHaveBeenCalledTimes(1);
  });
});

describe('the signature', () => {
  it('is not content: no draft is saved and closing does not ask', async () => {
    getSettings.mockResolvedValue({ signature: 'Nate' });
    const onFinished = jest.fn();
    const { result } = renderHook(() => useComposeSession(options({ insertSignature: true, onFinished })));
    await settle();

    expect(result.current.body).toBe('\n\n--\nNate');
    expect(result.current.hasContent).toBe(false);

    await advance(10_000);
    expect(saveDraft).not.toHaveBeenCalled();

    await act(async () => {
      await result.current.saveAndClose();
    });
    expect(saveDraft).not.toHaveBeenCalled();
    expect(onFinished).toHaveBeenCalled();
  });

  it('puts a template above it', async () => {
    getSettings.mockResolvedValue({ signature: 'Nate' });
    const { result } = renderHook(() => useComposeSession(options({ insertSignature: true })));
    await settle();

    act(() => result.current.insertText('Thanks!'));

    expect(result.current.body).toBe('Thanks!\n\n--\nNate');
  });

  it('is left out of what AI reads and kept when AI rewrites the text above it', async () => {
    getSettings.mockResolvedValue({ signature: 'Nate' });
    const { result } = renderHook(() => useComposeSession(options({ insertSignature: true })));
    await settle();
    act(() => result.current.insertText('hey can u send it'));

    expect(result.current.ownText).toBe('hey can u send it');
    act(() => result.current.replaceOwnText('Could you send it, please?'));
    expect(result.current.body).toBe('Could you send it, please?\n\n--\nNate');
  });

  it('is not inserted into a reopened draft', async () => {
    getSettings.mockResolvedValue({ signature: 'Nate' });
    const { result } = renderHook(() =>
      useComposeSession(options({ draft: savedDraft(), recoveryIdentity: 'draft:draft-1', insertSignature: false })),
    );
    await settle();

    expect(getSettings).not.toHaveBeenCalled();
    expect(result.current.body).toBe('Half written');
  });
});

describe('a quote under the editable body', () => {
  it('is saved and sent after it', async () => {
    const { result } = renderHook(() =>
      useComposeSession(options({ trailer: '\n\n> quoted', recoveryIdentity: 'reply:p1' })),
    );
    await settle();
    act(() => {
      result.current.setTo('ann@example.com');
      result.current.updateBody('Sure');
    });
    await advance(8_000);

    expect(saveDraft).toHaveBeenCalledWith(expect.objectContaining({ text: 'Sure\n\n> quoted' }));

    await act(async () => {
      await result.current.send();
    });
    expect(sendWithUndo).toHaveBeenCalledWith(
      expect.objectContaining({ text: 'Sure\n\n> quoted' }),
      expect.any(Object),
    );
  });
});

describe('leaving without Send, Save or Discard', () => {
  it('keeps what was written as a draft', async () => {
    const { result, unmount } = renderHook(() => useComposeSession(options()));
    await settle();
    act(() => result.current.updateBody('Unfinished'));

    unmount();
    await settle();

    expect(saveDraft).toHaveBeenCalledWith(expect.objectContaining({ text: 'Unfinished' }));
  });

  it('does not save after a discard', async () => {
    const { result, unmount } = renderHook(() => useComposeSession(options()));
    await settle();
    act(() => result.current.updateBody('Unfinished'));

    await act(async () => {
      await result.current.discardChanges();
    });
    unmount();
    await settle();

    expect(saveDraft).not.toHaveBeenCalled();
  });
});
