import type { LocaleDict } from '../types';

/**
 * Arabic (ar-SA) translation dictionary for the Inbox app.
 *
 * Note: Arabic is right-to-left. RTL layout is wired in the app root via
 * `I18nManager.allowRTL(true)` and a `forceRTL` toggle on locale change.
 */
const ar: LocaleDict = {
  common: {
    cancel: 'إلغاء',
    save: 'حفظ',
    ok: 'حسناً',
    continue: 'متابعة',
    back: 'رجوع',
    next: 'التالي',
    done: 'تم',
    close: 'إغلاق',
    loading: 'جارٍ التحميل…',
    error: 'خطأ',
    success: 'تم',
    retry: 'إعادة المحاولة',
    delete: 'حذف',
    edit: 'تعديل',
    remove: 'إزالة',
    confirm: 'تأكيد',
    submit: 'إرسال',
    search: 'بحث',
    yes: 'نعم',
    no: 'لا',
    or: 'أو',
    and: 'و',
    open: 'فتح',
    discard: 'تجاهل',
    of: 'من',
    more: 'المزيد',
    less: 'أقل',
  },

  app: {
    name: 'Inbox',
    title: 'Inbox من Oxy',
    titleSuffix: '· Oxy',
  },

  tabs: {
    inbox: 'البريد الوارد',
    search: 'بحث',
    settings: 'الإعدادات',
  },

  drawer: {
    starred: 'المميّزة',
    snoozed: 'مؤجَّلة',
    subscriptions: 'الاشتراكات',
    labels: 'التصنيفات',
    more: 'المزيد',
    less: 'أقل',
    notSignedIn: 'لم يتم تسجيل الدخول',
    accountSwitcher: 'مبدّل الحسابات',
    addAnotherAccount: 'إضافة حساب آخر',
    signOut: 'تسجيل الخروج',
    switchAccount: 'تبديل الحساب، مسجّل دخول كـ {{name}}',
    switchingAccount: 'جارٍ تبديل الحساب…',
    expandSidebar: 'توسيع الشريط الجانبي',
    collapseSidebar: 'طي الشريط الجانبي',
    signedOut: {
      title: 'سجّل الدخول لإدارة بريدك',
      subtitle: 'استعرض صناديق البريد والتصنيفات وأنشئ رسائل جديدة.',
    },
    mailboxes: {
      Inbox: 'البريد الوارد',
      Sent: 'المرسلة',
      Drafts: 'المسوّدات',
      Trash: 'المهملات',
      Spam: 'البريد المزعج',
      Archive: 'الأرشيف',
      Starred: 'المميّزة',
      Snoozed: 'مؤجَّلة',
    },
    mailboxA11y: '{{name}}، {{count}} غير مقروءة',
  },

  home: {
    greeting: {
      morning: 'صباح الخير',
      afternoon: 'مساء الخير',
      evening: 'مساء الخير',
      withName: '{{greeting}}، {{name}}',
    },
    todaysBrief: 'ملخّص اليوم',
    openMenu: 'فتح القائمة',
    jumpToToday: 'الانتقال إلى اليوم',
    previousWeek: 'الأسبوع السابق',
    nextWeek: 'الأسبوع التالي',
    regenerateBrief: 'إعادة إنشاء الملخّص',
    inboxSection: 'البريد الوارد',
    needsResponse: 'يحتاج إلى رد',
    followUp: 'متابعة',
    needsResponseA11y_one: 'يحتاج إلى رد، {{count}} رسالة',
    needsResponseA11y_other: 'يحتاج إلى رد، {{count}} رسائل',
    followUpA11y_one: 'متابعة، {{count}} رسالة',
    followUpA11y_other: 'متابعة، {{count}} رسائل',
    days: {
      sun: 'الأحد',
      mon: 'الإثنين',
      tue: 'الثلاثاء',
      wed: 'الأربعاء',
      thu: 'الخميس',
      fri: 'الجمعة',
      sat: 'السبت',
    },
    stats: {
      unread: '{{count}} غير مقروءة',
      starred: '{{count}} مميّزة',
      attachments: '{{count}}',
    },
    brief: {
      analyzing: 'تقوم Alia بتحليل بريدك الوارد…',
      unavailable: 'تعذّر إنشاء الملخّص الآن.',
      empty: 'لا توجد رسائل للتلخيص بعد.',
      writing: 'جارٍ كتابة ملخّصك…',
      preparing: 'جارٍ تجهيز ملخّصك…',
      failed: 'تعذّر كتابة ملخّص اليوم.',
      nothingNew: 'لا جديد اليوم.',
      tapRetry: 'اضغط لإعادة المحاولة.',
    },
    feedEmpty: {
      title: 'تم تحديث كل شيء',
      subtitle: 'لا جديد في بريدك.',
    },
    signedOut: {
      subtitle:
        'سجّل الدخول لرؤية ملخّصك اليومي والرسائل التي تحتاج إلى رد والمتابعات.',
    },
  },


  inbox: {
    title: 'البريد الوارد',
    starredTitle: 'المميّزة',
    searchInMailbox: 'البحث في {{mailbox}}',
    emptyTitle: 'لا شيء هنا',
    emptyAllCaught: 'لقد قرأت كل شيء.',
    emptySignIn: 'سجّل الدخول للوصول إلى بريدك.',
    pagination: '{{from}}–{{to}} من {{total}}',
    remind: 'تذكير',
    bundled: 'مجمّعة',
    flat: 'قائمة',
    composeFab: 'كتابة رسالة جديدة',
    composeFabLabel: 'كتابة',
    askAlia: 'اسأل Alia',
    askAliaHint: 'يفتح المساعد الذكي Alia لطرح أسئلة حول بريدك',
    sections: {
      reminders: 'التذكيرات',
      pinned: 'المثبَّتة',
      today: 'اليوم',
      yesterday: 'أمس',
      thisWeek: 'هذا الأسبوع',
      thisMonth: 'هذا الشهر',
      earlier: 'سابقاً',
    },
    aliaSuggestions: {
      unread: {
        label: 'الرسائل غير المقروءة',
        prompt: 'أيّ الرسائل تحتاج إلى اهتمامي؟',
      },
      todaysSummary: {
        label: 'ملخّص اليوم',
        prompt: 'لخّص رسائلي اليوم',
      },
      withAttachments: {
        label: 'مع مرفقات',
        prompt: 'ابحث عن الرسائل التي تحتوي على مرفقات',
      },
    },
    aliaClientContext:
      'User is in the Inbox app viewing their email. Use oxy_inbox tools to access their emails.',
    toast: {
      archiveUnavailable: 'مجلد الأرشيف غير متاح.',
      trashUnavailable: 'مجلد المهملات غير متاح.',
      offlineSync_one: 'تمت مزامنة {{count}} إجراء دون اتصال.',
      offlineSync_other: 'تمت مزامنة {{count}} إجراءات دون اتصال.',
      newVersionAvailable: 'تتوفّر نسخة جديدة — أعد التحميل للتحديث.',
      newEmail: 'رسالة جديدة من {{sender}}',
    },
  },

  message: {
    detail: {
      noSubject: '(بدون موضوع)',
      emptyMessage: '(رسالة فارغة)',
      messagesInConversation_one: '{{count}} رسالة في هذه المحادثة',
      messagesInConversation_other: '{{count}} رسائل في هذه المحادثة',
      toRecipients: 'إلى {{recipients}}',
      ccRecipients: '، نسخة: {{recipients}}',
    },
    actions: {
      archive: 'أرشفة',
      delete: 'حذف',
      markUnread: 'تحديد كغير مقروءة',
      markRead: 'تحديد كمقروءة',
      reply: 'رد',
      replyAll: 'الرد على الجميع',
      forward: 'إعادة توجيه',
      pin: 'تثبيت الرسالة',
      unpin: 'إلغاء التثبيت',
      star: 'تمييز الرسالة',
      unstar: 'إزالة التمييز',
      snooze: 'تأجيل',
      print: 'طباعة',
      more: 'مزيد من الإجراءات',
      moreInline: 'المزيد',
      reportSpam: 'الإبلاغ كبريد مزعج',
      label: 'تصنيف',
      downloadEml: 'تنزيل .eml',
      messageActions: 'إجراءات الرسالة',
    },
    labelPicker: {
      title: 'التصنيفات',
      empty: 'لا توجد تصنيفات بعد',
    },
    toast: {
      attachmentFailed: 'تعذّر تنزيل المرفق.',
      fileSystemUnavailable: 'نظام الملفات غير متاح على هذا الجهاز.',
      sharingUnavailable: 'المشاركة غير متاحة على هذا الجهاز.',
      printFailed: 'فشلت طباعة الرسالة.',
      downloadFailed: 'فشل تنزيل الرسالة.',
      saveEmailDialog: 'حفظ الرسالة',
    },
  },

  empty: {
    selectConversation: 'اختر محادثة',
    nothingHere: 'لا شيء هنا',
  },

  notFound: {
    title:
      'تعذّر العثور على هذه المحادثة. ربما تم نقلها أو أرشفتها أو حذفها.',
    back: 'العودة إلى البريد الوارد',
  },

  search: {
    placeholder: 'البحث في البريد',
    clear: 'مسح البحث',
    openMenu: 'فتح القائمة',
    goBack: 'رجوع',
    filters: {
      from: 'من',
      fromValue: 'من: {{value}}',
      hasAttachment: 'يحتوي على مرفق',
    },
    nl: {
      understanding: 'جارٍ فهم البحث…',
      searching: 'البحث: {{filters}}',
      allEmails: 'جميع الرسائل',
      fromValue: 'من {{value}}',
      toValue: 'إلى {{value}}',
      subjectContains: 'الموضوع يحتوي على "{{value}}"',
      withAttachments: 'مع مرفقات',
      starred: 'المميّزة',
      unread: 'غير المقروءة',
      read: 'المقروءة',
    },
    empty: {
      noResults: 'لم يتم العثور على نتائج',
      idle: 'ابحث في بريدك',
    },
    results_one: '{{count}} نتيجة',
    results_other: '{{count}} نتائج',
  },

  compose: {
    titleCompose: 'كتابة',
    titleReply: 'رد',
    titleForward: 'إعادة توجيه',
    headTitleCompose: 'كتابة · Inbox · Oxy',
    headTitleWithSubject: '{{subject}} · كتابة · Oxy',
    placeholders: {
      to: 'المستلمون',
      subject: 'الموضوع',
      body: 'اكتب الرسالة',
    },
    fields: {
      from: 'من',
      to: 'إلى',
      cc: 'نسخة',
      bcc: 'نسخة مخفية',
    },
    actions: {
      send: 'إرسال',
      sendNow: 'إرسال الآن',
      moreSendOptions: 'مزيد من خيارات الإرسال',
      sendOptions: 'خيارات الإرسال',
      scheduleSend: 'جدولة الإرسال',
      saveDraft: 'حفظ كمسودة',
      discard: 'تجاهل',
    },
    saveDraftPrompt: {
      title: 'حفظ المسودة؟',
      description: 'هل تريد حفظ هذه الرسالة كمسودة؟',
    },
    dropZone: 'أفلت الملفات هنا للإرفاق',
    toast: {
      addRecipient: 'أضف مستلمًا واحدًا على الأقل.',
      invalidEmail: 'أدخل عنوان بريد إلكتروني صالحًا.',
      sendFailed: 'تعذّر إرسال الرسالة. حاول مرة أخرى.',
      scheduleFailed: 'تعذّر جدولة الرسالة. حاول مرة أخرى.',
      scheduled: 'الرسالة مجدولة في {{time}}',
      uploadFailed: 'تعذّر رفع المرفق.',
      signatureFailed: 'تعذّر تحميل التوقيع.',
    },
  },

  inlineReply: {
    placeholder: 'اكتب ردك…',
    forwardTo: 'إعادة توجيه إلى:',
    replyAllTo: 'الرد على الجميع إلى:',
    replyTo: 'الرد إلى:',
    cc: 'نسخة:',
    bcc: 'نسخة مخفية:',
    ccBccToggle: 'نسخة/نسخة مخفية',
    addRecipients: 'إضافة مستلمين',
    send: 'إرسال',
    quotedPrefix: 'في {{date}}، كتب {{author}}:',
    forwardHeader:
      '\n\n---------- رسالة معادة التوجيه ----------\nمن: {{from}}\nالتاريخ: {{date}}\nالموضوع: {{subject}}\nإلى: {{to}}\n\n',
  },

  smartReply: {
    quickReplies: 'ردود سريعة',
  },

  ai: {
    toolbar: {
      draft: 'مسودة',
      polish: 'تحسين',
      shorter: 'أقصر',
      longer: 'أطول',
      tone: 'الأسلوب',
      suggestSubject: 'اقترح موضوعًا',
    },
    draftModal: {
      title: 'الكتابة بمساعدة الذكاء الاصطناعي',
      subtitle: 'صف ما تريد قوله وستقوم Alia بصياغته من أجلك.',
      placeholder: 'مثال: رفض الاجتماع بأدب واقتراح الأسبوع القادم بدلاً منه',
      toneLabel: 'الأسلوب:',
      cancel: 'إلغاء',
      draft: 'مسودة',
    },
    toneMenu: {
      title: 'تغيير الأسلوب إلى…',
    },
    tones: {
      professional: 'مهني',
      casual: 'غير رسمي',
      friendly: 'ودّي',
      formal: 'رسمي',
    },
  },

  threadSummary: {
    title: 'ملخّص المحادثة',
    messages_one: '{{count}} رسالة',
    messages_other: '{{count}} رسائل',
    keyPoints: 'النقاط الرئيسية',
    actionItems: 'بنود التنفيذ',
    due: 'الموعد: {{date}}',
    unavailable: 'تعذّر تلخيص هذه المحادثة الآن.',
  },

  staleThread: {
    consider: 'فكّر في إرسال رد سريع',
    reply: 'رد',
  },

  followUpReminder: {
    pastDue: 'التزام فات موعده',
    upcoming: 'التزام قادم',
    description: 'لقد قلت "{{text}}" لـ {{recipient}}',
    deadline: {
      dueToday: 'الموعد اليوم',
      overdueOneDay: 'متأخّر بيوم واحد',
      overdueDays: 'متأخّر بـ {{days}} أيام',
      dueTomorrow: 'الموعد غدًا',
      dueInDays: 'الموعد خلال {{days}} أيام',
    },
    fallbackName: 'شخص ما',
    view: 'عرض',
    done: 'تم',
  },

  reminder: {
    create: {
      title: 'إنشاء تذكير',
      placeholder: 'بماذا تريد أن نذكّرك؟',
      whenLabel: 'متى؟',
      submit: 'إنشاء تذكير',
      presets: {
        laterToday: 'لاحقًا اليوم',
        tomorrowMorning: 'صباح الغد',
        thisWeekend: 'نهاية الأسبوع',
        nextWeek: 'الأسبوع القادم',
      },
    },
    time: {
      overdue: 'فات موعده · {{date}}، {{time}}',
      today: 'اليوم، {{time}}',
      tomorrow: 'غدًا، {{time}}',
      onDate: '{{date}}، {{time}}',
    },
  },

  snooze: {
    title: 'تأجيل حتى…',
    options: {
      laterToday: 'لاحقًا اليوم',
      tomorrow: 'غدًا',
      thisWeekend: 'نهاية الأسبوع',
      nextWeek: 'الأسبوع القادم',
    },
    time: {
      today: 'اليوم، {{time}}',
      tomorrow: 'غدًا، {{time}}',
      onDate: '{{date}}، {{time}}',
    },
  },

  schedule: {
    title: 'جدولة الإرسال',
    options: {
      laterToday: 'لاحقًا اليوم',
      tomorrowMorning: 'صباح الغد',
      tomorrowAfternoon: 'بعد ظهر الغد',
      mondayMorning: 'صباح الإثنين',
    },
  },

  template: {
    insert: 'إدراج قالب',
  },

  selection: {
    archive: 'أرشفة',
    delete: 'حذف',
    star: 'تمييز',
    markRead: 'تحديد كمقروءة',
  },

  subscriptions: {
    title: 'الاشتراكات',
    subtitle:
      'بعد إلغاء الاشتراك، قد يستغرق الأمر بضعة أيام للتوقف عن استلام الرسائل',
    empty: {
      title: 'لم يتم العثور على اشتراكات',
      subtitle: 'سيظهر هنا المرسلون الذين يراسلونك بشكل متكرر.',
    },
    unsubscribe: 'إلغاء الاشتراك',
    block: 'حظر',
    frequency: {
      twentyPlus: 'أكثر من 20 رسالة مؤخراً',
      tenToTwenty: '10-20 رسالة مؤخراً',
      count_one: '{{count}} رسالة مؤخراً',
      count_other: '{{count}} رسائل مؤخراً',
    },
  },

  contacts: {
    searchPlaceholder: 'البحث في جهات الاتصال…',
    addContact: 'إضافة جهة اتصال',
    cancel: 'إلغاء',
    saveContact: 'حفظ جهة الاتصال',
    save: 'حفظ',
    edit: {
      cancel: 'إلغاء',
    },
    delete: {
      title: 'حذف جهة الاتصال هذه؟',
      description: 'لا يمكن التراجع عن هذا الإجراء.',
      cta: 'حذف',
    },
    starredFilter: 'المميّزة',
    autoCollected: 'تم جمعها تلقائياً',
    empty: {
      noMatch: 'لا توجد جهات اتصال تطابق البحث.',
      none: 'لا توجد جهات اتصال بعد.',
    },
    toast: {
      nameEmailRequired: 'الاسم والبريد الإلكتروني مطلوبان.',
      created: 'تم إنشاء جهة الاتصال.',
      updated: 'تم تحديث جهة الاتصال.',
      deleted: 'تم حذف جهة الاتصال.',
    },
    form: {
      name: 'الاسم *',
      email: 'البريد الإلكتروني *',
      company: 'الشركة',
      notes: 'ملاحظات',
    },
  },

  shortcuts: {
    title: 'اختصارات لوحة المفاتيح',
    close: 'إغلاق',
    actions: {
      compose: 'كتابة',
      reply: 'رد',
      replyAll: 'الرد على الجميع',
      forward: 'إعادة توجيه',
      archive: 'أرشفة',
      delete: 'حذف',
      nextMessage: 'الرسالة التالية',
      previousMessage: 'الرسالة السابقة',
      starUnstar: 'تمييز / إزالة',
      markUnread: 'تحديد كغير مقروءة',
      search: 'بحث',
      help: 'هذه المساعدة',
    },
  },

  cards: {
    purchase: {
      header: 'شراء',
      order: 'طلب رقم',
      moreItems: '+{{count}} أخرى',
      summary: 'تفاصيل الشراء',
    },
    bill: {
      header: 'فاتورة',
      account: 'الحساب',
      due: 'موعد الاستحقاق {{date}}',
      overdue: 'متأخرة · {{date}}',
      summary: 'تفاصيل الفاتورة',
    },
    trip: {
      header: 'رحلة',
      confirmation: 'التأكيد',
      summary: 'تفاصيل الرحلة',
    },
    package: {
      header: 'طرد',
      tracking: 'التتبّع',
      estimated: 'متوقّع {{date}}',
      summary: 'تفاصيل الطرد',
    },
    event: {
      header: 'فعالية',
      addToCalendar: 'إضافة إلى التقويم',
      googleCalendar: 'Google Calendar',
      addToCalendarDialog: 'إضافة إلى التقويم',
      defaultTitle: 'فعالية',
      summary: 'تفاصيل الفعالية',
    },
  },

  importance: {
    urgent: 'عاجل',
    action: 'يتطلّب إجراءً',
    important: 'مهم',
    fyi: 'للعلم',
  },

  attachment: {
    sizeBytes: '{{value}} بايت',
    sizeKb: '{{value}} ك.ب',
    sizeMb: '{{value}} م.ب',
  },

  settings: {
    head: 'الإعدادات · Inbox · Oxy',
    title: 'الإعدادات',
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
      title: 'سجّل الدخول للوصول إلى بريدك الوارد',
      subtitle:
        'اربط هوية Oxy الخاصة بك لمزامنة الرسائل والتصنيفات والتفضيلات عبر كل أجهزتك.',
      footer:
        'بتسجيل الدخول، فإنك توافق على شروطنا وتقرّ بسياسة الخصوصية لدينا.',
    },
  },
};

export default ar;
