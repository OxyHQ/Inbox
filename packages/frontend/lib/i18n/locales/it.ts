import type { LocaleDict } from '../types';

/**
 * Italian (it-IT) translation dictionary for the Inbox app.
 *
 * Tone: informal "tu" — matches the rest of the Oxy ecosystem.
 * Punctuation and capitalization mirror the source EN strings.
 */
const it: LocaleDict = {
  common: {
    cancel: 'Annulla',
    save: 'Salva',
    ok: 'OK',
    continue: 'Continua',
    back: 'Indietro',
    next: 'Avanti',
    done: 'Fatto',
    close: 'Chiudi',
    loading: 'Caricamento…',
    error: 'Errore',
    success: 'Fatto',
    retry: 'Riprova',
    delete: 'Elimina',
    edit: 'Modifica',
    remove: 'Rimuovi',
    confirm: 'Conferma',
    submit: 'Invia',
    search: 'Cerca',
    yes: 'Sì',
    no: 'No',
    or: 'o',
    and: 'e',
    open: 'Apri',
    discard: 'Scarta',
    of: 'di',
    more: 'Altro',
    less: 'Meno',
  },

  app: {
    name: 'Inbox',
    title: 'Inbox di Oxy',
    titleSuffix: '· Oxy',
  },

  tabs: {
    inbox: 'Posta',
    search: 'Cerca',
    settings: 'Impostazioni',
  },

  drawer: {
    starred: 'Speciali',
    snoozed: 'Posticipati',
    subscriptions: 'Iscrizioni',
    labels: 'Etichette',
    more: 'Altro',
    less: 'Meno',
    notSignedIn: 'Non autenticato',
    accountSwitcher: 'Selettore di account',
    addAnotherAccount: 'Aggiungi un altro account',
    signOut: 'Esci',
    switchAccount: 'Cambia account, autenticato come {{name}}',
    switchingAccount: 'Cambio account in corso…',
    expandSidebar: 'Espandi barra laterale',
    collapseSidebar: 'Comprimi barra laterale',
    signedOut: {
      title: 'Accedi per gestire la posta',
      subtitle: 'Accedi alle tue cassette, alle etichette e componi nuovi messaggi.',
    },
    mailboxes: {
      Inbox: 'Posta in arrivo',
      Sent: 'Inviata',
      Drafts: 'Bozze',
      Trash: 'Cestino',
      Spam: 'Spam',
      Archive: 'Archivio',
      Starred: 'Speciali',
      Snoozed: 'Posticipati',
    },
    mailboxA11y: '{{name}}, {{count}} non letti',
  },

  home: {
    greeting: {
      morning: 'Buongiorno',
      afternoon: 'Buon pomeriggio',
      evening: 'Buonasera',
      withName: '{{greeting}}, {{name}}',
    },
    todaysBrief: 'Riepilogo di oggi',
    openMenu: 'Apri menu',
    jumpToToday: 'Vai a oggi',
    previousWeek: 'Settimana precedente',
    nextWeek: 'Settimana successiva',
    regenerateBrief: 'Rigenera riepilogo',
    inboxSection: 'Posta',
    needsResponse: 'Richiede risposta',
    followUp: 'Da risollecitare',
    needsResponseA11y_one: 'Richiede risposta, {{count}} email',
    needsResponseA11y_other: 'Richiede risposta, {{count}} email',
    followUpA11y_one: 'Da risollecitare, {{count}} email',
    followUpA11y_other: 'Da risollecitare, {{count}} email',
    days: {
      sun: 'DOM',
      mon: 'LUN',
      tue: 'MAR',
      wed: 'MER',
      thu: 'GIO',
      fri: 'VEN',
      sat: 'SAB',
    },
    stats: {
      unread: '{{count}} non lette',
      starred: '{{count}} speciali',
      attachments: '{{count}}',
    },
    brief: {
      analyzing: 'Alia sta analizzando la posta…',
      unavailable: 'Impossibile generare il riepilogo in questo momento.',
      empty: 'Ancora nessuna email da riepilogare.',
      writing: 'Scrittura del riepilogo…',
      preparing: 'Preparazione del riepilogo…',
      failed: 'Impossibile scrivere il riepilogo di oggi.',
      nothingNew: 'Niente di nuovo oggi.',
      tapRetry: 'Tocca per riprovare.',
    },
    feedEmpty: {
      title: 'Tutto in pari',
      subtitle: 'Niente di nuovo nella posta.',
    },
    signedOut: {
      subtitle:
        'Accedi per vedere il riepilogo quotidiano, le email che richiedono una risposta e i solleciti in sospeso.',
    },
  },


  inbox: {
    title: 'Posta',
    starredTitle: 'Speciali',
    searchInMailbox: 'Cerca in {{mailbox}}',
    emptyTitle: 'Non c\'è niente qui',
    emptyAllCaught: 'Sei in pari.',
    emptySignIn: 'Accedi per visualizzare la posta.',
    pagination: '{{from}}–{{to}} di {{total}}',
    remind: 'Ricorda',
    bundled: 'Raggruppate',
    flat: 'Elenco',
    composeFab: 'Scrivi una nuova email',
    composeFabLabel: 'Scrivi',
    askAlia: 'Chiedi ad Alia',
    askAliaHint: 'Apre l\'assistente AI Alia per porre domande sulla posta',
    sections: {
      reminders: 'Promemoria',
      pinned: 'Fissati',
      today: 'Oggi',
      yesterday: 'Ieri',
      thisWeek: 'Questa settimana',
      thisMonth: 'Questo mese',
      earlier: 'Precedenti',
    },
    aliaSuggestions: {
      unread: {
        label: 'Email non lette',
        prompt: 'Quali email richiedono la mia attenzione?',
      },
      todaysSummary: {
        label: 'Riepilogo di oggi',
        prompt: 'Riassumi le email di oggi',
      },
      withAttachments: {
        label: 'Con allegati',
        prompt: 'Trova email con allegati',
      },
    },
    aliaClientContext:
      'User is in the Inbox app viewing their email. Use oxy_inbox tools to access their emails.',
    toast: {
      archiveUnavailable: 'Cartella Archivio non disponibile.',
      trashUnavailable: 'Cartella Cestino non disponibile.',
      offlineSync_one: 'Sincronizzata {{count}} azione offline.',
      offlineSync_other: 'Sincronizzate {{count}} azioni offline.',
      newVersionAvailable: 'Nuova versione disponibile — aggiorna per applicarla.',
      newEmail: 'Nuova email da {{sender}}',
    },
  },

  message: {
    detail: {
      noSubject: '(senza oggetto)',
      emptyMessage: '(messaggio vuoto)',
      messagesInConversation_one: '{{count}} messaggio in questa conversazione',
      messagesInConversation_other: '{{count}} messaggi in questa conversazione',
      toRecipients: 'a {{recipients}}',
      ccRecipients: ', cc: {{recipients}}',
    },
    actions: {
      archive: 'Archivia',
      delete: 'Elimina',
      markUnread: 'Segna come non letto',
      markRead: 'Segna come letto',
      reply: 'Rispondi',
      replyAll: 'Rispondi a tutti',
      forward: 'Inoltra',
      pin: 'Fissa il messaggio',
      unpin: 'Sblocca il messaggio',
      star: 'Segna come speciale',
      unstar: 'Rimuovi speciale',
      snooze: 'Posticipa',
      print: 'Stampa',
      more: 'Altre azioni',
      moreInline: 'Altro',
      reportSpam: 'Segnala come spam',
      label: 'Etichetta',
      downloadEml: 'Scarica .eml',
      messageActions: 'Azioni del messaggio',
    },
    labelPicker: {
      title: 'Etichette',
      empty: 'Ancora nessuna etichetta',
    },
    toast: {
      attachmentFailed: 'Impossibile scaricare l\'allegato.',
      fileSystemUnavailable: 'File system non disponibile su questo dispositivo.',
      sharingUnavailable: 'Condivisione non disponibile su questo dispositivo.',
      printFailed: 'Impossibile stampare l\'email.',
      downloadFailed: 'Impossibile scaricare l\'email.',
      saveEmailDialog: 'Salva email',
    },
  },

  empty: {
    selectConversation: 'Seleziona una conversazione',
    nothingHere: 'Non c\'è niente qui',
  },

  notFound: {
    title:
      'Conversazione non trovata. Potrebbe essere stata spostata, archiviata o eliminata.',
    back: 'Torna alla posta',
  },

  search: {
    placeholder: 'Cerca nella posta',
    clear: 'Cancella ricerca',
    openMenu: 'Apri menu',
    goBack: 'Indietro',
    filters: {
      from: 'Da',
      fromValue: 'Da: {{value}}',
      hasAttachment: 'Con allegato',
    },
    nl: {
      understanding: 'Interpretazione della ricerca…',
      searching: 'Ricerca: {{filters}}',
      allEmails: 'tutte le email',
      fromValue: 'da {{value}}',
      toValue: 'a {{value}}',
      subjectContains: 'oggetto contiene "{{value}}"',
      withAttachments: 'con allegati',
      starred: 'speciali',
      unread: 'non lette',
      read: 'lette',
    },
    empty: {
      noResults: 'Nessun risultato',
      idle: 'Cerca nelle tue email',
    },
    results_one: '{{count}} risultato',
    results_other: '{{count}} risultati',
  },

  compose: {
    titleCompose: 'Scrivi',
    titleReply: 'Rispondi',
    titleForward: 'Inoltra',
    headTitleCompose: 'Scrivi · Inbox · Oxy',
    headTitleWithSubject: '{{subject}} · Scrivi · Oxy',
    placeholders: {
      to: 'Destinatari',
      subject: 'Oggetto',
      body: 'Scrivi email',
    },
    fields: {
      from: 'Da',
      to: 'A',
      cc: 'Cc',
      bcc: 'Ccn',
    },
    actions: {
      send: 'Invia',
      sendNow: 'Invia ora',
      moreSendOptions: 'Altre opzioni di invio',
      sendOptions: 'Opzioni di invio',
      scheduleSend: 'Programma invio',
      saveDraft: 'Salva bozza',
      discard: 'Scarta',
    },
    saveDraftPrompt: {
      title: 'Salvare la bozza?',
      description: 'Vuoi salvare questo messaggio come bozza?',
    },
    dropZone: 'Trascina qui i file da allegare',
    toast: {
      addRecipient: 'Aggiungi almeno un destinatario.',
      invalidEmail: 'Inserisci un indirizzo email valido.',
      sendFailed: 'Impossibile inviare l\'email. Riprova.',
      scheduleFailed: 'Impossibile programmare l\'invio. Riprova.',
      scheduled: 'Email programmata per il {{time}}',
      uploadFailed: 'Impossibile caricare l\'allegato.',
      signatureFailed: 'Impossibile caricare la firma.',
    },
  },

  inlineReply: {
    placeholder: 'Scrivi la tua risposta…',
    forwardTo: 'Inoltra a:',
    replyAllTo: 'Rispondi a tutti a:',
    replyTo: 'Rispondi a:',
    cc: 'Cc:',
    bcc: 'Ccn:',
    ccBccToggle: 'Cc/Ccn',
    addRecipients: 'Aggiungi destinatari',
    send: 'Invia',
    quotedPrefix: 'Il {{date}}, {{author}} ha scritto:',
    forwardHeader:
      '\n\n---------- Messaggio inoltrato ----------\nDa: {{from}}\nData: {{date}}\nOggetto: {{subject}}\nA: {{to}}\n\n',
  },

  smartReply: {
    quickReplies: 'Risposte rapide',
  },

  ai: {
    toolbar: {
      draft: 'Bozza',
      polish: 'Rifinisci',
      shorter: 'Più breve',
      longer: 'Più lungo',
      tone: 'Tono',
      suggestSubject: 'Suggerisci oggetto',
    },
    draftModal: {
      title: 'Scrivi con AI',
      subtitle: 'Descrivi cosa vuoi dire e Alia lo redigerà per te.',
      placeholder: 'es. Rifiuta cortesemente la riunione e proponi la prossima settimana',
      toneLabel: 'Tono:',
      cancel: 'Annulla',
      draft: 'Bozza',
    },
    toneMenu: {
      title: 'Cambia tono in…',
    },
    tones: {
      professional: 'Professionale',
      casual: 'Informale',
      friendly: 'Amichevole',
      formal: 'Formale',
    },
  },

  threadSummary: {
    title: 'Riepilogo conversazione',
    messages_one: '{{count}} messaggio',
    messages_other: '{{count}} messaggi',
    keyPoints: 'Punti chiave',
    actionItems: 'Azioni da fare',
    due: 'Scadenza: {{date}}',
    unavailable: 'Impossibile riassumere questa conversazione ora.',
  },

  staleThread: {
    consider: 'Valuta una risposta rapida',
    reply: 'Rispondi',
  },

  followUpReminder: {
    pastDue: 'Impegno scaduto',
    upcoming: 'Impegno in arrivo',
    description: 'Hai detto "{{text}}" a {{recipient}}',
    deadline: {
      dueToday: 'Scade oggi',
      overdueOneDay: 'In ritardo di 1 giorno',
      overdueDays: 'In ritardo di {{days}} giorni',
      dueTomorrow: 'Scade domani',
      dueInDays: 'Scade tra {{days}} giorni',
    },
    fallbackName: 'qualcuno',
    view: 'Mostra',
    done: 'Fatto',
  },

  reminder: {
    create: {
      title: 'Crea promemoria',
      placeholder: 'Di cosa vuoi essere ricordato?',
      whenLabel: 'Quando?',
      submit: 'Crea promemoria',
      presets: {
        laterToday: 'Più tardi oggi',
        tomorrowMorning: 'Domani mattina',
        thisWeekend: 'Questo fine settimana',
        nextWeek: 'La prossima settimana',
      },
    },
    time: {
      overdue: 'Scaduto · {{date}}, {{time}}',
      today: 'Oggi, {{time}}',
      tomorrow: 'Domani, {{time}}',
      onDate: '{{date}}, {{time}}',
    },
  },

  snooze: {
    title: 'Posticipa fino a…',
    options: {
      laterToday: 'Più tardi oggi',
      tomorrow: 'Domani',
      thisWeekend: 'Questo fine settimana',
      nextWeek: 'La prossima settimana',
    },
    time: {
      today: 'Oggi, {{time}}',
      tomorrow: 'Domani, {{time}}',
      onDate: '{{date}}, {{time}}',
    },
  },

  schedule: {
    title: 'Programma invio',
    options: {
      laterToday: 'Più tardi oggi',
      tomorrowMorning: 'Domani mattina',
      tomorrowAfternoon: 'Domani pomeriggio',
      mondayMorning: 'Lunedì mattina',
    },
  },

  template: {
    insert: 'Inserisci modello',
  },

  selection: {
    archive: 'Archivia',
    delete: 'Elimina',
    star: 'Segna come speciale',
    markRead: 'Segna come letto',
  },

  subscriptions: {
    title: 'Iscrizioni',
    subtitle:
      'Quando ti disiscrivi, potrebbero volerci alcuni giorni prima di smettere di ricevere messaggi',
    empty: {
      title: 'Nessuna iscrizione trovata',
      subtitle: 'Qui appariranno i mittenti che ti scrivono spesso.',
    },
    unsubscribe: 'Disiscriviti',
    block: 'Blocca',
    frequency: {
      twentyPlus: 'Oltre 20 email recenti',
      tenToTwenty: '10-20 email recenti',
      count_one: '{{count}} email recente',
      count_other: '{{count}} email recenti',
    },
  },

  contacts: {
    searchPlaceholder: 'Cerca contatti…',
    addContact: 'Aggiungi contatto',
    cancel: 'Annulla',
    saveContact: 'Salva contatto',
    save: 'Salva',
    edit: {
      cancel: 'Annulla',
    },
    delete: {
      title: 'Eliminare questo contatto?',
      description: 'Questa azione non può essere annullata.',
      cta: 'Elimina',
    },
    starredFilter: 'Speciali',
    autoCollected: 'Raccolto automaticamente',
    empty: {
      noMatch: 'Nessun contatto corrisponde alla ricerca.',
      none: 'Ancora nessun contatto.',
    },
    toast: {
      nameEmailRequired: 'Nome ed email sono obbligatori.',
      created: 'Contatto creato.',
      updated: 'Contatto aggiornato.',
      deleted: 'Contatto eliminato.',
    },
    form: {
      name: 'Nome *',
      email: 'Email *',
      company: 'Azienda',
      notes: 'Note',
    },
  },

  shortcuts: {
    title: 'Scorciatoie da tastiera',
    close: 'Chiudi',
    actions: {
      compose: 'Scrivi',
      reply: 'Rispondi',
      replyAll: 'Rispondi a tutti',
      forward: 'Inoltra',
      archive: 'Archivia',
      delete: 'Elimina',
      nextMessage: 'Messaggio successivo',
      previousMessage: 'Messaggio precedente',
      starUnstar: 'Speciale / rimuovi speciale',
      markUnread: 'Segna come non letto',
      search: 'Cerca',
      help: 'Questa guida',
    },
  },

  cards: {
    purchase: {
      header: 'Acquisto',
      order: 'Ordine n.',
      moreItems: '+{{count}} altri',
      summary: 'Dettagli acquisto',
    },
    bill: {
      header: 'Fattura',
      account: 'Conto',
      due: 'Scade il {{date}}',
      overdue: 'Scaduta · {{date}}',
      summary: 'Dettagli fattura',
    },
    trip: {
      header: 'Viaggio',
      confirmation: 'Conferma',
      summary: 'Dettagli viaggio',
    },
    package: {
      header: 'Pacco',
      tracking: 'Tracciamento',
      estimated: 'Stimato {{date}}',
      summary: 'Dettagli pacco',
    },
    event: {
      header: 'Evento',
      addToCalendar: 'Aggiungi al calendario',
      googleCalendar: 'Google Calendar',
      addToCalendarDialog: 'Aggiungi al calendario',
      defaultTitle: 'Evento',
      summary: 'Dettagli evento',
    },
  },

  importance: {
    urgent: 'Urgente',
    action: 'Azione richiesta',
    important: 'Importante',
    fyi: 'Per tua informazione',
  },

  attachment: {
    sizeBytes: '{{value}} B',
    sizeKb: '{{value}} KB',
    sizeMb: '{{value}} MB',
  },

  settings: {
    head: 'Impostazioni · Inbox · Oxy',
    title: 'Impostazioni',
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
      title: 'Accedi per usare la tua posta',
      subtitle:
        'Connetti la tua identità Oxy per sincronizzare messaggi, etichette e preferenze su tutti i dispositivi.',
      footer:
        'Accedendo accetti i nostri Termini e riconosci la nostra Privacy Policy.',
    },
  },
};

export default it;
