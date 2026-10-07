/** Published Oxy catalogue stickers, shared with Mention. Bloom owns rendering. */
export const EMPTY_STATE_STICKERS = {
  /** 👍 springtime — all caught up. */
  inbox: '01a0eadb-c6a9-7c35-8433-c308f9a4ce03',
  /** 🍵 escape-from-reality — waiting for a conversation. */
  conversation: '01a0eadb-0917-74c4-be61-8fd534b4faea',
  /** 👀 blob-blah-blah — ready to search. */
  searchIdle: '01a0eada-9cc9-7d48-98e1-d6ef59830aa7',
  /** 🤷 blob-blah-blah — no matches. */
  searchNoResults: '01a0eada-9343-7430-8062-8424ea19b842',
  /** 🤞 harvest-season — no subscriptions yet. */
  subscriptions: '01a0eadb-4b0d-780a-97eb-f7ca286c7908',
  /** 😕 taste-buds — page or message not found. */
  notFound: '01a0eadb-ee07-7b6f-a868-3fea8fc02476',
  /** 😵‍💫 school-days — could not load. */
  loadError: '01a0eadb-a89b-7b15-b07e-779c938c26c3',
} as const;

export type EmptyStateStickerName = keyof typeof EMPTY_STATE_STICKERS;
