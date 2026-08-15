import type { LocaleDict } from '../types';

/**
 * Chinese Simplified (zh-CN) translation dictionary for the Inbox app.
 */
const zh: LocaleDict = {
  common: {
    cancel: '取消',
    save: '保存',
    ok: '确定',
    continue: '继续',
    back: '返回',
    next: '下一步',
    done: '完成',
    close: '关闭',
    loading: '加载中…',
    error: '错误',
    success: '完成',
    retry: '重试',
    delete: '删除',
    edit: '编辑',
    remove: '移除',
    confirm: '确认',
    submit: '提交',
    search: '搜索',
    yes: '是',
    no: '否',
    or: '或',
    and: '和',
    open: '打开',
    discard: '舍弃',
    of: '/',
    more: '更多',
    less: '收起',
  },

  app: {
    name: 'Inbox',
    title: 'Oxy Inbox',
    titleSuffix: '· Oxy',
  },

  tabs: {
    inbox: '收件箱',
    search: '搜索',
    settings: '设置',
  },

  drawer: {
    starred: '星标',
    snoozed: '已暂停',
    subscriptions: '订阅',
    labels: '标签',
    more: '更多',
    less: '收起',
    notSignedIn: '未登录',
    accountSwitcher: '账户切换器',
    addAnotherAccount: '添加其他账户',
    signOut: '退出登录',
    switchAccount: '切换账户，已以 {{name}} 登录',
    switchingAccount: '正在切换账户…',
    expandSidebar: '展开侧边栏',
    collapseSidebar: '收起侧边栏',
    signedOut: {
      title: '登录以管理你的邮件',
      subtitle: '访问邮箱和标签,撰写新邮件。',
    },
    mailboxes: {
      Inbox: '收件箱',
      Sent: '已发送',
      Drafts: '草稿',
      Trash: '回收站',
      Spam: '垃圾邮件',
      Archive: '存档',
      Starred: '星标',
      Snoozed: '已暂停',
    },
    mailboxA11y: '{{name}},{{count}} 封未读',
  },

  home: {
    greeting: {
      morning: '早上好',
      afternoon: '下午好',
      evening: '晚上好',
      withName: '{{greeting}},{{name}}',
    },
    todaysBrief: '今日摘要',
    openMenu: '打开菜单',
    jumpToToday: '跳到今天',
    previousWeek: '上一周',
    nextWeek: '下一周',
    regenerateBrief: '重新生成摘要',
    inboxSection: '收件箱',
    needsResponse: '需要回复',
    followUp: '待跟进',
    needsResponseA11y_one: '需要回复,{{count}} 封邮件',
    needsResponseA11y_other: '需要回复,{{count}} 封邮件',
    followUpA11y_one: '待跟进,{{count}} 封邮件',
    followUpA11y_other: '待跟进,{{count}} 封邮件',
    days: {
      sun: '日',
      mon: '一',
      tue: '二',
      wed: '三',
      thu: '四',
      fri: '五',
      sat: '六',
    },
    stats: {
      unread: '{{count}} 封未读',
      starred: '{{count}} 封星标',
      attachments: '{{count}}',
    },
    brief: {
      analyzing: 'Alia 正在分析你的收件箱…',
      unavailable: '当前无法生成摘要。',
      empty: '还没有可摘要的邮件。',
      writing: '正在撰写你的摘要…',
      preparing: '正在准备你的摘要…',
      failed: '无法生成今天的摘要。',
      nothingNew: '今天没有新邮件。',
      tapRetry: '点按重试',
    },
    feedEmpty: {
      title: '一切都已处理',
      subtitle: '收件箱里没有新内容。',
    },
    signedOut: {
      subtitle:
        '登录后即可查看每日摘要、需要回复的邮件以及待跟进事项。',
    },
  },


  inbox: {
    title: '收件箱',
    starredTitle: '星标',
    searchInMailbox: '在 {{mailbox}} 中搜索',
    emptyTitle: '空空如也',
    emptyAllCaught: '你已经处理完所有邮件。',
    emptySignIn: '登录以访问邮件。',
    pagination: '{{from}}–{{to}}/{{total}}',
    remind: '提醒',
    bundled: '已分组',
    flat: '列表',
    composeFab: '撰写新邮件',
    composeFabLabel: '撰写',
    askAlia: '问 Alia',
    askAliaHint: '打开 AI 助手 Alia,询问关于收件箱的问题',
    sections: {
      reminders: '提醒',
      pinned: '已固定',
      today: '今天',
      yesterday: '昨天',
      thisWeek: '本周',
      thisMonth: '本月',
      earlier: '更早',
    },
    aliaSuggestions: {
      unread: {
        label: '未读邮件',
        prompt: '哪些邮件需要关注?',
      },
      todaysSummary: {
        label: '今日摘要',
        prompt: '总结一下今天的邮件',
      },
      withAttachments: {
        label: '带附件',
        prompt: '查找带附件的邮件',
      },
    },
    aliaClientContext:
      'User is in the Inbox app viewing their email. Use oxy_inbox tools to access their emails.',
    toast: {
      archiveUnavailable: '存档文件夹不可用。',
      trashUnavailable: '回收站文件夹不可用。',
      offlineSync_one: '已同步 {{count}} 条离线操作。',
      offlineSync_other: '已同步 {{count}} 条离线操作。',
      newVersionAvailable: '有新版本 — 请刷新以更新。',
      newEmail: '来自 {{sender}} 的新邮件',
    },
  },

  message: {
    detail: {
      noSubject: '(无主题)',
      emptyMessage: '(空消息)',
      messagesInConversation_one: '此会话中有 {{count}} 条消息',
      messagesInConversation_other: '此会话中有 {{count}} 条消息',
      toRecipients: '至 {{recipients}}',
      ccRecipients: ',抄送:{{recipients}}',
    },
    actions: {
      archive: '存档',
      delete: '删除',
      markUnread: '标为未读',
      markRead: '标为已读',
      reply: '回复',
      replyAll: '全部回复',
      forward: '转发',
      pin: '固定消息',
      unpin: '取消固定',
      star: '加星标',
      unstar: '取消星标',
      snooze: '暂停',
      print: '打印',
      more: '更多操作',
      moreInline: '更多',
      reportSpam: '举报为垃圾邮件',
      label: '标签',
      downloadEml: '下载 .eml',
      messageActions: '消息操作',
    },
    labelPicker: {
      title: '标签',
      empty: '还没有标签',
    },
    toast: {
      attachmentFailed: '附件下载失败。',
      fileSystemUnavailable: '此设备不支持文件系统。',
      sharingUnavailable: '此设备不支持分享。',
      printFailed: '打印邮件失败。',
      downloadFailed: '下载邮件失败。',
      saveEmailDialog: '保存邮件',
    },
  },

  empty: {
    selectConversation: '选择一个会话',
    nothingHere: '空空如也',
  },

  notFound: {
    title:
      '找不到该会话。可能已被移动、存档或删除。',
    back: '返回收件箱',
  },

  search: {
    placeholder: '搜索邮件',
    clear: '清除搜索',
    openMenu: '打开菜单',
    goBack: '返回',
    filters: {
      from: '发件人',
      fromValue: '发件人:{{value}}',
      hasAttachment: '带附件',
    },
    nl: {
      understanding: '正在理解搜索…',
      searching: '搜索:{{filters}}',
      allEmails: '所有邮件',
      fromValue: '来自 {{value}}',
      toValue: '发给 {{value}}',
      subjectContains: '主题包含"{{value}}"',
      withAttachments: '带附件',
      starred: '星标',
      unread: '未读',
      read: '已读',
    },
    empty: {
      noResults: '未找到结果',
      idle: '搜索你的邮件',
    },
    results_one: '{{count}} 条结果',
    results_other: '{{count}} 条结果',
  },

  compose: {
    titleCompose: '撰写',
    titleReply: '回复',
    titleForward: '转发',
    headTitleCompose: '撰写 · Inbox · Oxy',
    headTitleWithSubject: '{{subject}} · 撰写 · Oxy',
    placeholders: {
      to: '收件人',
      subject: '主题',
      body: '撰写邮件',
    },
    fields: {
      from: '发件人',
      to: '收件人',
      cc: '抄送',
      bcc: '密送',
    },
    actions: {
      send: '发送',
      sendNow: '立即发送',
      moreSendOptions: '更多发送选项',
      sendOptions: '发送选项',
      scheduleSend: '定时发送',
      saveDraft: '保存草稿',
      discard: '舍弃',
    },
    saveDraftPrompt: {
      title: '保存草稿?',
      description: '是否将此消息保存为草稿?',
    },
    dropZone: '拖放文件以附加',
    toast: {
      addRecipient: '请至少添加一位收件人。',
      invalidEmail: '请输入有效的邮箱地址。',
      sendFailed: '邮件发送失败,请重试。',
      scheduleFailed: '定时发送失败,请重试。',
      scheduled: '邮件已定时于 {{time}}',
      uploadFailed: '附件上传失败。',
      signatureFailed: '签名加载失败。',
    },
  },

  inlineReply: {
    placeholder: '撰写回复…',
    forwardTo: '转发至:',
    replyAllTo: '全部回复至:',
    replyTo: '回复至:',
    cc: '抄送:',
    bcc: '密送:',
    ccBccToggle: '抄送/密送',
    addRecipients: '添加收件人',
    send: '发送',
    quotedPrefix: '在 {{date}},{{author}} 写道:',
    forwardHeader:
      '\n\n---------- 转发的消息 ----------\n发件人:{{from}}\n日期:{{date}}\n主题:{{subject}}\n收件人:{{to}}\n\n',
  },

  smartReply: {
    quickReplies: '快速回复',
  },

  ai: {
    toolbar: {
      draft: '草稿',
      polish: '润色',
      shorter: '更短',
      longer: '更长',
      tone: '语气',
      suggestSubject: '建议主题',
    },
    draftModal: {
      title: '用 AI 撰写',
      subtitle: '描述你想表达的内容,Alia 将为你起草。',
      placeholder: '例如,礼貌地拒绝会议,提议下周',
      toneLabel: '语气:',
      cancel: '取消',
      draft: '草稿',
    },
    toneMenu: {
      title: '将语气更改为…',
    },
    tones: {
      professional: '专业',
      casual: '随意',
      friendly: '友好',
      formal: '正式',
    },
  },

  threadSummary: {
    title: '会话摘要',
    messages_one: '{{count}} 条消息',
    messages_other: '{{count}} 条消息',
    keyPoints: '要点',
    actionItems: '待办事项',
    due: '截止:{{date}}',
    unavailable: '当前无法总结此会话。',
  },

  staleThread: {
    consider: '考虑发送一个简短回复',
    reply: '回复',
  },

  followUpReminder: {
    pastDue: '已过期的承诺',
    upcoming: '即将到期的承诺',
    description: '你对 {{recipient}} 说过"{{text}}"',
    deadline: {
      dueToday: '今天到期',
      overdueOneDay: '逾期 1 天',
      overdueDays: '逾期 {{days}} 天',
      dueTomorrow: '明天到期',
      dueInDays: '{{days}} 天后到期',
    },
    fallbackName: '某人',
    view: '查看',
    done: '完成',
  },

  reminder: {
    create: {
      title: '创建提醒',
      placeholder: '希望提醒你什么?',
      whenLabel: '何时?',
      submit: '创建提醒',
      presets: {
        laterToday: '今天稍后',
        tomorrowMorning: '明天早上',
        thisWeekend: '本周末',
        nextWeek: '下周',
      },
    },
    time: {
      overdue: '已逾期 · {{date}},{{time}}',
      today: '今天,{{time}}',
      tomorrow: '明天,{{time}}',
      onDate: '{{date}},{{time}}',
    },
  },

  snooze: {
    title: '暂停至…',
    options: {
      laterToday: '今天稍后',
      tomorrow: '明天',
      thisWeekend: '本周末',
      nextWeek: '下周',
    },
    time: {
      today: '今天,{{time}}',
      tomorrow: '明天,{{time}}',
      onDate: '{{date}},{{time}}',
    },
  },

  schedule: {
    title: '定时发送',
    options: {
      laterToday: '今天稍后',
      tomorrowMorning: '明天早上',
      tomorrowAfternoon: '明天下午',
      mondayMorning: '周一早上',
    },
  },

  template: {
    insert: '插入模板',
  },

  selection: {
    archive: '存档',
    delete: '删除',
    star: '加星标',
    markRead: '标为已读',
  },

  subscriptions: {
    title: '订阅',
    subtitle:
      '取消订阅后,可能需要几天才能不再收到消息',
    empty: {
      title: '未找到订阅',
      subtitle: '经常给你发邮件的发件人会出现在这里。',
    },
    unsubscribe: '取消订阅',
    block: '屏蔽',
    frequency: {
      twentyPlus: '近期 20+ 封邮件',
      tenToTwenty: '近期 10-20 封邮件',
      count_one: '近期 {{count}} 封邮件',
      count_other: '近期 {{count}} 封邮件',
    },
  },

  contacts: {
    searchPlaceholder: '搜索联系人…',
    addContact: '添加联系人',
    cancel: '取消',
    saveContact: '保存联系人',
    save: '保存',
    edit: {
      cancel: '取消',
    },
    delete: {
      title: '删除此联系人?',
      description: '此操作无法撤销。',
      cta: '删除',
    },
    starredFilter: '星标',
    autoCollected: '自动收集',
    empty: {
      noMatch: '没有联系人与你的搜索匹配。',
      none: '还没有联系人。',
    },
    toast: {
      nameEmailRequired: '姓名和邮箱为必填项。',
      created: '联系人已创建。',
      updated: '联系人已更新。',
      deleted: '联系人已删除。',
    },
    form: {
      name: '姓名 *',
      email: '邮箱 *',
      company: '公司',
      notes: '备注',
    },
  },

  shortcuts: {
    title: '键盘快捷键',
    close: '关闭',
    actions: {
      compose: '撰写',
      reply: '回复',
      replyAll: '全部回复',
      forward: '转发',
      archive: '存档',
      delete: '删除',
      nextMessage: '下一条消息',
      previousMessage: '上一条消息',
      starUnstar: '加 / 取消星标',
      markUnread: '标为未读',
      search: '搜索',
      help: '此帮助',
    },
  },

  cards: {
    purchase: {
      header: '购买',
      order: '订单号',
      moreItems: '+{{count}} 件',
      summary: '购买详情',
    },
    bill: {
      header: '账单',
      account: '账户',
      due: '{{date}} 到期',
      overdue: '逾期 · {{date}}',
      summary: '账单详情',
    },
    trip: {
      header: '行程',
      confirmation: '确认',
      summary: '行程详情',
    },
    package: {
      header: '包裹',
      tracking: '追踪',
      estimated: '预计 {{date}}',
      summary: '包裹详情',
    },
    event: {
      header: '活动',
      addToCalendar: '添加到日历',
      googleCalendar: 'Google 日历',
      addToCalendarDialog: '添加到日历',
      defaultTitle: '活动',
      summary: '活动详情',
    },
  },

  importance: {
    urgent: '紧急',
    action: '需要处理',
    important: '重要',
    fyi: '仅供参考',
  },

  attachment: {
    sizeBytes: '{{value}} 字节',
    sizeKb: '{{value}} KB',
    sizeMb: '{{value}} MB',
  },

  settings: {
    head: '设置 · Inbox · Oxy',
    title: '设置',
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
      title: '登录以访问你的收件箱',
      subtitle: '连接你的 Oxy 身份,跨所有设备同步消息、标签和偏好设置。',
      footer: '登录即表示你同意我们的服务条款并确认我们的隐私政策。',
    },
  },
};

export default zh;
