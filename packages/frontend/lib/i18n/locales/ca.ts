import type { LocaleDict } from '../types';

/**
 * Catalan (ca-ES) translation dictionary for the Inbox app.
 *
 * Tone: informal "tu" — matches the rest of the Oxy ecosystem.
 * Punctuation and capitalization mirror the source EN strings.
 */
const ca: LocaleDict = {
  common: {
    cancel: 'Cancel·la',
    save: 'Desa',
    ok: "D'acord",
    continue: 'Continua',
    back: 'Enrere',
    next: 'Següent',
    done: 'Fet',
    close: 'Tanca',
    loading: 'Carregant…',
    error: 'Error',
    success: 'Fet',
    retry: 'Torna-ho a provar',
    delete: 'Elimina',
    edit: 'Edita',
    remove: 'Treu',
    confirm: 'Confirma',
    submit: 'Envia',
    search: 'Cerca',
    yes: 'Sí',
    no: 'No',
    or: 'o',
    and: 'i',
    open: 'Obre',
    discard: 'Descarta',
    of: 'de',
    more: 'Més',
    less: 'Menys',
  },

  app: {
    name: 'Inbox',
    title: 'Inbox per Oxy',
    titleSuffix: '· Oxy',
  },

  tabs: {
    inbox: 'Safata',
    search: 'Cerca',
    settings: 'Configuració',
  },

  drawer: {
    starred: 'Destacats',
    snoozed: 'Posposats',
    subscriptions: 'Subscripcions',
    labels: 'Etiquetes',
    more: 'Més',
    less: 'Menys',
    notSignedIn: "Sessió no iniciada",
    accountSwitcher: 'Selector de compte',
    addAnotherAccount: 'Afegeix un altre compte',
    signOut: 'Tanca la sessió',
    switchAccount: 'Canvia de compte, sessió iniciada com a {{name}}',
    switchingAccount: 'Canviant de compte…',
    expandSidebar: 'Expandeix la barra lateral',
    collapseSidebar: 'Contrau la barra lateral',
    signedOut: {
      title: 'Inicia la sessió per gestionar el correu',
      subtitle:
        'Accedeix a les bústies, etiquetes i redacta missatges nous.',
    },
    mailboxes: {
      Inbox: "Safata d'entrada",
      Sent: 'Enviats',
      Drafts: 'Esborranys',
      Trash: 'Paperera',
      Spam: 'Brossa',
      Archive: 'Arxiu',
      Starred: 'Destacats',
      Snoozed: 'Posposats',
    },
    mailboxA11y: '{{name}}, {{count}} sense llegir',
  },

  home: {
    greeting: {
      morning: 'Bon dia',
      afternoon: 'Bona tarda',
      evening: 'Bona nit',
      withName: '{{greeting}}, {{name}}',
    },
    todaysBrief: "Resum d'avui",
    openMenu: 'Obre el menú',
    jumpToToday: 'Ves a avui',
    previousWeek: 'Setmana anterior',
    nextWeek: 'Setmana següent',
    regenerateBrief: 'Torna a generar el resum',
    inboxSection: 'Safata',
    needsResponse: 'Necessita resposta',
    followUp: 'Pendent de seguiment',
    needsResponseA11y_one: 'Necessita resposta, {{count}} correu',
    needsResponseA11y_other: 'Necessita resposta, {{count}} correus',
    followUpA11y_one: 'Pendent de seguiment, {{count}} correu',
    followUpA11y_other: 'Pendent de seguiment, {{count}} correus',
    days: {
      sun: 'DG',
      mon: 'DL',
      tue: 'DT',
      wed: 'DC',
      thu: 'DJ',
      fri: 'DV',
      sat: 'DS',
    },
    stats: {
      unread: '{{count}} sense llegir',
      starred: '{{count}} destacats',
      attachments: '{{count}}',
    },
    brief: {
      analyzing: "L'Alia està analitzant la safata…",
      unavailable: "No s'ha pogut generar el resum ara mateix.",
      empty: 'Encara no hi ha correus per resumir.',
      writing: 'Escrivint el teu resum…',
      preparing: 'Preparant el teu resum…',
      failed: "No s'ha pogut escriure el resum d'avui.",
      nothingNew: 'Res de nou avui.',
      tapRetry: 'Toca per tornar-ho a provar.',
    },
    feedEmpty: {
      title: 'Tot al dia',
      subtitle: 'No hi ha res nou a la safata.',
    },
    signedOut: {
      subtitle:
        'Inicia la sessió per veure el resum diari, els correus que necessiten resposta i els seguiments pendents.',
    },
  },


  inbox: {
    title: 'Safata',
    starredTitle: 'Destacats',
    searchInMailbox: 'Cerca a {{mailbox}}',
    emptyTitle: 'No hi ha res aquí',
    emptyAllCaught: 'Estàs al dia.',
    emptySignIn: 'Inicia la sessió per accedir al correu.',
    pagination: '{{from}}–{{to}} de {{total}}',
    remind: 'Recorda',
    bundled: 'Agrupats',
    flat: 'Llista',
    composeFab: 'Redacta un correu nou',
    composeFabLabel: 'Redacta',
    askAlia: "Pregunta a l'Alia",
    askAliaHint:
      "Obre l'assistent d'IA Alia per fer preguntes sobre la safata",
    sections: {
      reminders: 'Recordatoris',
      pinned: 'Fixats',
      today: 'Avui',
      yesterday: 'Ahir',
      thisWeek: 'Aquesta setmana',
      thisMonth: 'Aquest mes',
      earlier: 'Anteriors',
    },
    aliaSuggestions: {
      unread: {
        label: 'Correus sense llegir',
        prompt: 'Quins correus necessiten la meva atenció?',
      },
      todaysSummary: {
        label: "Resum d'avui",
        prompt: "Resumeix els correus d'avui",
      },
      withAttachments: {
        label: 'Amb adjunts',
        prompt: 'Cerca correus amb adjunts',
      },
    },
    aliaClientContext:
      'User is in the Inbox app viewing their email. Use oxy_inbox tools to access their emails.',
    toast: {
      archiveUnavailable: 'La carpeta Arxiu no està disponible.',
      trashUnavailable: 'La carpeta Paperera no està disponible.',
      offlineSync_one: "S'ha sincronitzat {{count}} acció sense connexió.",
      offlineSync_other: "S'han sincronitzat {{count}} accions sense connexió.",
      newVersionAvailable: 'Hi ha una versió nova — recarrega per actualitzar.',
      newEmail: 'Nou correu de {{sender}}',
    },
  },

  message: {
    detail: {
      noSubject: '(sense assumpte)',
      emptyMessage: '(missatge buit)',
      messagesInConversation_one: '{{count}} missatge en aquesta conversa',
      messagesInConversation_other: '{{count}} missatges en aquesta conversa',
      toRecipients: 'a {{recipients}}',
      ccRecipients: ', cc: {{recipients}}',
    },
    actions: {
      archive: 'Arxiva',
      delete: 'Elimina',
      markUnread: 'Marca com a no llegit',
      markRead: 'Marca com a llegit',
      reply: 'Respon',
      replyAll: 'Respon a tots',
      forward: 'Reenvia',
      pin: 'Fixa el missatge',
      unpin: 'Desfixa el missatge',
      star: 'Destaca el missatge',
      unstar: 'Treu el destacat',
      snooze: 'Posposa',
      print: 'Imprimeix',
      more: 'Més accions',
      moreInline: 'Més',
      reportSpam: 'Marca com a brossa',
      label: 'Etiqueta',
      downloadEml: 'Baixa .eml',
      messageActions: 'Accions del missatge',
    },
    labelPicker: {
      title: 'Etiquetes',
      empty: 'Encara no hi ha etiquetes',
    },
    toast: {
      attachmentFailed: "No s'ha pogut baixar l'adjunt.",
      fileSystemUnavailable:
        "El sistema d'arxius no està disponible en aquest dispositiu.",
      sharingUnavailable: 'Compartir no està disponible en aquest dispositiu.',
      printFailed: "No s'ha pogut imprimir el correu.",
      downloadFailed: "No s'ha pogut baixar el correu.",
      saveEmailDialog: 'Desa el correu',
    },
  },

  empty: {
    selectConversation: 'Selecciona una conversa',
    nothingHere: 'No hi ha res aquí',
  },

  notFound: {
    title:
      "No s'ha trobat aquesta conversa. Pot ser que s'hagi mogut, arxivat o eliminat.",
    back: 'Torna a la safata',
  },

  search: {
    placeholder: 'Cerca al correu',
    clear: 'Neteja la cerca',
    openMenu: 'Obre el menú',
    goBack: 'Enrere',
    filters: {
      from: 'De',
      fromValue: 'De: {{value}}',
      hasAttachment: 'Amb adjunt',
    },
    nl: {
      understanding: 'Entenent la cerca…',
      searching: 'Cercant: {{filters}}',
      allEmails: 'tots els correus',
      fromValue: 'de {{value}}',
      toValue: 'per a {{value}}',
      subjectContains: "l'assumpte conté \"{{value}}\"",
      withAttachments: 'amb adjunts',
      starred: 'destacats',
      unread: 'sense llegir',
      read: 'llegits',
    },
    empty: {
      noResults: "No s'han trobat resultats",
      idle: 'Cerca als teus correus',
    },
    results_one: '{{count}} resultat',
    results_other: '{{count}} resultats',
  },

  compose: {
    titleCompose: 'Redacta',
    titleReply: 'Respon',
    titleForward: 'Reenvia',
    headTitleCompose: 'Redacta · Inbox · Oxy',
    headTitleWithSubject: '{{subject}} · Redacta · Oxy',
    placeholders: {
      to: 'Destinataris',
      subject: 'Assumpte',
      body: 'Redacta el correu',
    },
    fields: {
      from: 'De',
      to: 'Per a',
      cc: 'Cc',
      bcc: 'Cco',
    },
    actions: {
      send: 'Envia',
      sendNow: 'Envia ara',
      moreSendOptions: "Més opcions d'enviament",
      sendOptions: "Opcions d'enviament",
      scheduleSend: "Programa l'enviament",
      saveDraft: "Desa l'esborrany",
      discard: 'Descarta',
    },
    saveDraftPrompt: {
      title: "Desar l'esborrany?",
      description: 'Vols desar aquest missatge com a esborrany?',
    },
    dropZone: 'Deixa anar els fitxers per adjuntar-los',
    toast: {
      addRecipient: 'Afegeix com a mínim un destinatari.',
      invalidEmail: 'Introdueix una adreça de correu vàlida.',
      sendFailed: "No s'ha pogut enviar el correu. Torna-ho a provar.",
      scheduleFailed: "No s'ha pogut programar l'enviament. Torna-ho a provar.",
      scheduled: 'Correu programat per al {{time}}',
      uploadFailed: "No s'ha pogut pujar l'adjunt.",
      signatureFailed: "No s'ha pogut carregar la signatura.",
    },
  },

  inlineReply: {
    placeholder: 'Escriu la teva resposta…',
    forwardTo: 'Reenvia a:',
    replyAllTo: 'Respon a tots a:',
    replyTo: 'Respon a:',
    cc: 'Cc:',
    bcc: 'Cco:',
    ccBccToggle: 'Cc/Cco',
    addRecipients: 'Afegeix destinataris',
    send: 'Envia',
    quotedPrefix: 'El {{date}}, {{author}} va escriure:',
    forwardHeader:
      '\n\n---------- Missatge reenviat ----------\nDe: {{from}}\nData: {{date}}\nAssumpte: {{subject}}\nPer a: {{to}}\n\n',
  },

  smartReply: {
    quickReplies: 'Respostes ràpides',
  },

  ai: {
    toolbar: {
      draft: 'Redacta',
      polish: 'Polir',
      shorter: 'Més curt',
      longer: 'Més llarg',
      tone: 'To',
      suggestSubject: 'Suggereix un assumpte',
    },
    draftModal: {
      title: 'Redacta amb IA',
      subtitle: "Descriu què vols dir i l'Alia ho redactarà per a tu.",
      placeholder:
        'p. ex., Rebutja la reunió educadament i suggereix la setmana vinent',
      toneLabel: 'To:',
      cancel: 'Cancel·la',
      draft: 'Redacta',
    },
    toneMenu: {
      title: 'Canvia el to a…',
    },
    tones: {
      professional: 'Professional',
      casual: 'Informal',
      friendly: 'Proper',
      formal: 'Formal',
    },
  },

  threadSummary: {
    title: 'Resum de la conversa',
    messages_one: '{{count}} missatge',
    messages_other: '{{count}} missatges',
    keyPoints: 'Punts clau',
    actionItems: 'Accions pendents',
    due: 'Per a: {{date}}',
    unavailable: "No s'ha pogut resumir aquesta conversa ara mateix.",
  },

  staleThread: {
    consider: 'Considera enviar una resposta ràpida',
    reply: 'Respon',
  },

  followUpReminder: {
    pastDue: 'Compromís vençut',
    upcoming: 'Compromís proper',
    description: 'Vas dir «{{text}}» a {{recipient}}',
    deadline: {
      dueToday: 'Venç avui',
      overdueOneDay: 'Vençut fa 1 dia',
      overdueDays: 'Vençut fa {{days}} dies',
      dueTomorrow: 'Venç demà',
      dueInDays: "Venç d'aquí a {{days}} dies",
    },
    fallbackName: 'algú',
    view: 'Mostra',
    done: 'Fet',
  },

  reminder: {
    create: {
      title: 'Crea un recordatori',
      placeholder: 'De què vols que et recordi?',
      whenLabel: 'Quan?',
      submit: 'Crea el recordatori',
      presets: {
        laterToday: 'Més tard avui',
        tomorrowMorning: 'Demà al matí',
        thisWeekend: 'Aquest cap de setmana',
        nextWeek: 'La setmana vinent',
      },
    },
    time: {
      overdue: 'Vençut · {{date}}, {{time}}',
      today: 'Avui, {{time}}',
      tomorrow: 'Demà, {{time}}',
      onDate: '{{date}}, {{time}}',
    },
  },

  snooze: {
    title: 'Posposa fins a…',
    options: {
      laterToday: 'Més tard avui',
      tomorrow: 'Demà',
      thisWeekend: 'Aquest cap de setmana',
      nextWeek: 'La setmana vinent',
    },
    time: {
      today: 'Avui, {{time}}',
      tomorrow: 'Demà, {{time}}',
      onDate: '{{date}}, {{time}}',
    },
  },

  schedule: {
    title: "Programa l'enviament",
    options: {
      laterToday: 'Més tard avui',
      tomorrowMorning: 'Demà al matí',
      tomorrowAfternoon: 'Demà a la tarda',
      mondayMorning: 'Dilluns al matí',
    },
  },

  template: {
    insert: 'Insereix una plantilla',
  },

  selection: {
    archive: 'Arxiva',
    delete: 'Elimina',
    star: 'Destaca',
    markRead: 'Marca com a llegit',
  },

  subscriptions: {
    title: 'Subscripcions',
    subtitle:
      'Quan et dones de baixa, pot trigar uns dies a deixar de rebre missatges',
    empty: {
      title: "No s'han trobat subscripcions",
      subtitle:
        "Aquí apareixeran els remitents que t'escriuen amb freqüència.",
    },
    unsubscribe: "Dona't de baixa",
    block: 'Bloqueja',
    frequency: {
      twentyPlus: 'Més de 20 correus recents',
      tenToTwenty: '10-20 correus recents',
      count_one: '{{count}} correu recent',
      count_other: '{{count}} correus recents',
    },
  },

  contacts: {
    searchPlaceholder: 'Cerca contactes…',
    addContact: 'Afegeix un contacte',
    cancel: 'Cancel·la',
    saveContact: 'Desa el contacte',
    save: 'Desa',
    edit: {
      cancel: 'Cancel·la',
    },
    delete: {
      title: 'Vols eliminar aquest contacte?',
      description: 'Aquesta acció no es pot desfer.',
      cta: 'Elimina',
    },
    starredFilter: 'Destacats',
    autoCollected: 'Recollit automàticament',
    empty: {
      noMatch: 'Cap contacte coincideix amb la cerca.',
      none: 'Encara no tens contactes.',
    },
    toast: {
      nameEmailRequired: 'El nom i el correu són obligatoris.',
      created: 'Contacte creat.',
      updated: 'Contacte actualitzat.',
      deleted: 'Contacte eliminat.',
    },
    form: {
      name: 'Nom *',
      email: 'Correu *',
      company: 'Empresa',
      notes: 'Notes',
    },
  },

  shortcuts: {
    title: 'Dreceres de teclat',
    close: 'Tanca',
    actions: {
      compose: 'Redacta',
      reply: 'Respon',
      replyAll: 'Respon a tots',
      forward: 'Reenvia',
      archive: 'Arxiva',
      delete: 'Elimina',
      nextMessage: 'Missatge següent',
      previousMessage: 'Missatge anterior',
      starUnstar: 'Destaca / treu el destacat',
      markUnread: 'Marca com a no llegit',
      search: 'Cerca',
      help: 'Aquesta ajuda',
    },
  },

  cards: {
    purchase: {
      header: 'Compra',
      order: 'Comanda núm.',
      moreItems: '+{{count}} més',
      summary: 'Detalls de la compra',
    },
    bill: {
      header: 'Factura',
      account: 'Compte',
      due: 'Venç el {{date}}',
      overdue: 'Vençuda · {{date}}',
      summary: 'Detalls de la factura',
    },
    trip: {
      header: 'Viatge',
      confirmation: 'Confirmació',
      summary: 'Detalls del viatge',
    },
    package: {
      header: 'Paquet',
      tracking: 'Seguiment',
      estimated: 'Estimat {{date}}',
      summary: 'Detalls del paquet',
    },
    event: {
      header: 'Esdeveniment',
      addToCalendar: 'Afegeix al calendari',
      googleCalendar: 'Google Calendar',
      addToCalendarDialog: 'Afegeix al calendari',
      defaultTitle: 'Esdeveniment',
      summary: "Detalls de l'esdeveniment",
    },
  },

  importance: {
    urgent: 'Urgent',
    action: 'Requereix acció',
    important: 'Important',
    fyi: 'Per a la teva informació',
  },

  attachment: {
    sizeBytes: '{{value}} B',
    sizeKb: '{{value}} KB',
    sizeMb: '{{value}} MB',
  },

  settings: {
    head: 'Configuració · Inbox · Oxy',
    title: 'Configuració',
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
      title: 'Inicia la sessió per accedir a la safata',
      subtitle:
        'Connecta la teva identitat Oxy per sincronitzar missatges, etiquetes i preferències a tots els dispositius.',
      footer:
        'En iniciar la sessió, acceptes els nostres Termes i reconeixes la nostra Política de privacitat.',
    },
  },
};

export default ca;
