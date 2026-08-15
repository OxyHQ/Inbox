import type { LocaleDict } from '../types';

/**
 * Japanese (ja-JP) translation dictionary for the Inbox app.
 *
 * Tone: polite, modern Japanese — matches the rest of the Oxy ecosystem.
 */
const ja: LocaleDict = {
  common: {
    cancel: 'キャンセル',
    save: '保存',
    ok: 'OK',
    continue: '続ける',
    back: '戻る',
    next: '次へ',
    done: '完了',
    close: '閉じる',
    loading: '読み込み中…',
    error: 'エラー',
    success: '完了',
    retry: '再試行',
    delete: '削除',
    edit: '編集',
    remove: '削除',
    confirm: '確認',
    submit: '送信',
    search: '検索',
    yes: 'はい',
    no: 'いいえ',
    or: 'または',
    and: 'および',
    open: '開く',
    discard: '破棄',
    of: '/',
    more: 'もっと見る',
    less: '折りたたむ',
  },

  app: {
    name: 'Inbox',
    title: 'Oxy Inbox',
    titleSuffix: '· Oxy',
  },

  tabs: {
    inbox: '受信箱',
    search: '検索',
    settings: '設定',
  },

  drawer: {
    starred: 'スター付き',
    snoozed: 'スヌーズ中',
    subscriptions: '購読',
    labels: 'ラベル',
    more: 'もっと見る',
    less: '折りたたむ',
    notSignedIn: 'サインインしていません',
    accountSwitcher: 'アカウント切り替え',
    addAnotherAccount: '別のアカウントを追加',
    signOut: 'サインアウト',
    switchAccount: 'アカウントを切り替える ({{name}} としてサインイン中)',
    switchingAccount: 'アカウントを切り替え中…',
    expandSidebar: 'サイドバーを展開',
    collapseSidebar: 'サイドバーを折りたたむ',
    signedOut: {
      title: 'メールを管理するにはサインインしてください',
      subtitle: 'メールボックス、ラベルにアクセスし、新しいメッセージを作成できます。',
    },
    mailboxes: {
      Inbox: '受信箱',
      Sent: '送信済み',
      Drafts: '下書き',
      Trash: 'ゴミ箱',
      Spam: '迷惑メール',
      Archive: 'アーカイブ',
      Starred: 'スター付き',
      Snoozed: 'スヌーズ中',
    },
    mailboxA11y: '{{name}}、未読 {{count}} 件',
  },

  home: {
    greeting: {
      morning: 'おはようございます',
      afternoon: 'こんにちは',
      evening: 'こんばんは',
      withName: '{{greeting}}、{{name}} さん',
    },
    todaysBrief: '今日のブリーフ',
    openMenu: 'メニューを開く',
    jumpToToday: '今日へ移動',
    previousWeek: '前の週',
    nextWeek: '次の週',
    regenerateBrief: 'ブリーフを再生成',
    inboxSection: '受信箱',
    needsResponse: '要返信',
    followUp: 'フォローアップ',
    needsResponseA11y_one: '要返信、メール {{count}} 件',
    needsResponseA11y_other: '要返信、メール {{count}} 件',
    followUpA11y_one: 'フォローアップ、メール {{count}} 件',
    followUpA11y_other: 'フォローアップ、メール {{count}} 件',
    days: {
      sun: '日',
      mon: '月',
      tue: '火',
      wed: '水',
      thu: '木',
      fri: '金',
      sat: '土',
    },
    stats: {
      unread: '未読 {{count}} 件',
      starred: 'スター {{count}} 件',
      attachments: '{{count}}',
    },
    brief: {
      analyzing: 'Alia が受信箱を分析しています…',
      unavailable: '現在ブリーフを生成できません。',
      empty: 'まだ要約するメールがありません。',
      writing: 'ブリーフを作成しています…',
      preparing: 'ブリーフを準備しています…',
      failed: '今日のブリーフを作成できませんでした。',
      nothingNew: '今日は新着がありません。',
      tapRetry: 'タップして再試行',
    },
    feedEmpty: {
      title: 'すべて処理済み',
      subtitle: '受信箱に新しいものはありません。',
    },
    signedOut: {
      subtitle:
        'サインインすると、今日のブリーフ、返信が必要なメール、フォローアップを表示できます。',
    },
  },


  inbox: {
    title: '受信箱',
    starredTitle: 'スター付き',
    searchInMailbox: '{{mailbox}} を検索',
    emptyTitle: '何もありません',
    emptyAllCaught: 'すべて確認済みです。',
    emptySignIn: 'メールを表示するにはサインインしてください。',
    pagination: '{{from}}–{{to}} / {{total}}',
    remind: 'リマインド',
    bundled: 'まとめ表示',
    flat: 'リスト',
    composeFab: '新しいメールを作成',
    composeFabLabel: '作成',
    askAlia: 'Alia に質問',
    askAliaHint: 'AI アシスタント Alia を開き、受信箱について質問できます',
    sections: {
      reminders: 'リマインダー',
      pinned: 'ピン留め',
      today: '今日',
      yesterday: '昨日',
      thisWeek: '今週',
      thisMonth: '今月',
      earlier: '以前',
    },
    aliaSuggestions: {
      unread: {
        label: '未読メール',
        prompt: '注意が必要なメールはどれですか?',
      },
      todaysSummary: {
        label: '今日のサマリー',
        prompt: '今日のメールを要約してください',
      },
      withAttachments: {
        label: '添付付き',
        prompt: '添付ファイルのあるメールを探して',
      },
    },
    aliaClientContext:
      'User is in the Inbox app viewing their email. Use oxy_inbox tools to access their emails.',
    toast: {
      archiveUnavailable: 'アーカイブフォルダが利用できません。',
      trashUnavailable: 'ゴミ箱フォルダが利用できません。',
      offlineSync_one: 'オフライン操作 {{count}} 件を同期しました。',
      offlineSync_other: 'オフライン操作 {{count}} 件を同期しました。',
      newVersionAvailable: '新しいバージョンが利用可能です — 更新してください。',
      newEmail: '{{sender}}から新着メール',
    },
  },

  message: {
    detail: {
      noSubject: '(件名なし)',
      emptyMessage: '(本文なし)',
      messagesInConversation_one: 'このスレッドのメッセージ {{count}} 件',
      messagesInConversation_other: 'このスレッドのメッセージ {{count}} 件',
      toRecipients: '宛先: {{recipients}}',
      ccRecipients: '、cc: {{recipients}}',
    },
    actions: {
      archive: 'アーカイブ',
      delete: '削除',
      markUnread: '未読にする',
      markRead: '既読にする',
      reply: '返信',
      replyAll: '全員に返信',
      forward: '転送',
      pin: 'メッセージをピン留め',
      unpin: 'ピン留めを解除',
      star: 'スターを付ける',
      unstar: 'スターを外す',
      snooze: 'スヌーズ',
      print: '印刷',
      more: 'その他の操作',
      moreInline: 'その他',
      reportSpam: '迷惑メールとして報告',
      label: 'ラベル',
      downloadEml: '.eml をダウンロード',
      messageActions: 'メッセージ操作',
    },
    labelPicker: {
      title: 'ラベル',
      empty: 'ラベルはまだありません',
    },
    toast: {
      attachmentFailed: '添付ファイルをダウンロードできませんでした。',
      fileSystemUnavailable: 'このデバイスではファイルシステムを利用できません。',
      sharingUnavailable: 'このデバイスでは共有できません。',
      printFailed: 'メールを印刷できませんでした。',
      downloadFailed: 'メールをダウンロードできませんでした。',
      saveEmailDialog: 'メールを保存',
    },
  },

  empty: {
    selectConversation: 'スレッドを選択してください',
    nothingHere: '何もありません',
  },

  notFound: {
    title:
      'そのスレッドが見つかりません。移動、アーカイブ、または削除された可能性があります。',
    back: '受信箱に戻る',
  },

  search: {
    placeholder: 'メールを検索',
    clear: '検索をクリア',
    openMenu: 'メニューを開く',
    goBack: '戻る',
    filters: {
      from: '差出人',
      fromValue: '差出人: {{value}}',
      hasAttachment: '添付ファイルあり',
    },
    nl: {
      understanding: '検索を解析しています…',
      searching: '検索中: {{filters}}',
      allEmails: 'すべてのメール',
      fromValue: '{{value}} から',
      toValue: '{{value}} 宛',
      subjectContains: '件名に「{{value}}」を含む',
      withAttachments: '添付付き',
      starred: 'スター付き',
      unread: '未読',
      read: '既読',
    },
    empty: {
      noResults: '結果が見つかりません',
      idle: 'メールを検索しましょう',
    },
    results_one: '{{count}} 件の結果',
    results_other: '{{count}} 件の結果',
  },

  compose: {
    titleCompose: '作成',
    titleReply: '返信',
    titleForward: '転送',
    headTitleCompose: '作成 · Inbox · Oxy',
    headTitleWithSubject: '{{subject}} · 作成 · Oxy',
    placeholders: {
      to: '宛先',
      subject: '件名',
      body: 'メールを作成',
    },
    fields: {
      from: '差出人',
      to: '宛先',
      cc: 'Cc',
      bcc: 'Bcc',
    },
    actions: {
      send: '送信',
      sendNow: '今すぐ送信',
      moreSendOptions: 'その他の送信オプション',
      sendOptions: '送信オプション',
      scheduleSend: '送信予約',
      saveDraft: '下書きを保存',
      discard: '破棄',
    },
    saveDraftPrompt: {
      title: '下書きを保存しますか?',
      description: 'このメッセージを下書きとして保存しますか?',
    },
    dropZone: 'ファイルをドロップして添付',
    toast: {
      addRecipient: '宛先を 1 件以上追加してください。',
      invalidEmail: '有効なメールアドレスを入力してください。',
      sendFailed: 'メールを送信できませんでした。もう一度お試しください。',
      scheduleFailed: '送信予約に失敗しました。もう一度お試しください。',
      scheduled: '{{time}} に送信予約しました',
      uploadFailed: '添付ファイルをアップロードできませんでした。',
      signatureFailed: '署名を読み込めませんでした。',
    },
  },

  inlineReply: {
    placeholder: '返信を入力…',
    forwardTo: '転送先:',
    replyAllTo: '全員に返信:',
    replyTo: '返信先:',
    cc: 'Cc:',
    bcc: 'Bcc:',
    ccBccToggle: 'Cc/Bcc',
    addRecipients: '宛先を追加',
    send: '送信',
    quotedPrefix: '{{date}}、{{author}} は次のように書きました:',
    forwardHeader:
      '\n\n---------- 転送メッセージ ----------\n差出人: {{from}}\n日付: {{date}}\n件名: {{subject}}\n宛先: {{to}}\n\n',
  },

  smartReply: {
    quickReplies: 'クイック返信',
  },

  ai: {
    toolbar: {
      draft: '下書き',
      polish: '推敲',
      shorter: '短く',
      longer: '長く',
      tone: 'トーン',
      suggestSubject: '件名を提案',
    },
    draftModal: {
      title: 'AI で作成',
      subtitle: '言いたいことを伝えれば、Alia が下書きを作成します。',
      placeholder: '例: 会議を丁寧に断り、来週を提案する',
      toneLabel: 'トーン:',
      cancel: 'キャンセル',
      draft: '下書き',
    },
    toneMenu: {
      title: 'トーンを変更…',
    },
    tones: {
      professional: 'プロフェッショナル',
      casual: 'カジュアル',
      friendly: 'フレンドリー',
      formal: 'フォーマル',
    },
  },

  threadSummary: {
    title: 'スレッドの要約',
    messages_one: 'メッセージ {{count}} 件',
    messages_other: 'メッセージ {{count}} 件',
    keyPoints: '要点',
    actionItems: 'アクション項目',
    due: '期限: {{date}}',
    unavailable: '現在このスレッドを要約できません。',
  },

  staleThread: {
    consider: '簡単な返信を送ることをご検討ください',
    reply: '返信',
  },

  followUpReminder: {
    pastDue: '期限を過ぎた約束',
    upcoming: 'まもなくの約束',
    description: '{{recipient}} に「{{text}}」と伝えました',
    deadline: {
      dueToday: '今日が期限',
      overdueOneDay: '1 日遅れ',
      overdueDays: '{{days}} 日遅れ',
      dueTomorrow: '明日が期限',
      dueInDays: 'あと {{days}} 日',
    },
    fallbackName: '誰か',
    view: '表示',
    done: '完了',
  },

  reminder: {
    create: {
      title: 'リマインダーを作成',
      placeholder: '何を思い出させますか?',
      whenLabel: 'いつ?',
      submit: 'リマインダーを作成',
      presets: {
        laterToday: '今日のあと',
        tomorrowMorning: '明日の朝',
        thisWeekend: '今週末',
        nextWeek: '来週',
      },
    },
    time: {
      overdue: '期限切れ · {{date}}、{{time}}',
      today: '今日、{{time}}',
      tomorrow: '明日、{{time}}',
      onDate: '{{date}}、{{time}}',
    },
  },

  snooze: {
    title: 'スヌーズ先…',
    options: {
      laterToday: '今日のあと',
      tomorrow: '明日',
      thisWeekend: '今週末',
      nextWeek: '来週',
    },
    time: {
      today: '今日、{{time}}',
      tomorrow: '明日、{{time}}',
      onDate: '{{date}}、{{time}}',
    },
  },

  schedule: {
    title: '送信予約',
    options: {
      laterToday: '今日のあと',
      tomorrowMorning: '明日の朝',
      tomorrowAfternoon: '明日の午後',
      mondayMorning: '月曜の朝',
    },
  },

  template: {
    insert: 'テンプレートを挿入',
  },

  selection: {
    archive: 'アーカイブ',
    delete: '削除',
    star: 'スター',
    markRead: '既読にする',
  },

  subscriptions: {
    title: '購読',
    subtitle:
      '購読を解除しても、メッセージが届かなくなるまで数日かかる場合があります',
    empty: {
      title: '購読は見つかりません',
      subtitle: '頻繁にメールを送ってくる差出人がここに表示されます。',
    },
    unsubscribe: '購読を解除',
    block: 'ブロック',
    frequency: {
      twentyPlus: '直近 20+ 件のメール',
      tenToTwenty: '直近 10-20 件のメール',
      count_one: '直近 {{count}} 件のメール',
      count_other: '直近 {{count}} 件のメール',
    },
  },

  contacts: {
    searchPlaceholder: '連絡先を検索…',
    addContact: '連絡先を追加',
    cancel: 'キャンセル',
    saveContact: '連絡先を保存',
    save: '保存',
    edit: {
      cancel: 'キャンセル',
    },
    delete: {
      title: 'この連絡先を削除しますか?',
      description: 'この操作は取り消せません。',
      cta: '削除',
    },
    starredFilter: 'スター付き',
    autoCollected: '自動収集',
    empty: {
      noMatch: '検索に一致する連絡先がありません。',
      none: 'まだ連絡先がありません。',
    },
    toast: {
      nameEmailRequired: '名前とメールアドレスは必須です。',
      created: '連絡先を作成しました。',
      updated: '連絡先を更新しました。',
      deleted: '連絡先を削除しました。',
    },
    form: {
      name: '名前 *',
      email: 'メール *',
      company: '会社',
      notes: 'メモ',
    },
  },

  shortcuts: {
    title: 'キーボードショートカット',
    close: '閉じる',
    actions: {
      compose: '作成',
      reply: '返信',
      replyAll: '全員に返信',
      forward: '転送',
      archive: 'アーカイブ',
      delete: '削除',
      nextMessage: '次のメッセージ',
      previousMessage: '前のメッセージ',
      starUnstar: 'スター / 解除',
      markUnread: '未読にする',
      search: '検索',
      help: 'このヘルプ',
    },
  },

  cards: {
    purchase: {
      header: '購入',
      order: '注文番号',
      moreItems: '+{{count}} 件',
      summary: '購入の詳細',
    },
    bill: {
      header: '請求',
      account: 'アカウント',
      due: '期限 {{date}}',
      overdue: '期限切れ · {{date}}',
      summary: '請求の詳細',
    },
    trip: {
      header: '旅行',
      confirmation: '確認',
      summary: '旅行の詳細',
    },
    package: {
      header: '荷物',
      tracking: '追跡',
      estimated: '予定 {{date}}',
      summary: '荷物の詳細',
    },
    event: {
      header: 'イベント',
      addToCalendar: 'カレンダーに追加',
      googleCalendar: 'Google カレンダー',
      addToCalendarDialog: 'カレンダーに追加',
      defaultTitle: 'イベント',
      summary: 'イベントの詳細',
    },
  },

  importance: {
    urgent: '緊急',
    action: '対応が必要',
    important: '重要',
    fyi: '参考',
  },

  attachment: {
    sizeBytes: '{{value}} B',
    sizeKb: '{{value}} KB',
    sizeMb: '{{value}} MB',
  },

  settings: {
    head: '設定 · Inbox · Oxy',
    title: '設定',
  },

  ui: {
    me: 'Me',
    settings: {
      landing: {
        personal: 'Personal',
        mail: 'Mail',
        system: 'System',
        welcome: 'Welcome to Inbox',
        signInDescription: 'Sign in to sync your messages, labels, and preferences across devices.',
        manageAccount: 'Manage account for {{name}}',
        sections: {
          account: 'Account', accountDescription: 'Profile, signature, recovery, and sign out',
          appearance: 'Appearance', appearanceDescription: 'Theme and accent color',
          notifications: 'Notifications', notificationsDescription: 'Push and email alerts',
          inbox: 'Inbox', inboxDescription: 'Density, reading, and swipe actions',
          privacy: 'Privacy', privacyDescription: 'Tracking protection and sender trust',
          labels: 'Labels', labelsDescription: 'Organize your inbox with custom labels',
          contacts: 'Contacts', contactsDescription: 'People you email, for faster composing',
          ai: 'AI features', aiDescription: 'Brief, Smart Reply, and categorization',
          storage: 'Storage', storageDescription: 'Quota usage and attachment cache',
          advanced: 'Advanced', advancedDescription: 'Filters, templates, and import',
          about: 'About', aboutDescription: 'Version, credits, and legal',
        },
      },
      account: {
        signature: 'Signature', signaturePlaceholder: 'Appended to every outgoing message',
        autoReply: 'Auto-reply', autoReplyEnable: 'Enable auto-reply',
        subjectPlaceholder: 'Subject', messagePlaceholder: "Message — explain when you'll be back.",
        forwarding: 'Forwarding', forwardingPlaceholder: 'Forward incoming mail to address',
        actions: 'Account actions', signOutDevice: "You'll be signed out of this device only.",
        signOutTitle: 'Sign out?', signOutDescription: 'You can sign back in at any time.',
        updated: 'Settings updated.', signedOut: 'Signed out.', signOut: 'Sign out',
      },
      appearance: {
        theme: 'Theme', light: 'Light', system: 'System', dark: 'Dark',
        useTheme: 'Use {{theme}} theme', systemHint: "System follows your device's appearance setting.",
        accentColor: 'Accent color',
      },
      notifications: {
        alerts: 'Alerts', push: 'Push notifications', pushDescription: 'Get notified when new messages arrive.',
        digest: 'Daily email digest', digestDescription: 'A summary of unread messages, once per day.',
        sound: 'Sound', playSound: 'Play sound', soundDescription: 'A short chime on new messages.',
      },
      inbox: {
        density: 'Message density', compact: 'Compact', comfortable: 'Comfortable', cozy: 'Cozy',
        densityHint: 'Choose how tightly to pack message rows in the list.', display: 'Display',
        avatars: 'Show avatars', avatarsDescription: 'Sender portraits at the start of each row.',
        previews: 'Show previews', previewsDescription: 'A short snippet of the message body.',
        threads: 'Group by thread', threadsDescription: 'Show conversations as a single row.',
        markRead: 'Mark as read on open', markReadDescription: 'Messages are marked read as soon as you open them.',
        swipeActions: 'Swipe actions', swipeRight: 'Swipe right', swipeLeft: 'Swipe left',
        swipeA11y: '{{label}} swipe action: {{value}}, tap to change', swipeHint: 'Tap a row to cycle through Archive · Delete · Mark read · Snooze · None.',
      },
      privacy: {
        info: 'Privacy protections are on by default. Per-feature toggles are coming soon.',
        tracking: 'Tracking protection', blockImages: 'Block remote images', blockImagesDescription: "Don't load images from external servers until you tap to allow.",
        hideIp: 'Hide IP from senders', hideIpDescription: "Image and font loads route through Oxy's privacy proxy.",
        stripTracking: 'Strip tracking parameters', stripTrackingDescription: 'Remove tracking tokens from links in messages.',
        trust: 'Sender trust', verification: 'Sender verification', verificationDescription: 'Show whether messages are signed by their claimed domain.',
        blockList: 'Manage block list', blockListTitle: 'Block list', blockListEmpty: 'No senders are currently blocked.',
        why: 'Why these defaults?', whyDescription: "Oxy follows a privacy-by-default posture: senders never see your IP, location, or read receipts, and tracking pixels are blocked at the network edge. We'll surface granular per-message and per-sender overrides as the protections mature.",
      },
      labels: {
        your: 'Your labels', empty: 'No labels yet. Create your first one below to organize messages.', create: 'Create label', labelName: 'Label name', saveName: 'Save label name', rename: 'Rename {{name}}', delete: 'Delete {{name}}', builtIn: 'Built-in', pick: 'Pick {{color}}', newName: 'New label name', creating: 'Creating…', add: 'Add label', deleteTitle: 'Delete label?', deleteDescription: '"{{name}}" will be removed from any messages it\'s applied to.',
      },
      contacts: {
        your: 'Your contacts', search: 'Search contacts', edit: 'Edit {{name}}', delete: 'Delete {{name}}', editContact: 'Edit contact', addContact: 'Add contact', name: 'Name', email: 'Email', company: 'Company (optional)', notes: 'Notes (optional)', star: 'Star this contact', saving: 'Saving…', adding: 'Adding…', saveChanges: 'Save changes', deleteTitle: 'Delete contact?', deleteDescription: '"{{name}}" will be removed from your contacts.', noMatch: 'No contacts match your search.', empty: 'No contacts yet. Add your frequent recipients below for faster composing.',
      },
      ai: {
        dailyBrief: 'Daily Brief', recap: 'Inbox recap', recapDescription: "A short summary generated from your inbox counts (unread, starred, attachments). It doesn't read message contents.", smartReply: 'Smart Reply', suggestions: 'One-tap suggestions', suggestionsDescription: 'Three context-aware reply chips above the message, drafted by Alia.', priority: 'Priority flags', priorityTitle: 'Highlight likely-urgent mail', priorityDescription: 'Flag messages as Urgent, Action needed, or Important using on-device keyword heuristics — not a full AI model.', tip: 'Priority flags run on-device from keyword heuristics. The Daily Brief and Smart Reply use Alia and only receive what is shown here — not your full mailbox.',
      },
      storage: {
        usage: 'Mailbox usage', local: 'Local cache', nearlyFull: "You're nearly out of space. Old messages will start to bounce when the quota is full.", localDescription: "The most recent 100 messages are cached on this device for fast offline access. Attachments are downloaded on demand and cleaned up automatically — there's nothing to manage manually today.", free: '{{value}} free',
      },
      advanced: {
        contains: 'contains', equals: 'equals', notContains: "doesn't contain", startsWith: 'starts with', endsWith: 'ends with', largerThan: 'larger than (bytes)', smallerThan: 'smaller than (bytes)',
        filters: 'Filters & rules', noFilters: 'No filters yet. Filters automatically apply actions like archiving, starring, or marking read to incoming messages.', filterName: 'Filter name', whenMessage: "When a message's", sizeBytes: 'Size in bytes', value: 'Value', then: 'then', creating: 'Creating…', addFilter: 'Add filter', editingTemplate: 'Editing template', templates: 'Templates', templateName: 'Template name', subjectOptional: 'Subject (optional)', templateBody: 'Template body', saveChanges: 'Save changes', addTemplate: 'Add template', bundles: 'Bundles', bundleHint: 'Bundles group related mail automatically. Toggle to enable and reorder how they stack in your inbox.', import: 'Import', importDescription: 'Import emails from .eml files. Imported messages land in your Inbox and can be moved or labelled like any other mail.', importing: 'Importing…', importButton: 'Choose .eml files', imported: 'Imported {{imported}} of {{total}} email(s).', conditions: '{{conditions}} condition(s) · {{actions}} action(s)', deleteFilter: 'Delete {{name}}', editTemplate: 'Edit {{name}}', deleteTemplate: 'Delete {{name}}', moveUp: 'Move {{name}} up', moveDown: 'Move {{name}} down',
      },
      about: { legal: 'Legal & support', terms: 'Terms of service', privacy: 'Privacy policy', help: 'Help center', status: 'System status', version: 'Version {{version}} · {{platform}}', madeBy: 'Made by the Oxy team · © {{year}}', linkUnavailable: 'Could not open the link in this environment.', linkFailed: 'Failed to open link.' },
    },
    drawer: { unread: '{{name}}, {{count}} unread', labels: 'Labels', folders: 'Folders', createFolder: 'Create folder', folderHint: 'Tap + to create a folder. Long-press a folder to delete it.', signedOutTitle: 'Sign in to manage your email', signedOutSubtitle: 'Access your mailboxes, labels, and compose new messages.', notSignedIn: 'Not signed in', newFolder: 'New folder', folderName: 'Folder name', creatingFolder: 'Creating…', createFolderButton: 'Create folder', deleteFolderTitle: 'Delete folder?', deleteFolderDescription: '"{{name}}" and its organization will be removed. Messages inside are not deleted.' },
    event: { sharingUnavailable: 'Sharing is unavailable. Try "Google Calendar" instead.', openFailed: 'Could not open the calendar file.' },
    message: { loadError: "Couldn't load this message", loadErrorDescription: 'Check your connection and try again.', notFound: 'Message not found', notFoundDescription: 'This message may have been deleted or moved.', conversationMessages_one: '{{count}} message in this conversation', conversationMessages_other: '{{count}} messages in this conversation', summaryTitle: 'Generate AI thread summary', summaryDescription: 'Sends this conversation to Alia for summarization.' },
    mutations: { bundleUpdateFailed: 'Failed to update bundle.', bundleReorderFailed: 'Failed to reorder bundle.', contactCreateFailed: 'Failed to create contact', contactUpdateFailed: 'Failed to update contact', contactDeleteFailed: 'Failed to delete contact', filterCreateFailed: 'Failed to create filter', filterUpdateFailed: 'Failed to update filter', filterDeleteFailed: 'Failed to delete filter', mailboxCreated: 'Folder created.', mailboxCreateFailed: 'Failed to create folder.', mailboxDeleted: 'Folder deleted.', mailboxDeleteFailed: 'Failed to delete folder.', reminderCreateFailed: 'Failed to create reminder', reminderUpdateFailed: 'Failed to update reminder', reminderDeleteFailed: 'Failed to delete reminder', templateCreateFailed: 'Failed to create template', templateUpdateFailed: 'Failed to update template', templateDeleteFailed: 'Failed to delete template', labelCreateFailed: 'Failed to create label.', labelUpdateFailed: 'Failed to update label.', labelDeleteFailed: 'Failed to delete label.', unsubscribeFailed: 'Failed to unsubscribe' },
  },

  auth: {
    gate: {
      title: 'サインインして受信箱にアクセス',
      subtitle:
        'Oxy のアイデンティティを接続して、メッセージ、ラベル、設定をすべてのデバイスで同期しましょう。',
      footer:
        'サインインすると、利用規約に同意し、プライバシーポリシーを承認したことになります。',
    },
  },
};

export default ja;
