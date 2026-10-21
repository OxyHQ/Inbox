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

const routerPush = jest.fn();
jest.mock('expo-router', () => ({ useRouter: () => ({ push: routerPush }) }));

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

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook as render } from '@testing-library/react';
import { createElement, type ReactNode } from 'react';
import { __setOxyState } from '@oxy.so/services/ui/client';
import {
  alreadySentNotice,
  draftConflictKind,
  useComposeSession,
  type ComposeSessionOptions,
} from '@/hooks/useComposeSession';
import { type AlreadySent, alreadySentUnderKey } from '@/utils/sendIdempotency';
import { MessageSchema } from '@/schemas/emailSchemas';
import { wireMessage } from '../fixtures/wire';
import {
  composeRecoveryStorageKey,
  loadComposeRecovery,
  saveComposeRecovery,
} from '@/utils/composeRecovery';
import { keyReusedError } from '../fixtures/sendKeyReused';

/** Each test with its own query cache: the settings are read through it. */
const renderHook: typeof render = (callback, options) => {
  const client = new QueryClient();
  const wrapper = ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client }, children);
  return render(callback, { ...options, wrapper } as typeof options);
};

const DRAFT_FLAGS = {
  seen: true,
  starred: false,
  answered: false,
  forwarded: false,
  draft: true,
  pinned: false,
};

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
        {
          fileId: 'f1',
          name: 'plan.pdf',
          contentType: 'application/pdf',
          size: 2048,
          contentId: null,
          isInline: false,
        },
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
    const { result } = renderHook(() =>
      useComposeSession(options({ draft: savedDraft(), recoveryIdentity: 'draft:draft-1' })),
    );
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
    const { result } = renderHook(() =>
      useComposeSession(options({ draft: savedDraft(), recoveryIdentity: 'draft:draft-1' })),
    );
    await settle();

    act(() => result.current.setSubject('Plan v2'));
    await advance(8_000);

    expect(saveDraft).toHaveBeenCalledWith(
      expect.objectContaining({
        existingDraftId: 'draft-1',
        expectedRevision: 3,
        subject: 'Plan v2',
      }),
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
    const { result } = renderHook(() =>
      useComposeSession(options({ draft: savedDraft(), recoveryIdentity: 'draft:draft-1' })),
    );
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
      useComposeSession(
        options({ draft: savedDraft(), recoveryIdentity: 'draft:draft-1', onFinished }),
      ),
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
    const { result } = renderHook(() =>
      useComposeSession(options({ draft: savedDraft(), recoveryIdentity: 'draft:draft-1' })),
    );
    await settle();

    await act(async () => {
      await result.current.discardDraft();
    });

    expect(discardDraft).toHaveBeenCalledWith('draft-1');
  });
});

/** A 409 as `HttpService` throws it: the status, and the body's `details`. */
function conflictError(message: string, details: Record<string, unknown>) {
  return Object.assign(new Error(message), {
    status: 409,
    details,
    response: { status: 409, data: { error: 'CONFLICT', message, details } },
  });
}

