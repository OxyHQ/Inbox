import type { LocaleDict } from '../types';

/**
 * French (fr-FR) translation dictionary for the Inbox app.
 *
 * Tone: informal "tu" — matches the rest of the Oxy ecosystem.
 * Punctuation and capitalization mirror the source EN strings.
 */
const fr: LocaleDict = {
  common: {
    cancel: 'Annuler',
    save: 'Enregistrer',
    ok: 'OK',
    continue: 'Continuer',
    back: 'Retour',
    next: 'Suivant',
    done: 'Terminé',
    close: 'Fermer',
    loading: 'Chargement…',
    error: 'Erreur',
    success: 'Terminé',
    retry: 'Réessayer',
    delete: 'Supprimer',
    edit: 'Modifier',
    remove: 'Retirer',
    confirm: 'Confirmer',
    submit: 'Envoyer',
    search: 'Rechercher',
    yes: 'Oui',
    no: 'Non',
    or: 'ou',
    and: 'et',
    open: 'Ouvrir',
    discard: 'Abandonner',
    of: 'sur',
    more: 'Plus',
    less: 'Moins',
  },

  app: {
    name: 'Inbox',
    title: 'Inbox par Oxy',
    titleSuffix: '· Oxy',
  },

  tabs: {
    inbox: 'Boîte',
    search: 'Recherche',
    settings: 'Paramètres',
  },

  drawer: {
    starred: 'Favoris',
    snoozed: 'Reportés',
    subscriptions: 'Abonnements',
    labels: 'Libellés',
    more: 'Plus',
    less: 'Moins',
    notSignedIn: 'Non connecté',
    accountSwitcher: 'Sélecteur de compte',
    addAnotherAccount: 'Ajouter un autre compte',
    signOut: 'Se déconnecter',
    switchAccount: 'Changer de compte, connecté en tant que {{name}}',
    switchingAccount: 'Changement de compte…',
    expandSidebar: 'Développer la barre latérale',
    collapseSidebar: 'Réduire la barre latérale',
    signedOut: {
      title: 'Connecte-toi pour gérer ton courrier',
      subtitle: 'Accède à tes boîtes, à tes libellés et rédige de nouveaux messages.',
    },
    mailboxes: {
      Inbox: 'Boîte de réception',
      Sent: 'Envoyés',
      Drafts: 'Brouillons',
      Trash: 'Corbeille',
      Spam: 'Indésirables',
      Archive: 'Archives',
      Starred: 'Favoris',
      Snoozed: 'Reportés',
    },
    mailboxA11y: '{{name}}, {{count}} non lus',
  },

  home: {
    greeting: {
      morning: 'Bonjour',
      afternoon: 'Bon après-midi',
      evening: 'Bonsoir',
      withName: '{{greeting}}, {{name}}',
    },
    todaysBrief: "Résumé d'aujourd'hui",
    openMenu: 'Ouvrir le menu',
    jumpToToday: "Aller à aujourd'hui",
    previousWeek: 'Semaine précédente',
    nextWeek: 'Semaine suivante',
    regenerateBrief: 'Régénérer le résumé',
    inboxSection: 'Boîte',
    needsResponse: 'Réponse requise',
    followUp: 'À relancer',
    needsResponseA11y_one: 'Réponse requise, {{count}} courriel',
    needsResponseA11y_other: 'Réponse requise, {{count}} courriels',
    followUpA11y_one: 'À relancer, {{count}} courriel',
    followUpA11y_other: 'À relancer, {{count}} courriels',
    days: {
      sun: 'DIM',
      mon: 'LUN',
      tue: 'MAR',
      wed: 'MER',
      thu: 'JEU',
      fri: 'VEN',
      sat: 'SAM',
    },
    stats: {
      unread: '{{count}} non lus',
      starred: '{{count}} favoris',
      attachments: '{{count}}',
    },
    brief: {
      analyzing: 'Alia analyse ta boîte…',
      unavailable: 'Impossible de générer le résumé pour le moment.',
      empty: 'Aucun courriel à résumer pour le moment.',
      writing: 'Rédaction de ton résumé…',
      preparing: 'Préparation de ton résumé…',
      failed: "Impossible d'écrire le résumé d'aujourd'hui.",
      nothingNew: "Rien de nouveau aujourd'hui.",
      tapRetry: 'Appuie pour réessayer.',
    },
    feedEmpty: {
      title: 'Tout est à jour',
      subtitle: 'Rien de nouveau dans ta boîte.',
    },
    signedOut: {
      subtitle:
        'Connecte-toi pour voir ton résumé quotidien, les courriels qui attendent une réponse et les relances en cours.',
    },
  },


  inbox: {
    title: 'Boîte',
    starredTitle: 'Favoris',
    searchInMailbox: 'Rechercher dans {{mailbox}}',
    emptyTitle: 'Rien ici',
    emptyAllCaught: 'Tout est à jour.',
    emptySignIn: 'Connecte-toi pour accéder à ton courrier.',
    pagination: '{{from}}–{{to}} sur {{total}}',
    remind: 'Rappeler',
    bundled: 'Groupés',
    flat: 'Liste',
    composeFab: 'Rédiger un nouveau courriel',
    composeFabLabel: 'Rédiger',
    askAlia: 'Demander à Alia',
    askAliaHint: "Ouvre l'assistant IA Alia pour poser des questions sur ta boîte",
    sections: {
      reminders: 'Rappels',
      pinned: 'Épinglés',
      today: "Aujourd'hui",
      yesterday: 'Hier',
      thisWeek: 'Cette semaine',
      thisMonth: 'Ce mois-ci',
      earlier: 'Plus anciens',
    },
    aliaSuggestions: {
      unread: {
        label: 'Courriels non lus',
        prompt: 'Quels courriels nécessitent mon attention ?',
      },
      todaysSummary: {
        label: "Résumé d'aujourd'hui",
        prompt: "Résume mes courriels d'aujourd'hui",
      },
      withAttachments: {
        label: 'Avec pièces jointes',
        prompt: 'Trouve les courriels avec pièces jointes',
      },
    },
    aliaClientContext:
      'User is in the Inbox app viewing their email. Use oxy_inbox tools to access their emails.',
    toast: {
      archiveUnavailable: 'Dossier Archives indisponible.',
      trashUnavailable: 'Dossier Corbeille indisponible.',
      offlineSync_one: '{{count}} action hors ligne synchronisée.',
      offlineSync_other: '{{count}} actions hors ligne synchronisées.',
      newVersionAvailable: 'Nouvelle version disponible — actualise pour mettre à jour.',
      newEmail: 'Nouvel e-mail de {{sender}}',
    },
  },

  message: {
    detail: {
      noSubject: '(sans objet)',
      emptyMessage: '(message vide)',
      messagesInConversation_one: '{{count}} message dans cette conversation',
      messagesInConversation_other: '{{count}} messages dans cette conversation',
      toRecipients: 'à {{recipients}}',
      ccRecipients: ', cc : {{recipients}}',
    },
    actions: {
      archive: 'Archiver',
      delete: 'Supprimer',
      markUnread: 'Marquer comme non lu',
      markRead: 'Marquer comme lu',
      reply: 'Répondre',
      replyAll: 'Répondre à tous',
      forward: 'Transférer',
      pin: 'Épingler le message',
      unpin: 'Désépingler le message',
      star: 'Mettre en favori',
      unstar: 'Retirer des favoris',
      snooze: 'Reporter',
      print: 'Imprimer',
      more: "Plus d'actions",
      moreInline: 'Plus',
      reportSpam: 'Signaler comme spam',
      label: 'Libellé',
      downloadEml: 'Télécharger .eml',
      messageActions: 'Actions du message',
    },
    labelPicker: {
      title: 'Libellés',
      empty: 'Pas encore de libellés',
    },
    toast: {
      attachmentFailed: 'Échec du téléchargement de la pièce jointe.',
      fileSystemUnavailable: 'Système de fichiers indisponible sur cet appareil.',
      sharingUnavailable: 'Partage indisponible sur cet appareil.',
      printFailed: "Échec de l'impression.",
      downloadFailed: 'Échec du téléchargement.',
      saveEmailDialog: 'Enregistrer le courriel',
    },
  },

  empty: {
    selectConversation: 'Sélectionne une conversation',
    nothingHere: 'Rien ici',
  },

  notFound: {
    title:
      'Cette conversation est introuvable. Elle a peut-être été déplacée, archivée ou supprimée.',
    back: 'Retour à la boîte',
  },

  search: {
    placeholder: 'Rechercher dans le courrier',
    clear: 'Effacer la recherche',
    openMenu: 'Ouvrir le menu',
    goBack: 'Retour',
    filters: {
      from: 'De',
      fromValue: 'De : {{value}}',
      hasAttachment: 'Avec pièce jointe',
    },
    nl: {
      understanding: 'Compréhension de la recherche…',
      searching: 'Recherche : {{filters}}',
      allEmails: 'tous les courriels',
      fromValue: 'de {{value}}',
      toValue: 'à {{value}}',
      subjectContains: 'objet contient « {{value}} »',
      withAttachments: 'avec pièces jointes',
      starred: 'favoris',
      unread: 'non lus',
      read: 'lus',
    },
    empty: {
      noResults: 'Aucun résultat',
      idle: 'Recherche dans tes courriels',
    },
    results_one: '{{count}} résultat',
    results_other: '{{count}} résultats',
  },

  compose: {
    titleCompose: 'Rédiger',
    titleReply: 'Répondre',
    titleForward: 'Transférer',
    headTitleCompose: 'Rédiger · Inbox · Oxy',
    headTitleWithSubject: '{{subject}} · Rédiger · Oxy',
    placeholders: {
      to: 'Destinataires',
      subject: 'Objet',
      body: 'Rédige le courriel',
    },
    fields: {
      from: 'De',
      to: 'À',
      cc: 'Cc',
      bcc: 'Cci',
    },
    actions: {
      send: 'Envoyer',
      sendNow: 'Envoyer maintenant',
      moreSendOptions: "Plus d'options d'envoi",
      sendOptions: "Options d'envoi",
      scheduleSend: "Planifier l'envoi",
      saveDraft: 'Enregistrer le brouillon',
      discard: 'Abandonner',
    },
    saveDraftPrompt: {
      title: 'Enregistrer le brouillon ?',
      description: 'Veux-tu enregistrer ce message comme brouillon ?',
    },
    dropZone: 'Dépose les fichiers à joindre',
    toast: {
      addRecipient: 'Ajoute au moins un destinataire.',
      invalidEmail: 'Saisis une adresse électronique valide.',
      sendFailed: "Impossible d'envoyer le courriel. Réessaie.",
      scheduleFailed: 'Impossible de planifier le courriel. Réessaie.',
      scheduled: 'Courriel planifié pour le {{time}}',
      uploadFailed: 'Échec du téléversement de la pièce jointe.',
      signatureFailed: 'Échec du chargement de la signature.',
    },
  },

  inlineReply: {
    placeholder: 'Écris ta réponse…',
    forwardTo: 'Transférer à :',
    replyAllTo: 'Répondre à tous à :',
    replyTo: 'Répondre à :',
    cc: 'Cc :',
    bcc: 'Cci :',
    ccBccToggle: 'Cc/Cci',
    addRecipients: 'Ajouter des destinataires',
    send: 'Envoyer',
    quotedPrefix: 'Le {{date}}, {{author}} a écrit :',
    forwardHeader:
      '\n\n---------- Message transféré ----------\nDe : {{from}}\nDate : {{date}}\nObjet : {{subject}}\nÀ : {{to}}\n\n',
  },

  smartReply: {
    quickReplies: 'Réponses rapides',
  },

  ai: {
    toolbar: {
      draft: 'Rédiger',
      polish: 'Affiner',
      shorter: 'Plus court',
      longer: 'Plus long',
      tone: 'Ton',
      suggestSubject: 'Suggérer un objet',
    },
    draftModal: {
      title: 'Rédiger avec IA',
      subtitle: 'Décris ce que tu veux dire et Alia le rédigera pour toi.',
      placeholder: 'p. ex., Décliner poliment la réunion et proposer la semaine prochaine',
      toneLabel: 'Ton :',
      cancel: 'Annuler',
      draft: 'Rédiger',
    },
    toneMenu: {
      title: 'Changer le ton vers…',
    },
    tones: {
      professional: 'Professionnel',
      casual: 'Décontracté',
      friendly: 'Amical',
      formal: 'Formel',
    },
  },

  threadSummary: {
    title: 'Résumé de la conversation',
    messages_one: '{{count}} message',
    messages_other: '{{count}} messages',
    keyPoints: 'Points clés',
    actionItems: 'Actions à faire',
    due: 'Échéance : {{date}}',
    unavailable: 'Impossible de résumer cette conversation pour le moment.',
  },

  staleThread: {
    consider: 'Envisage une réponse rapide',
    reply: 'Répondre',
  },

  followUpReminder: {
    pastDue: 'Engagement en retard',
    upcoming: 'Engagement à venir',
    description: "Tu as dit « {{text}} » à {{recipient}}",
    deadline: {
      dueToday: "Échéance aujourd'hui",
      overdueOneDay: 'En retard de 1 jour',
      overdueDays: 'En retard de {{days}} jours',
      dueTomorrow: 'Échéance demain',
      dueInDays: 'Échéance dans {{days}} jours',
    },
    fallbackName: "quelqu'un",
    view: 'Voir',
    done: 'Terminé',
  },

  reminder: {
    create: {
      title: 'Créer un rappel',
      placeholder: 'De quoi veux-tu te souvenir ?',
      whenLabel: 'Quand ?',
      submit: 'Créer le rappel',
      presets: {
        laterToday: 'Plus tard aujourd\'hui',
        tomorrowMorning: 'Demain matin',
        thisWeekend: 'Ce week-end',
        nextWeek: 'La semaine prochaine',
      },
    },
    time: {
      overdue: 'En retard · {{date}}, {{time}}',
      today: "Aujourd'hui, {{time}}",
      tomorrow: 'Demain, {{time}}',
      onDate: '{{date}}, {{time}}',
    },
  },

  snooze: {
    title: 'Reporter à…',
    options: {
      laterToday: 'Plus tard aujourd\'hui',
      tomorrow: 'Demain',
      thisWeekend: 'Ce week-end',
      nextWeek: 'La semaine prochaine',
    },
    time: {
      today: "Aujourd'hui, {{time}}",
      tomorrow: 'Demain, {{time}}',
      onDate: '{{date}}, {{time}}',
    },
  },

  schedule: {
    title: "Planifier l'envoi",
    options: {
      laterToday: 'Plus tard aujourd\'hui',
      tomorrowMorning: 'Demain matin',
      tomorrowAfternoon: 'Demain après-midi',
      mondayMorning: 'Lundi matin',
    },
  },

  template: {
    insert: 'Insérer un modèle',
  },

  selection: {
    archive: 'Archiver',
    delete: 'Supprimer',
    star: 'Mettre en favori',
    markRead: 'Marquer comme lu',
  },

  subscriptions: {
    title: 'Abonnements',
    subtitle:
      'Après désabonnement, il peut falloir quelques jours avant de cesser de recevoir des messages',
    empty: {
      title: 'Aucun abonnement trouvé',
      subtitle: "Les expéditeurs qui t'écrivent souvent apparaîtront ici.",
    },
    unsubscribe: 'Se désabonner',
    block: 'Bloquer',
    frequency: {
      twentyPlus: '20+ courriels récents',
      tenToTwenty: '10-20 courriels récents',
      count_one: '{{count}} courriel récent',
      count_other: '{{count}} courriels récents',
    },
  },

  contacts: {
    searchPlaceholder: 'Rechercher des contacts…',
    addContact: 'Ajouter un contact',
    cancel: 'Annuler',
    saveContact: 'Enregistrer le contact',
    save: 'Enregistrer',
    edit: {
      cancel: 'Annuler',
    },
    delete: {
      title: 'Supprimer ce contact ?',
      description: 'Cette action est irréversible.',
      cta: 'Supprimer',
    },
    starredFilter: 'Favoris',
    autoCollected: 'Collecté automatiquement',
    empty: {
      noMatch: 'Aucun contact ne correspond à ta recherche.',
      none: 'Pas encore de contacts.',
    },
    toast: {
      nameEmailRequired: 'Nom et courriel sont requis.',
      created: 'Contact créé.',
      updated: 'Contact mis à jour.',
      deleted: 'Contact supprimé.',
    },
    form: {
      name: 'Nom *',
      email: 'Courriel *',
      company: 'Entreprise',
      notes: 'Notes',
    },
  },

  shortcuts: {
    title: 'Raccourcis clavier',
    close: 'Fermer',
    actions: {
      compose: 'Rédiger',
      reply: 'Répondre',
      replyAll: 'Répondre à tous',
      forward: 'Transférer',
      archive: 'Archiver',
      delete: 'Supprimer',
      nextMessage: 'Message suivant',
      previousMessage: 'Message précédent',
      starUnstar: 'Favori / retirer favori',
      markUnread: 'Marquer comme non lu',
      search: 'Rechercher',
      help: 'Cette aide',
    },
  },

  cards: {
    purchase: {
      header: 'Achat',
      order: 'Commande n°',
      moreItems: '+{{count}} de plus',
      summary: "Détails de l'achat",
    },
    bill: {
      header: 'Facture',
      account: 'Compte',
      due: 'Échéance {{date}}',
      overdue: 'En retard · {{date}}',
      summary: 'Détails de la facture',
    },
    trip: {
      header: 'Voyage',
      confirmation: 'Confirmation',
      summary: 'Détails du voyage',
    },
    package: {
      header: 'Colis',
      tracking: 'Suivi',
      estimated: 'Est. {{date}}',
      summary: 'Détails du colis',
    },
    event: {
      header: 'Événement',
      addToCalendar: 'Ajouter au calendrier',
      googleCalendar: 'Google Agenda',
      addToCalendarDialog: 'Ajouter au calendrier',
      defaultTitle: 'Événement',
      summary: "Détails de l'événement",
    },
  },

  importance: {
    urgent: 'Urgent',
    action: 'Action requise',
    important: 'Important',
    fyi: 'Pour info',
  },

  attachment: {
    sizeBytes: '{{value}} o',
    sizeKb: '{{value}} Ko',
    sizeMb: '{{value}} Mo',
  },

  settings: {
    head: 'Paramètres · Inbox · Oxy',
    title: 'Paramètres',
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
      title: 'Connecte-toi pour accéder à ta boîte',
      subtitle:
        'Connecte ton identité Oxy pour synchroniser messages, libellés et préférences sur tous tes appareils.',
      footer:
        "En te connectant, tu acceptes nos Conditions et reconnais notre Politique de confidentialité.",
    },
  },
};

export default fr;
