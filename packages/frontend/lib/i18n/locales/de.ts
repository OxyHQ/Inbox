import type { LocaleDict } from '../types';

/**
 * German (de-DE) translation dictionary for the Inbox app.
 *
 * Tone: informal "Du" — matches the rest of the Oxy ecosystem.
 * Punctuation and capitalization mirror the source EN strings.
 */
const de: LocaleDict = {
  common: {
    cancel: 'Abbrechen',
    save: 'Speichern',
    ok: 'OK',
    continue: 'Weiter',
    back: 'Zurück',
    next: 'Weiter',
    done: 'Fertig',
    close: 'Schließen',
    loading: 'Lädt…',
    error: 'Fehler',
    success: 'Fertig',
    retry: 'Erneut versuchen',
    delete: 'Löschen',
    edit: 'Bearbeiten',
    remove: 'Entfernen',
    confirm: 'Bestätigen',
    submit: 'Absenden',
    search: 'Suchen',
    yes: 'Ja',
    no: 'Nein',
    or: 'oder',
    and: 'und',
    open: 'Öffnen',
    discard: 'Verwerfen',
    of: 'von',
    more: 'Mehr',
    less: 'Weniger',
  },

  app: {
    name: 'Inbox',
    title: 'Inbox von Oxy',
    titleSuffix: '· Oxy',
  },

  tabs: {
    inbox: 'Posteingang',
    search: 'Suchen',
    settings: 'Einstellungen',
  },

  drawer: {
    starred: 'Markiert',
    snoozed: 'Erinnerung später',
    subscriptions: 'Abonnements',
    labels: 'Labels',
    more: 'Mehr',
    less: 'Weniger',
    notSignedIn: 'Nicht angemeldet',
    accountSwitcher: 'Kontoauswahl',
    addAnotherAccount: 'Weiteres Konto hinzufügen',
    signOut: 'Abmelden',
    switchAccount: 'Konto wechseln, angemeldet als {{name}}',
    switchingAccount: 'Konto wird gewechselt…',
    expandSidebar: 'Seitenleiste ausklappen',
    collapseSidebar: 'Seitenleiste einklappen',
    signedOut: {
      title: 'Melde dich an, um deine E-Mails zu verwalten',
      subtitle: 'Greife auf deine Postfächer und Labels zu und verfasse neue Nachrichten.',
    },
    mailboxes: {
      Inbox: 'Posteingang',
      Sent: 'Gesendet',
      Drafts: 'Entwürfe',
      Trash: 'Papierkorb',
      Spam: 'Spam',
      Archive: 'Archiv',
      Starred: 'Markiert',
      Snoozed: 'Erinnerung später',
    },
    mailboxA11y: '{{name}}, {{count}} ungelesen',
  },

  home: {
    greeting: {
      morning: 'Guten Morgen',
      afternoon: 'Guten Tag',
      evening: 'Guten Abend',
      withName: '{{greeting}}, {{name}}',
    },
    todaysBrief: 'Tagesüberblick',
    openMenu: 'Menü öffnen',
    jumpToToday: 'Zu heute springen',
    previousWeek: 'Vorherige Woche',
    nextWeek: 'Nächste Woche',
    regenerateBrief: 'Überblick neu erstellen',
    inboxSection: 'Posteingang',
    needsResponse: 'Antwort erforderlich',
    followUp: 'Nachfassen',
    needsResponseA11y_one: 'Antwort erforderlich, {{count}} E-Mail',
    needsResponseA11y_other: 'Antwort erforderlich, {{count}} E-Mails',
    followUpA11y_one: 'Nachfassen, {{count}} E-Mail',
    followUpA11y_other: 'Nachfassen, {{count}} E-Mails',
    days: {
      sun: 'SO',
      mon: 'MO',
      tue: 'DI',
      wed: 'MI',
      thu: 'DO',
      fri: 'FR',
      sat: 'SA',
    },
    stats: {
      unread: '{{count}} ungelesen',
      starred: '{{count}} markiert',
      attachments: '{{count}}',
    },
    brief: {
      analyzing: 'Alia analysiert deinen Posteingang…',
      unavailable: 'Überblick kann gerade nicht erstellt werden.',
      empty: 'Noch keine E-Mails zum Zusammenfassen.',
      writing: 'Dein Überblick wird geschrieben…',
      preparing: 'Dein Überblick wird vorbereitet…',
      failed: 'Der heutige Überblick konnte nicht erstellt werden.',
      nothingNew: 'Heute nichts Neues.',
      tapRetry: 'Tippe, um es erneut zu versuchen.',
    },
    feedEmpty: {
      title: 'Alles erledigt',
      subtitle: 'Nichts Neues im Posteingang.',
    },
    signedOut: {
      subtitle:
        'Melde dich an, um deinen Tagesüberblick, E-Mails mit Antwortbedarf und ausstehende Nachfragen zu sehen.',
    },
  },


  inbox: {
    title: 'Posteingang',
    starredTitle: 'Markiert',
    searchInMailbox: 'In {{mailbox}} suchen',
    emptyTitle: 'Hier ist nichts',
    emptyAllCaught: 'Du bist auf dem aktuellen Stand.',
    emptySignIn: 'Melde dich an, um auf deine E-Mails zuzugreifen.',
    pagination: '{{from}}–{{to}} von {{total}}',
    remind: 'Erinnern',
    bundled: 'Gebündelt',
    flat: 'Liste',
    composeFab: 'Neue E-Mail verfassen',
    composeFabLabel: 'Verfassen',
    askAlia: 'Alia fragen',
    askAliaHint: 'Öffnet den KI-Assistenten Alia, um Fragen zum Posteingang zu stellen',
    sections: {
      reminders: 'Erinnerungen',
      pinned: 'Angeheftet',
      today: 'Heute',
      yesterday: 'Gestern',
      thisWeek: 'Diese Woche',
      thisMonth: 'Dieser Monat',
      earlier: 'Älter',
    },
    aliaSuggestions: {
      unread: {
        label: 'Ungelesene E-Mails',
        prompt: 'Welche E-Mails brauchen meine Aufmerksamkeit?',
      },
      todaysSummary: {
        label: 'Zusammenfassung von heute',
        prompt: 'Fasse meine heutigen E-Mails zusammen',
      },
      withAttachments: {
        label: 'Mit Anhängen',
        prompt: 'Suche E-Mails mit Anhängen',
      },
    },
    aliaClientContext:
      'User is in the Inbox app viewing their email. Use oxy_inbox tools to access their emails.',
    toast: {
      archiveUnavailable: 'Archiv-Ordner nicht verfügbar.',
      trashUnavailable: 'Papierkorb-Ordner nicht verfügbar.',
      offlineSync_one: '{{count}} Offline-Aktion synchronisiert.',
      offlineSync_other: '{{count}} Offline-Aktionen synchronisiert.',
      newVersionAvailable: 'Neue Version verfügbar — neu laden zum Aktualisieren.',
      newEmail: 'Neue E-Mail von {{sender}}',
    },
  },

  message: {
    detail: {
      noSubject: '(kein Betreff)',
      emptyMessage: '(leere Nachricht)',
      messagesInConversation_one: '{{count}} Nachricht in dieser Konversation',
      messagesInConversation_other: '{{count}} Nachrichten in dieser Konversation',
      toRecipients: 'an {{recipients}}',
      ccRecipients: ', cc: {{recipients}}',
    },
    actions: {
      archive: 'Archivieren',
      delete: 'Löschen',
      markUnread: 'Als ungelesen markieren',
      markRead: 'Als gelesen markieren',
      reply: 'Antworten',
      replyAll: 'Allen antworten',
      forward: 'Weiterleiten',
      pin: 'Nachricht anheften',
      unpin: 'Anheften aufheben',
      star: 'Nachricht markieren',
      unstar: 'Markierung entfernen',
      snooze: 'Erinnern',
      print: 'Drucken',
      more: 'Mehr Aktionen',
      moreInline: 'Mehr',
      reportSpam: 'Spam melden',
      label: 'Label',
      downloadEml: '.eml herunterladen',
      messageActions: 'Nachrichten-Aktionen',
    },
    labelPicker: {
      title: 'Labels',
      empty: 'Noch keine Labels',
    },
    toast: {
      attachmentFailed: 'Anhang konnte nicht heruntergeladen werden.',
      fileSystemUnavailable: 'Dateisystem auf diesem Gerät nicht verfügbar.',
      sharingUnavailable: 'Teilen auf diesem Gerät nicht verfügbar.',
      printFailed: 'Drucken fehlgeschlagen.',
      downloadFailed: 'Herunterladen fehlgeschlagen.',
      saveEmailDialog: 'E-Mail speichern',
    },
  },

  empty: {
    selectConversation: 'Konversation auswählen',
    nothingHere: 'Hier ist nichts',
  },

  notFound: {
    title:
      'Diese Konversation wurde nicht gefunden. Möglicherweise wurde sie verschoben, archiviert oder gelöscht.',
    back: 'Zurück zum Posteingang',
  },

  search: {
    placeholder: 'E-Mails durchsuchen',
    clear: 'Suche löschen',
    openMenu: 'Menü öffnen',
    goBack: 'Zurück',
    filters: {
      from: 'Von',
      fromValue: 'Von: {{value}}',
      hasAttachment: 'Mit Anhang',
    },
    nl: {
      understanding: 'Suche wird verstanden…',
      searching: 'Suche: {{filters}}',
      allEmails: 'alle E-Mails',
      fromValue: 'von {{value}}',
      toValue: 'an {{value}}',
      subjectContains: 'Betreff enthält "{{value}}"',
      withAttachments: 'mit Anhängen',
      starred: 'markiert',
      unread: 'ungelesen',
      read: 'gelesen',
    },
    empty: {
      noResults: 'Keine Ergebnisse gefunden',
      idle: 'Durchsuche deine E-Mails',
    },
    results_one: '{{count}} Ergebnis',
    results_other: '{{count}} Ergebnisse',
  },

  compose: {
    titleCompose: 'Verfassen',
    titleReply: 'Antworten',
    titleForward: 'Weiterleiten',
    headTitleCompose: 'Verfassen · Inbox · Oxy',
    headTitleWithSubject: '{{subject}} · Verfassen · Oxy',
    placeholders: {
      to: 'Empfänger',
      subject: 'Betreff',
      body: 'E-Mail verfassen',
    },
    fields: {
      from: 'Von',
      to: 'An',
      cc: 'Cc',
      bcc: 'Bcc',
    },
    actions: {
      send: 'Senden',
      sendNow: 'Jetzt senden',
      moreSendOptions: 'Weitere Sendeoptionen',
      sendOptions: 'Sendeoptionen',
      scheduleSend: 'Senden planen',
      saveDraft: 'Entwurf speichern',
      discard: 'Verwerfen',
    },
    saveDraftPrompt: {
      title: 'Entwurf speichern?',
      description: 'Möchtest du diese Nachricht als Entwurf speichern?',
    },
    dropZone: 'Dateien zum Anhängen hier ablegen',
    toast: {
      addRecipient: 'Bitte füge mindestens einen Empfänger hinzu.',
      invalidEmail: 'Bitte gib eine gültige E-Mail-Adresse ein.',
      sendFailed: 'E-Mail konnte nicht gesendet werden. Bitte erneut versuchen.',
      scheduleFailed: 'Senden konnte nicht geplant werden. Bitte erneut versuchen.',
      scheduled: 'E-Mail geplant für {{time}}',
      uploadFailed: 'Anhang konnte nicht hochgeladen werden.',
      signatureFailed: 'Signatur konnte nicht geladen werden.',
    },
  },

  inlineReply: {
    placeholder: 'Antwort verfassen…',
    forwardTo: 'Weiterleiten an:',
    replyAllTo: 'Allen antworten an:',
    replyTo: 'Antworten an:',
    cc: 'Cc:',
    bcc: 'Bcc:',
    ccBccToggle: 'Cc/Bcc',
    addRecipients: 'Empfänger hinzufügen',
    send: 'Senden',
    quotedPrefix: 'Am {{date}} schrieb {{author}}:',
    forwardHeader:
      '\n\n---------- Weitergeleitete Nachricht ----------\nVon: {{from}}\nDatum: {{date}}\nBetreff: {{subject}}\nAn: {{to}}\n\n',
  },

  smartReply: {
    quickReplies: 'Schnellantworten',
  },

  ai: {
    toolbar: {
      draft: 'Entwurf',
      polish: 'Verfeinern',
      shorter: 'Kürzer',
      longer: 'Länger',
      tone: 'Tonalität',
      suggestSubject: 'Betreff vorschlagen',
    },
    draftModal: {
      title: 'Mit KI verfassen',
      subtitle: 'Beschreibe, was du sagen möchtest, und Alia entwirft es für dich.',
      placeholder: 'z. B. Termin höflich absagen, stattdessen nächste Woche vorschlagen',
      toneLabel: 'Tonalität:',
      cancel: 'Abbrechen',
      draft: 'Entwurf',
    },
    toneMenu: {
      title: 'Tonalität ändern zu…',
    },
    tones: {
      professional: 'Professionell',
      casual: 'Locker',
      friendly: 'Freundlich',
      formal: 'Formell',
    },
  },

  threadSummary: {
    title: 'Konversations-Zusammenfassung',
    messages_one: '{{count}} Nachricht',
    messages_other: '{{count}} Nachrichten',
    keyPoints: 'Kernpunkte',
    actionItems: 'Aufgaben',
    due: 'Fällig: {{date}}',
    unavailable: 'Diese Unterhaltung kann gerade nicht zusammengefasst werden.',
  },

  staleThread: {
    consider: 'Überlege, eine kurze Antwort zu senden',
    reply: 'Antworten',
  },

  followUpReminder: {
    pastDue: 'Überfällige Zusage',
    upcoming: 'Anstehende Zusage',
    description: 'Du hast „{{text}}" zu {{recipient}} gesagt',
    deadline: {
      dueToday: 'Heute fällig',
      overdueOneDay: '1 Tag überfällig',
      overdueDays: '{{days}} Tage überfällig',
      dueTomorrow: 'Morgen fällig',
      dueInDays: 'Fällig in {{days}} Tagen',
    },
    fallbackName: 'jemand',
    view: 'Ansehen',
    done: 'Erledigt',
  },

  reminder: {
    create: {
      title: 'Erinnerung erstellen',
      placeholder: 'Woran möchtest du erinnert werden?',
      whenLabel: 'Wann?',
      submit: 'Erinnerung erstellen',
      presets: {
        laterToday: 'Später heute',
        tomorrowMorning: 'Morgen früh',
        thisWeekend: 'Dieses Wochenende',
        nextWeek: 'Nächste Woche',
      },
    },
    time: {
      overdue: 'Überfällig · {{date}}, {{time}}',
      today: 'Heute, {{time}}',
      tomorrow: 'Morgen, {{time}}',
      onDate: '{{date}}, {{time}}',
    },
  },

  snooze: {
    title: 'Erinnern bis…',
    options: {
      laterToday: 'Später heute',
      tomorrow: 'Morgen',
      thisWeekend: 'Dieses Wochenende',
      nextWeek: 'Nächste Woche',
    },
    time: {
      today: 'Heute, {{time}}',
      tomorrow: 'Morgen, {{time}}',
      onDate: '{{date}}, {{time}}',
    },
  },

  schedule: {
    title: 'Senden planen',
    options: {
      laterToday: 'Später heute',
      tomorrowMorning: 'Morgen früh',
      tomorrowAfternoon: 'Morgen Nachmittag',
      mondayMorning: 'Montag früh',
    },
  },

  template: {
    insert: 'Vorlage einfügen',
  },

  selection: {
    archive: 'Archivieren',
    delete: 'Löschen',
    star: 'Markieren',
    markRead: 'Als gelesen markieren',
  },

  subscriptions: {
    title: 'Abonnements',
    subtitle:
      'Nach dem Abbestellen kann es ein paar Tage dauern, bis keine Nachrichten mehr ankommen',
    empty: {
      title: 'Keine Abonnements gefunden',
      subtitle: 'Absender, die dir häufig E-Mails schicken, erscheinen hier.',
    },
    unsubscribe: 'Abbestellen',
    block: 'Blockieren',
    frequency: {
      twentyPlus: '20+ kürzliche E-Mails',
      tenToTwenty: '10-20 kürzliche E-Mails',
      count_one: '{{count}} kürzliche E-Mail',
      count_other: '{{count}} kürzliche E-Mails',
    },
  },

  contacts: {
    searchPlaceholder: 'Kontakte durchsuchen…',
    addContact: 'Kontakt hinzufügen',
    cancel: 'Abbrechen',
    saveContact: 'Kontakt speichern',
    save: 'Speichern',
    edit: {
      cancel: 'Abbrechen',
    },
    delete: {
      title: 'Diesen Kontakt löschen?',
      description: 'Diese Aktion kann nicht rückgängig gemacht werden.',
      cta: 'Löschen',
    },
    starredFilter: 'Markiert',
    autoCollected: 'Automatisch erfasst',
    empty: {
      noMatch: 'Keine Kontakte entsprechen deiner Suche.',
      none: 'Noch keine Kontakte.',
    },
    toast: {
      nameEmailRequired: 'Name und E-Mail sind erforderlich.',
      created: 'Kontakt erstellt.',
      updated: 'Kontakt aktualisiert.',
      deleted: 'Kontakt gelöscht.',
    },
    form: {
      name: 'Name *',
      email: 'E-Mail *',
      company: 'Unternehmen',
      notes: 'Notizen',
    },
  },

  shortcuts: {
    title: 'Tastenkürzel',
    close: 'Schließen',
    actions: {
      compose: 'Verfassen',
      reply: 'Antworten',
      replyAll: 'Allen antworten',
      forward: 'Weiterleiten',
      archive: 'Archivieren',
      delete: 'Löschen',
      nextMessage: 'Nächste Nachricht',
      previousMessage: 'Vorherige Nachricht',
      starUnstar: 'Markieren / Markierung entfernen',
      markUnread: 'Als ungelesen markieren',
      search: 'Suchen',
      help: 'Diese Hilfe',
    },
  },

  cards: {
    purchase: {
      header: 'Einkauf',
      order: 'Bestellnr.',
      moreItems: '+{{count}} weitere',
      summary: 'Einkaufsdetails',
    },
    bill: {
      header: 'Rechnung',
      account: 'Konto',
      due: 'Fällig {{date}}',
      overdue: 'Überfällig · {{date}}',
      summary: 'Rechnungsdetails',
    },
    trip: {
      header: 'Reise',
      confirmation: 'Bestätigung',
      summary: 'Reisedetails',
    },
    package: {
      header: 'Paket',
      tracking: 'Sendungsverfolgung',
      estimated: 'Vsl. {{date}}',
      summary: 'Paketdetails',
    },
    event: {
      header: 'Termin',
      addToCalendar: 'Zum Kalender hinzufügen',
      googleCalendar: 'Google Kalender',
      addToCalendarDialog: 'Zum Kalender hinzufügen',
      defaultTitle: 'Termin',
      summary: 'Termindetails',
    },
  },

  importance: {
    urgent: 'Dringend',
    action: 'Aktion erforderlich',
    important: 'Wichtig',
    fyi: 'Zur Info',
  },

  attachment: {
    sizeBytes: '{{value}} B',
    sizeKb: '{{value}} KB',
    sizeMb: '{{value}} MB',
  },

  settings: {
    head: 'Einstellungen · Inbox · Oxy',
    title: 'Einstellungen',
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
      title: 'Melde dich an, um auf deinen Posteingang zuzugreifen',
      subtitle:
        'Verbinde deine Oxy-Identität, um Nachrichten, Labels und Einstellungen geräteübergreifend zu synchronisieren.',
      footer:
        'Mit der Anmeldung akzeptierst du unsere Nutzungsbedingungen und bestätigst unsere Datenschutzrichtlinie.',
    },
  },
};

export default de;