describe('a save the API refuses with 409', () => {
  it('tells a draft that was sent or deleted from one changed elsewhere', () => {
    expect(
      draftConflictKind(
        conflictError('Draft was sent or deleted', { draftId: 'draft-1', currentRevision: null }),
      ),
    ).toBe('gone');
    expect(
      draftConflictKind(conflictError('Draft changed on another device', { currentRevision: 4 })),
    ).toBe('changed');
    // Only the body's details, as another error path may carry them.
    expect(
      draftConflictKind({
        response: { status: 409, data: { details: { currentRevision: null } } },
      }),
    ).toBe('gone');
    expect(draftConflictKind({ status: 0, response: { status: 409 } })).toBe('changed');
    expect(draftConflictKind(Object.assign(new Error('boom'), { status: 500 }))).toBeNull();
  });

  it('says the draft is gone and saves the edits as a new draft, never over it', async () => {
    saveDraft.mockRejectedValueOnce(
      conflictError('Draft was sent or deleted', { draftId: 'draft-1', currentRevision: null }),
    );
    const { result } = renderHook(() =>
      useComposeSession(options({ draft: savedDraft(), recoveryIdentity: 'draft:draft-1' })),
    );
    await settle();

    act(() => result.current.setSubject('Plan v2'));
    await advance(8_000);
    expect(toast.error).toHaveBeenCalledWith('compose.toast.draftGoneConflict');
    expect(result.current.draftSaveError).toBe(true);

    act(() => result.current.setSubject('Plan v3'));
    await advance(8_000);
    const retry = saveDraft.mock.calls[1][0];
    expect(retry).toEqual(expect.objectContaining({ subject: 'Plan v3' }));
    expect(retry.existingDraftId).toBeUndefined();
    expect(retry).not.toHaveProperty('expectedRevision');

    // The new copy is this session's: the send names it.
    await act(async () => {
      await result.current.send();
    });
    expect(sendWithUndo).toHaveBeenCalledWith(
      expect.objectContaining({ draftId: 'created-1' }),
      expect.any(Object),
    );
  });

  it('says the draft changed elsewhere when another device saved it', async () => {
    saveDraft.mockRejectedValueOnce(
      conflictError('Draft changed on another device', { currentRevision: 4 }),
    );
    const { result } = renderHook(() =>
      useComposeSession(options({ draft: savedDraft(), recoveryIdentity: 'draft:draft-1' })),
    );
    await settle();

    act(() => result.current.setSubject('Plan v2'));
    await advance(8_000);
    expect(toast.error).toHaveBeenCalledWith('compose.toast.draftConflict');
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

  it('schedules nothing when it is discarded during the save before the send', async () => {
    let finishSave: (value: unknown) => void = () => {};
    const { result } = renderHook(() => useComposeSession(options()));
    await settle();
    act(() => {
      result.current.setTo('ann@example.com');
      result.current.updateBody('Hello');
    });
    saveDraft.mockImplementationOnce(() => new Promise((resolve) => (finishSave = resolve)));

    let scheduled: Promise<void> = Promise.resolve();
    act(() => {
      scheduled = result.current.schedule(new Date(Date.now() + 3_600_000));
    });
    await settle();
    let discarded: Promise<void> = Promise.resolve();
    act(() => {
      discarded = result.current.discardDraft();
    });
    await act(async () => {
      finishSave({ _id: 'created-1', draftRevision: 1 });
      await scheduled;
      await discarded;
    });

    expect(scheduleMutate).not.toHaveBeenCalled();
    expect(discardDraft).toHaveBeenCalledWith('created-1');
  });

  it('starts a forward with the forwarded files, which are not writing', async () => {
    const attachment = { fileId: 'f1', name: 'plan.pdf', contentType: 'application/pdf', size: 1 };
    const { result } = renderHook(() =>
      useComposeSession(options({ initial: { to: 'ann@example.com', attachments: [attachment] } })),
    );
    await settle();

    expect(result.current.attachments).toEqual([attachment]);
    expect(result.current.hasUnsavedWork).toBe(false);
    await act(async () => {
      await result.current.send();
    });
    expect(sendWithUndo.mock.calls[0][0].attachments).toEqual([{ fileId: 'f1' }]);
  });

  it('sends without a draft id when nothing was ever saved', async () => {
    // A reply or a link starts with its fields: not writing, so no draft.
    const { result } = renderHook(() =>
      useComposeSession(options({ initial: { to: 'ann@example.com', subject: 'Hi' } })),
    );
    await settle();

    await act(async () => {
      await result.current.send();
    });

    expect(saveDraft).not.toHaveBeenCalled();
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

describe('closing with nothing written', () => {
  // The editor re-serialises what it was given on mount; the recipients field
  // reformats its list. Neither is writing, and neither may leave a draft.
  it('saves no draft for a reply whose fields only changed form', async () => {
    const onFinished = jest.fn();
    const { result, unmount } = renderHook(() =>
      useComposeSession(
        options({ initial: { to: 'ann@example.com', subject: 'Re: Plan' }, onFinished }),
      ),
    );
    await settle();
    act(() => {
      result.current.updateBody('\n');
      result.current.setTo('ann@example.com, ');
    });

    expect(result.current.isDirty).toBe(true);
    expect(result.current.hasContent).toBe(false);
    expect(result.current.hasUnsavedWork).toBe(false);
    await advance(10_000);
    await act(async () => {
      await result.current.saveAndClose();
    });
    unmount();
    await settle();

    expect(saveDraft).not.toHaveBeenCalled();
    expect(onFinished).toHaveBeenCalledTimes(1);
  });

  it('saves none when it is left by navigating away either', async () => {
    getSettings.mockResolvedValue({ signature: 'Nate' });
    const { result, unmount } = renderHook(() =>
      useComposeSession(options({ insertSignature: true })),
    );
    await settle();
    act(() => result.current.updateBody(`${result.current.body}\n`));

    unmount();
    await settle();

    expect(saveDraft).not.toHaveBeenCalled();
  });

  it('deletes the draft an autosave made once everything written is erased', async () => {
    const onFinished = jest.fn();
    const { result } = renderHook(() => useComposeSession(options({ onFinished })));
    await settle();
    act(() => result.current.updateBody('Hello'));
    await advance(8_000);
    expect(saveDraft).toHaveBeenCalledTimes(1);

    act(() => result.current.updateBody(''));
    await act(async () => {
      await result.current.saveAndClose();
    });

    expect(saveDraft).toHaveBeenCalledTimes(1);
    expect(discardDraft).toHaveBeenCalledWith('created-1');
    expect(onFinished).toHaveBeenCalledTimes(1);
  });

  it('still saves a subject or a recipient the user typed', async () => {
    const { result } = renderHook(() => useComposeSession(options()));
    await settle();
    act(() => result.current.setSubject('Lunch?'));

    await act(async () => {
      await result.current.saveAndClose();
    });

    expect(saveDraft).toHaveBeenCalledWith(expect.objectContaining({ subject: 'Lunch?' }));
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

describe('a recovered message', () => {
  it('sends again under its own key, so the API sees the same message', async () => {
    await saveComposeRecovery(composeRecoveryStorageKey('user-1', 'new'), {
      to: 'ann@example.com',
      cc: '',
      bcc: '',
      subject: 'Plan',
      body: 'Recovered text',
      attachments: [],
      idempotencyKey: 'inbox-send-recovered',
    });
    const { result } = renderHook(() => useComposeSession(options()));
    await settle();

    await act(async () => {
      await result.current.send();
    });
    expect(sendWithUndo.mock.calls[0][0]).toMatchObject({
      idempotencyKey: 'inbox-send-recovered',
    });
  });
});

describe('a compose the API already sent under its key', () => {
  /**
   * Restored after a crash, the composer resumes its key, but the body renders
   * differently (a new build, a new signature), so the API refuses the key as
   * reused for a different message (422, OxyHQ/oxy#1676). Unchanged since the
   * restore, the message WAS sent before the crash: the session ends as sent.
   * Edited, it is a new message: closing it as "already sent" threw the edits
   * away, and resending on its own could deliver the same message twice.
   */
  const recoveryKey = composeRecoveryStorageKey('user-1', 'new');
  const RECOVERED_KEY = 'inbox-send-recovered';

  function sentVersion(overrides: Partial<AlreadySent> = {}): AlreadySent {
    return {
      id: 'sent-row-1',
      messageId: '<m@oxy.so>',
      deliveryState: 'sent',
      scheduledAt: null,
      ...overrides,
    };
  }

  async function recoveredSession(onFinished = jest.fn()) {
    await saveComposeRecovery(recoveryKey, {
      to: 'ann@example.com',
      cc: '',
      bcc: '',
      subject: 'Plan',
      body: 'Recovered text',
      attachments: [],
      idempotencyKey: RECOVERED_KEY,
    });
    const rendered = renderHook(() => useComposeSession(options({ onFinished })));
    await settle();
    return { ...rendered, onFinished };
  }

  /** Send, and have it refused as `useSendMessageWithUndo` reports it. */
  async function sendRefused(
    result: { current: ReturnType<typeof useComposeSession> },
    sent: AlreadySent = sentVersion(),
  ) {
    const call = sendWithUndo.mock.calls.length;
    await act(async () => {
      await result.current.send();
    });
    const [payload, callbacks] = sendWithUndo.mock.calls[call] as [
      { idempotencyKey: string },
      { onAlreadySent?: (sent: AlreadySent) => void },
    ];
    act(() => callbacks.onAlreadySent?.(sent));
    await settle();
    return payload.idempotencyKey;
  }

  async function edit(result: { current: ReturnType<typeof useComposeSession> }) {
    act(() => result.current.updateBody('Recovered text, and a correction'));
    // Long enough for the local snapshot to keep it, not for an autosave.
    await advance(1_000);
  }

  describe('unchanged since the restore', () => {
    it('closes as a send that went through, linking to what was sent', async () => {
      const { result, onFinished } = await recoveredSession();
      expect(await sendRefused(result)).toBe(RECOVERED_KEY);

      expect(onFinished).toHaveBeenCalledTimes(1);
      expect(toast.error).not.toHaveBeenCalled();
      expect(toast.info).toHaveBeenCalledWith(
        'compose.alreadySent.closedSent',
        expect.objectContaining({
          action: expect.objectContaining({ label: 'compose.alreadySent.view' }),
        }),
      );
      const [, { action }] = toast.info.mock.calls[0];
      action.onClick();
      expect(routerPush).toHaveBeenCalledWith('/conversation/sent-row-1');
      // The server holds the message; the crash snapshot has done its job.
      expect(await loadComposeRecovery(recoveryKey)).toBeNull();
    });

    it('discards the draft this session left, a stale copy of what is in Sent', async () => {
      const { result } = await recoveredSession();
      await sendRefused(result);

      // The send saved the restored text first (`saveBeforeSend`).
      expect(saveDraft).toHaveBeenCalledTimes(1);

      expect(sendWithUndo.mock.calls[0][0]).toMatchObject({ draftId: 'created-1' });
      expect(discardDraft).toHaveBeenCalledWith('created-1');
    });

    it('is over: nothing saves it, sends it again, or asks to keep it', async () => {
      const { result, onFinished, unmount } = await recoveredSession();
      await sendRefused(result);

      await act(async () => {
        await result.current.send();
      });
      expect(sendWithUndo).toHaveBeenCalledTimes(1);

      await act(async () => {
        await result.current.saveAndClose();
      });
      expect(onFinished).toHaveBeenCalledTimes(2);

      await advance(10_000);
      unmount();
      await settle();
      // Only the save the send made before it went; that draft is gone too.
      expect(saveDraft).toHaveBeenCalledTimes(1);
      expect(discardDraft).toHaveBeenCalledTimes(1);
    });

    it('only says so when the API cannot name the message', async () => {
      const { result, onFinished } = await recoveredSession();
      await sendRefused(result, sentVersion({ id: null }));

      expect(onFinished).toHaveBeenCalledTimes(1);
      expect(toast.info).toHaveBeenCalledWith('compose.alreadySent.closedSent', undefined);
    });

    it('closes a scheduled send the same way', async () => {
      const { result, onFinished } = await recoveredSession();
      await act(async () => {
        await result.current.schedule(new Date('2030-01-01T09:00:00Z'));
      });
      const [, callbacks] = scheduleMutate.mock.calls[0] as [
        unknown,
        { onError: (err: Error) => void },
      ];
      act(() =>
        callbacks.onError(
          keyReusedError({
            id: 'scheduled-row-1',
            deliveryState: 'scheduled',
            scheduledAt: '2030-01-01T09:00:00.000Z',
          }),
        ),
      );
      await settle();

      expect(onFinished).toHaveBeenCalledTimes(1);
      expect(toast.error).not.toHaveBeenCalled();
      const [notice, { action }] = toast.info.mock.calls[0];
      expect(notice).toBe('compose.alreadySent.closedScheduled');
      action.onClick();
      expect(routerPush).toHaveBeenCalledWith('/conversation/scheduled-row-1');
      expect(await loadComposeRecovery(recoveryKey)).toBeNull();
    });

    it.each(['failed', 'cancelled'] as const)(
      'stays open when the version already sent %s, and asks',
      async (deliveryState) => {
        const { result, onFinished } = await recoveredSession();
        await sendRefused(result, sentVersion({ deliveryState }));

        expect(onFinished).not.toHaveBeenCalled();
        expect(toast.info).not.toHaveBeenCalled();
        expect(discardDraft).not.toHaveBeenCalled();
        expect(result.current.sentVersion?.notice).toBe(
          deliveryState === 'failed'
            ? 'compose.alreadySent.versionFailed'
            : 'compose.alreadySent.versionCancelled',
        );
        expect(result.current.sendDisabled).toBe(false);
      },
    );
  });

  describe('edited after the restore', () => {
    /**
     * The restored key may have sent the first version before the crash. A
     * new key for the edits would send them as a second message without a
     * word; under the old one the API refuses them and the composer asks.
     */
    it('is sent under the restored key, and the refusal asks', async () => {
      const { result, onFinished } = await recoveredSession();
      await edit(result);
      expect(await sendRefused(result)).toBe(RECOVERED_KEY);

      expect(onFinished).not.toHaveBeenCalled();
      expect(result.current.body).toBe('Recovered text, and a correction');
      expect(result.current.sentVersion?.notice).toBe('compose.alreadySent.versionSent');
    });

    it('keeps the restored key after a send that got no answer and more edits', async () => {
      const { result } = await recoveredSession();
      await edit(result);
      await act(async () => {
        await result.current.send();
      });
      const callbacks = sendWithUndo.mock.calls[0][1] as { onError: (err: unknown) => void };
      act(() => callbacks.onError(new Error('timeout')));
      await settle();
      act(() => result.current.updateBody('Recovered text, corrected twice'));
      await settle();
      await act(async () => {
        await result.current.send();
      });

      expect(sendWithUndo.mock.calls[1][0].idempotencyKey).toBe(RECOVERED_KEY);
    });

    it('refused all the same: stays open with the edits, and sends as new only when told', async () => {
      const { result, onFinished } = await recoveredSession();
      await edit(result);
      const refusedKey = await sendRefused(result);

      expect(onFinished).not.toHaveBeenCalled();
      expect(toast.info).not.toHaveBeenCalled();
      expect(toast.error).not.toHaveBeenCalled();
      expect(result.current.body).toBe('Recovered text, and a correction');
      // The send saved the edits as a draft before it went; it is kept.
      expect(saveDraft).toHaveBeenLastCalledWith(
        expect.objectContaining({ text: 'Recovered text, and a correction' }),
      );
      expect(discardDraft).not.toHaveBeenCalled();
      expect(result.current.sentVersion).toMatchObject({
        notice: 'compose.alreadySent.versionSent',
        sent: { id: 'sent-row-1' },
      });
      // Nothing goes out on its own.
      await advance(10_000);
      expect(sendWithUndo).toHaveBeenCalledTimes(1);

      const version = result.current.sentVersion;
      if (!version) throw new Error('no question was asked');
      await act(async () => {
        result.current.sendAsNew(version);
        await Promise.resolve();
      });
      await settle();

      expect(result.current.sentVersion).toBeNull();
      expect(sendWithUndo).toHaveBeenCalledTimes(2);
      const resent = sendWithUndo.mock.calls[1][0];
      expect(resent.idempotencyKey).not.toBe(refusedKey);
      expect(resent.idempotencyKey).not.toBe(RECOVERED_KEY);
      expect(resent.text).toBe('Recovered text, and a correction');
      expect(discardDraft).not.toHaveBeenCalled();
    });

    it('keeps editing, unsent, when the user says not now', async () => {
      const { result, onFinished } = await recoveredSession();
      await edit(result);
      await sendRefused(result);

      act(() => result.current.dismissSentVersion());

      expect(result.current.sentVersion).toBeNull();
      expect(onFinished).not.toHaveBeenCalled();
      expect(sendWithUndo).toHaveBeenCalledTimes(1);
    });

    it('a scheduled send asks too, and is scheduled for the same time as new', async () => {
      const { result, onFinished } = await recoveredSession();
      await edit(result);
      const at = new Date('2030-01-01T09:00:00Z');
      await act(async () => {
        await result.current.schedule(at);
      });
      const [refused, callbacks] = scheduleMutate.mock.calls[0] as [
        { idempotencyKey: string },
        { onError: (err: Error) => void },
      ];
      act(() => callbacks.onError(keyReusedError()));
      await settle();

      expect(onFinished).not.toHaveBeenCalled();
      const version = result.current.sentVersion;
      if (!version) throw new Error('no question was asked');
      await act(async () => {
        result.current.sendAsNew(version);
        await Promise.resolve();
      });
      await settle();

      const [rescheduled] = scheduleMutate.mock.calls[1] as [
        { idempotencyKey: string; scheduledAt: string },
      ];
      expect(rescheduled.scheduledAt).toBe(at.toISOString());
      expect(rescheduled.idempotencyKey).not.toBe(refused.idempotencyKey);
    });
  });

  describe('refused after the composer has gone', () => {
    /**
     * Closed inside the undo window, or navigated away from: the question has
     * no composer to ask in, so a refusal that does not end the session is
     * said in a toast instead of nowhere. Nothing is sent.
     */
    async function closedThenRefused(
      sent: AlreadySent,
      {
        saveFails = false,
        reopen = '/compose',
      }: { saveFails?: boolean; reopen?: ComposeSessionOptions['reopen'] | null } = {},
    ) {
      // Without a server draft — the save before the send failed — the local
      // snapshot is all that holds the text.
      if (saveFails) saveDraft.mockRejectedValue(new Error('offline'));
      await saveComposeRecovery(recoveryKey, {
        to: 'ann@example.com',
        cc: '',
        bcc: '',
        subject: 'Plan',
        body: 'Recovered text',
        attachments: [],
        idempotencyKey: RECOVERED_KEY,
      });
      const rendered = renderHook(() =>
        useComposeSession(options({ reopen: reopen ?? undefined })),
      );
      await settle();
      await edit(rendered.result);
      await act(async () => {
        await rendered.result.current.send();
      });
      await act(async () => {
        await rendered.result.current.saveAndClose();
      });
      rendered.unmount();
      const callbacks = sendWithUndo.mock.calls[0][1] as {
        onAlreadySent?: (sent: AlreadySent) => void;
      };
      act(() => callbacks.onAlreadySent?.(sent));
      await settle();
    }

    /** The labels and handlers of the toast's buttons, whichever slot they are in. */
    function toastButtons(): Record<string, () => void> {
      const [, opts] = toast.warning.mock.calls[0] as [
        string,
        { action?: { label: string; onClick: () => void }; cancel?: typeof opts.action },
      ];
      return Object.fromEntries(
        [opts.action, opts.cancel].flatMap((button) =>
          button ? [[button.label, button.onClick]] : [],
        ),
      );
    }

    it('says so, links to what was sent, and opens the draft only the snapshot holds', async () => {
      await closedThenRefused(sentVersion(), { saveFails: true });

      expect(toast.warning).toHaveBeenCalledWith(
        'compose.alreadySent.versionSent',
        expect.any(Object),
      );
      const buttons = toastButtons();
      expect(Object.keys(buttons).sort()).toEqual([
        'compose.alreadySent.openDraft',
        'compose.alreadySent.view',
      ]);
      buttons['compose.alreadySent.openDraft']();
      expect(routerPush).toHaveBeenLastCalledWith('/compose');
      buttons['compose.alreadySent.view']();
      expect(routerPush).toHaveBeenLastCalledWith('/conversation/sent-row-1');

      // The snapshot Open draft resumes holds the edits, under the same key.
      const record = await loadComposeRecovery(recoveryKey);
      expect(record?.snapshot).toMatchObject({
        body: 'Recovered text, and a correction',
        idempotencyKey: RECOVERED_KEY,
      });
      expect(sendWithUndo).toHaveBeenCalledTimes(1);
      expect(discardDraft).not.toHaveBeenCalled();
      expect(toast.info).not.toHaveBeenCalled();
    });

    it('offers no Open draft when a server draft holds the text', async () => {
      await closedThenRefused(sentVersion());

      expect(Object.keys(toastButtons())).toEqual(['compose.alreadySent.view']);
      expect(discardDraft).not.toHaveBeenCalled();
    });

    it('words a failed version as failed, and offers only the draft without an id', async () => {
      await closedThenRefused(sentVersion({ id: null, deliveryState: 'failed' }), {
        saveFails: true,
      });

      expect(toast.warning).toHaveBeenCalledWith(
        'compose.alreadySent.versionFailed',
        expect.any(Object),
      );
      expect(Object.keys(toastButtons())).toEqual(['compose.alreadySent.openDraft']);
    });

    it('cannot offer Open draft for a composer with nowhere to reopen', async () => {
      await closedThenRefused(sentVersion(), { saveFails: true, reopen: null });

      expect(Object.keys(toastButtons())).toEqual(['compose.alreadySent.view']);
    });
  });

  it('leaves any other scheduling failure open, to try again', async () => {
    const { result, onFinished } = await recoveredSession();
    await act(async () => {
      await result.current.schedule(new Date('2030-01-01T09:00:00Z'));
    });
    const [, callbacks] = scheduleMutate.mock.calls[0] as [
      unknown,
      { onError: (err: Error) => void },
    ];
    act(() =>
      callbacks.onError(
        Object.assign(new Error('Invalid recipient'), { status: 422, details: { field: 'to' } }),
      ),
    );
    await settle();

    expect(onFinished).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledWith('Invalid recipient');
  });
});

describe('what the user is told about the version already sent', () => {
  const tWithVars = (key: string, vars?: Record<string, unknown>) =>
    vars ? `${key} ${JSON.stringify(vars)}` : key;
  const due = '2030-01-01T09:00:00.000Z';
  const dueLabel = new Date(due).toLocaleString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });

  function notice(details: Record<string, unknown>, outcome: 'closed' | 'open') {
    const sent = alreadySentUnderKey(keyReusedError(details));
    if (!sent) throw new Error('not recognised');
    return alreadySentNotice(tWithVars, sent, outcome);
  }

  it.each(['sent', 'sending', 'retrying', 'unknown', undefined])(
    'a %s one was already sent',
    (deliveryState) => {
      expect(notice({ deliveryState }, 'closed')).toBe('compose.alreadySent.closedSent');
      expect(notice({ deliveryState }, 'open')).toBe('compose.alreadySent.versionSent');
    },
  );

  it('a scheduled one is due at its time', () => {
    const details = { deliveryState: 'scheduled', scheduledAt: due };
    expect(notice(details, 'closed')).toBe(
      `compose.alreadySent.closedScheduled ${JSON.stringify({ time: dueLabel })}`,
    );
    expect(notice(details, 'open')).toBe(
      `compose.alreadySent.versionScheduled ${JSON.stringify({ time: dueLabel })}`,
    );
  });

  it('a scheduled one without a time is said to be sent', () => {
    expect(notice({ deliveryState: 'scheduled', scheduledAt: null }, 'open')).toBe(
      'compose.alreadySent.versionSent',
    );
  });

  it('a failed or cancelled one never reads as sent', () => {
    expect(notice({ deliveryState: 'failed' }, 'open')).toBe('compose.alreadySent.versionFailed');
    expect(notice({ deliveryState: 'cancelled' }, 'open')).toBe(
      'compose.alreadySent.versionCancelled',
    );
  });
});

describe('a send that failed without an answer', () => {
  async function failedSend() {
    const rendered = renderHook(() =>
      useComposeSession(options({ initial: { to: 'ann@example.com', subject: 'Plan' } })),
    );
    await settle();
    act(() => rendered.result.current.updateBody('First text'));
    await settle();
    await act(async () => {
      await rendered.result.current.send();
    });
    const [payload, callbacks] = sendWithUndo.mock.calls[0];
    // It timed out: the server may hold it all the same.
    act(() => callbacks.onError(new Error('timeout')));
    await settle();
    return { ...rendered, key: payload.idempotencyKey as string };
  }

  it('is the same message when sent again unchanged', async () => {
    const { result, key } = await failedSend();
    await act(async () => {
      await result.current.send();
    });
    expect(sendWithUndo.mock.calls[1][0].idempotencyKey).toBe(key);
  });

  it('is a new message once it is edited, so the edits are not answered with the old one', async () => {
    const { result, key } = await failedSend();
    act(() => result.current.updateBody('Corrected text'));
    await settle();
    await act(async () => {
      await result.current.send();
    });
    expect(sendWithUndo.mock.calls[1][0].idempotencyKey).not.toBe(key);
  });
});

describe('saving before a send', () => {
  /**
   * The autosave runs 8 s after the last keystroke, and a save in flight was
   * all a send used to wait for. So the draft a send named could be missing
   * the last edits — and since OxyHQ/oxy#1676 a refused send keeps that
   * draft, as the only server copy of what the user wrote.
   */
  it('saves what was typed since the last autosave first, and sends naming that draft', async () => {
    const { result } = renderHook(() => useComposeSession(options()));
    await settle();
    act(() => {
      result.current.setTo('ann@example.com');
      result.current.updateBody('Typed just now');
    });
    await advance(1_000);
    expect(saveDraft).not.toHaveBeenCalled();

    await act(async () => {
      await result.current.send();
    });

    expect(saveDraft).toHaveBeenCalledTimes(1);
    expect(saveDraft).toHaveBeenCalledWith(expect.objectContaining({ text: 'Typed just now' }));
    expect(saveDraft.mock.invocationCallOrder[0]).toBeLessThan(
      sendWithUndo.mock.invocationCallOrder[0],
    );
    expect(sendWithUndo.mock.calls[0][0]).toMatchObject({
      draftId: 'created-1',
      text: 'Typed just now',
    });
    // The autosave it replaced does not run as well.
    await advance(10_000);
    expect(saveDraft).toHaveBeenCalledTimes(1);
  });

  it('saves after a save already in flight, with the newest text', async () => {
    let finishFirst: (value: { _id: string; draftRevision: number }) => void = () => {};
    saveDraft.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finishFirst = resolve;
        }),
    );
    const { result } = renderHook(() => useComposeSession(options()));
    await settle();
    act(() => {
      result.current.setTo('ann@example.com');
      result.current.updateBody('First');
    });
    await advance(8_000);
    expect(saveDraft).toHaveBeenCalledTimes(1);
    act(() => result.current.updateBody('First, then more'));
    await settle();

    let sending: Promise<void> = Promise.resolve();
    act(() => {
      sending = result.current.send();
    });
    await settle();
    expect(sendWithUndo).not.toHaveBeenCalled();
    await act(async () => {
      finishFirst({ _id: 'created-1', draftRevision: 1 });
      await sending;
    });

    expect(saveDraft).toHaveBeenCalledTimes(2);
    expect(saveDraft).toHaveBeenLastCalledWith(
      expect.objectContaining({ existingDraftId: 'created-1', text: 'First, then more' }),
    );
    expect(sendWithUndo.mock.calls[0][0]).toMatchObject({ draftId: 'created-1' });
  });

  it('makes no draft for a session nothing was written in', async () => {
    const { result } = renderHook(() =>
      useComposeSession(
        options({
          recoveryIdentity: 'reply:p1',
          initial: { to: 'ann@example.com', subject: 'Re: Plan' },
        }),
      ),
    );
    await settle();

    await act(async () => {
      await result.current.send();
    });

    expect(saveDraft).not.toHaveBeenCalled();
    expect(sendWithUndo).toHaveBeenCalledTimes(1);
  });

  it('saves nothing once the session is discarded', async () => {
    const { result } = renderHook(() => useComposeSession(options()));
    await settle();
    act(() => {
      result.current.setTo('ann@example.com');
      result.current.updateBody('Never mind');
    });
    await act(async () => {
      await result.current.discardDraft();
    });

    await act(async () => {
      await result.current.send();
    });
    await advance(10_000);

    expect(saveDraft).not.toHaveBeenCalled();
    expect(sendWithUndo).not.toHaveBeenCalled();
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

    // The send saved what it sent first.
    expect(saveDraft).toHaveBeenCalledTimes(1);

    act(() => result.current.updateBody('One more line'));
    await advance(8_000);

    expect(saveDraft).toHaveBeenCalledTimes(2);
    expect(saveDraft).toHaveBeenLastCalledWith(
      expect.objectContaining({ existingDraftId: 'created-1', text: 'One more line' }),
    );
  });
});

describe('the signature', () => {
  it('is not content: no draft is saved and closing does not ask', async () => {
    getSettings.mockResolvedValue({ signature: 'Nate' });
    const onFinished = jest.fn();
    const { result } = renderHook(() =>
      useComposeSession(options({ insertSignature: true, onFinished })),
    );
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
      useComposeSession(
        options({ draft: savedDraft(), recoveryIdentity: 'draft:draft-1', insertSignature: false }),
      ),
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
