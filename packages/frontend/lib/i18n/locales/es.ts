import type { LocaleDict } from '../types';

/**
 * Spanish (es-ES) translation dictionary for the Inbox app.
 *
 * Tone: informal "tú" — matches the rest of the Oxy ecosystem (accounts app,
 * core). Punctuation and capitalization mirror the source EN strings.
 */
const es: LocaleDict = {
  common: {
    cancel: 'Cancelar',
    save: 'Guardar',
    ok: 'Aceptar',
    continue: 'Continuar',
    back: 'Atrás',
    next: 'Siguiente',
    done: 'Listo',
    close: 'Cerrar',
    loading: 'Cargando…',
    error: 'Error',
    success: 'Listo',
    retry: 'Reintentar',
    delete: 'Eliminar',
    edit: 'Editar',
    remove: 'Quitar',
    confirm: 'Confirmar',
    submit: 'Enviar',
    search: 'Buscar',
    yes: 'Sí',
    no: 'No',
    or: 'o',
    and: 'y',
    open: 'Abrir',
    discard: 'Descartar',
    of: 'de',
    more: 'Más',
    less: 'Menos',
  },

  app: {
    name: 'Inbox',
    title: 'Inbox de Oxy',
    titleSuffix: '· Oxy',
  },

  tabs: {
    inbox: 'Bandeja',
    search: 'Buscar',
    settings: 'Ajustes',
  },

  drawer: {
    starred: 'Destacados',
    snoozed: 'Pospuestos',
    subscriptions: 'Suscripciones',
    labels: 'Etiquetas',
    more: 'Más',
    less: 'Menos',
    notSignedIn: 'Sesión no iniciada',
    accountSwitcher: 'Selector de cuenta',
    addAnotherAccount: 'Añadir otra cuenta',
    signOut: 'Cerrar sesión',
    switchAccount: 'Cambiar de cuenta, sesión iniciada como {{name}}',
    switchingAccount: 'Cambiando de cuenta…',
    expandSidebar: 'Expandir barra lateral',
    collapseSidebar: 'Contraer barra lateral',
    signedOut: {
      title: 'Inicia sesión para gestionar tu correo',
      subtitle:
        'Accede a tus carpetas, etiquetas y crea mensajes nuevos.',
    },
    mailboxes: {
      Inbox: 'Bandeja de entrada',
      Sent: 'Enviados',
      Drafts: 'Borradores',
      Trash: 'Papelera',
      Spam: 'Spam',
      Archive: 'Archivo',
      Starred: 'Destacados',
      Snoozed: 'Pospuestos',
    },
    mailboxA11y: '{{name}}, {{count}} sin leer',
  },

  home: {
    greeting: {
      morning: 'Buenos días',
      afternoon: 'Buenas tardes',
      evening: 'Buenas noches',
      withName: '{{greeting}}, {{name}}',
    },
    todaysBrief: 'Resumen de hoy',
    openMenu: 'Abrir menú',
    jumpToToday: 'Ir a hoy',
    previousWeek: 'Semana anterior',
    nextWeek: 'Semana siguiente',
    regenerateBrief: 'Regenerar resumen',
    inboxSection: 'Bandeja',
    needsResponse: 'Necesita respuesta',
    followUp: 'Pendiente de seguimiento',
    needsResponseA11y_one: 'Necesita respuesta, {{count}} correo',
    needsResponseA11y_other: 'Necesita respuesta, {{count}} correos',
    followUpA11y_one: 'Pendiente de seguimiento, {{count}} correo',
    followUpA11y_other: 'Pendiente de seguimiento, {{count}} correos',
    days: {
      sun: 'DOM',
      mon: 'LUN',
      tue: 'MAR',
      wed: 'MIÉ',
      thu: 'JUE',
      fri: 'VIE',
      sat: 'SÁB',
    },
    stats: {
      unread: '{{count}} sin leer',
      starred: '{{count}} destacados',
      attachments: '{{count}}',
    },
    brief: {
      analyzing: 'Alia está analizando tu bandeja…',
      unavailable: 'No se pudo generar el resumen ahora.',
      empty: 'Aún no hay correos para resumir.',
      writing: 'Escribiendo tu resumen…',
      preparing: 'Preparando tu resumen…',
      failed: 'No se pudo escribir el resumen de hoy.',
      nothingNew: 'Nada nuevo hoy.',
      tapRetry: 'Toca para reintentar.',
    },
    feedEmpty: {
      title: 'Todo al día',
      subtitle: 'No hay nada nuevo en tu bandeja.',
    },
    signedOut: {
      subtitle:
        'Inicia sesión para ver tu resumen diario, los correos que necesitan respuesta y los seguimientos pendientes.',
    },
  },


  inbox: {
    title: 'Bandeja',
    starredTitle: 'Destacados',
    searchInMailbox: 'Buscar en {{mailbox}}',
    emptyTitle: 'No hay nada aquí',
    emptyAllCaught: 'Estás al día.',
    emptySignIn: 'Inicia sesión para acceder a tu correo.',
    pagination: '{{from}}–{{to}} de {{total}}',
    remind: 'Recordar',
    bundled: 'Agrupados',
    flat: 'Lista',
    composeFab: 'Redactar correo nuevo',
    composeFabLabel: 'Redactar',
    askAlia: 'Preguntar a Alia',
    askAliaHint:
      'Abre el asistente de IA Alia para hacer preguntas sobre tu bandeja',
    sections: {
      reminders: 'Recordatorios',
      pinned: 'Fijados',
      today: 'Hoy',
      yesterday: 'Ayer',
      thisWeek: 'Esta semana',
      thisMonth: 'Este mes',
      earlier: 'Anteriores',
    },
    aliaSuggestions: {
      unread: {
        label: 'Correos sin leer',
        prompt: '¿Qué correos necesitan mi atención?',
      },
      todaysSummary: {
        label: 'Resumen de hoy',
        prompt: 'Resume mis correos de hoy',
      },
      withAttachments: {
        label: 'Con adjuntos',
        prompt: 'Busca correos con adjuntos',
      },
    },
    aliaClientContext:
      'User is in the Inbox app viewing their email. Use oxy_inbox tools to access their emails.',
    toast: {
      archiveUnavailable: 'La carpeta Archivo no está disponible.',
      trashUnavailable: 'La carpeta Papelera no está disponible.',
      offlineSync_one: 'Sincronizada {{count}} acción sin conexión.',
      offlineSync_other: 'Sincronizadas {{count}} acciones sin conexión.',
      newVersionAvailable: 'Hay una versión nueva — recarga para actualizar.',
      newEmail: 'Nuevo email de {{sender}}',
    },
  },

  message: {
    detail: {
      noSubject: '(sin asunto)',
      emptyMessage: '(mensaje vacío)',
      messagesInConversation_one: '{{count}} mensaje en esta conversación',
      messagesInConversation_other: '{{count}} mensajes en esta conversación',
      toRecipients: 'a {{recipients}}',
      ccRecipients: ', cc: {{recipients}}',
    },
    actions: {
      archive: 'Archivar',
      delete: 'Eliminar',
      markUnread: 'Marcar como no leído',
      markRead: 'Marcar como leído',
      reply: 'Responder',
      replyAll: 'Responder a todos',
      forward: 'Reenviar',
      pin: 'Fijar mensaje',
      unpin: 'Desfijar mensaje',
      star: 'Destacar mensaje',
      unstar: 'Quitar destacado',
      snooze: 'Posponer',
      print: 'Imprimir',
      more: 'Más acciones',
      moreInline: 'Más',
      reportSpam: 'Marcar como spam',
      label: 'Etiqueta',
      downloadEml: 'Descargar .eml',
      messageActions: 'Acciones del mensaje',
    },
    labelPicker: {
      title: 'Etiquetas',
      empty: 'Aún no hay etiquetas',
    },
    toast: {
      attachmentFailed: 'No se pudo descargar el adjunto.',
      fileSystemUnavailable:
        'El sistema de archivos no está disponible en este dispositivo.',
      sharingUnavailable: 'Compartir no está disponible en este dispositivo.',
      printFailed: 'No se pudo imprimir el correo.',
      downloadFailed: 'No se pudo descargar el correo.',
      saveEmailDialog: 'Guardar correo',
    },
  },

  empty: {
    selectConversation: 'Selecciona una conversación',
    nothingHere: 'No hay nada aquí',
  },

  notFound: {
    title:
      'No se ha encontrado esa conversación. Puede que se haya movido, archivado o eliminado.',
    back: 'Volver a la bandeja',
  },

  search: {
    placeholder: 'Buscar correo',
    clear: 'Limpiar búsqueda',
    openMenu: 'Abrir menú',
    goBack: 'Atrás',
    filters: {
      from: 'De',
      fromValue: 'De: {{value}}',
      hasAttachment: 'Con adjunto',
    },
    nl: {
      understanding: 'Analizando tu búsqueda…',
      searching: 'Buscando: {{filters}}',
      allEmails: 'todos los correos',
      fromValue: 'de {{value}}',
      toValue: 'para {{value}}',
      subjectContains: 'asunto contiene "{{value}}"',
      withAttachments: 'con adjuntos',
      starred: 'destacados',
      unread: 'sin leer',
      read: 'leídos',
    },
    empty: {
      noResults: 'No se han encontrado resultados',
      idle: 'Busca en tus correos',
    },
    results_one: '{{count}} resultado',
    results_other: '{{count}} resultados',
  },

  compose: {
    titleCompose: 'Redactar',
    titleReply: 'Responder',
    titleForward: 'Reenviar',
    headTitleCompose: 'Redactar · Inbox · Oxy',
    headTitleWithSubject: '{{subject}} · Redactar · Oxy',
    placeholders: {
      to: 'Destinatarios',
      subject: 'Asunto',
      body: 'Redactar correo',
    },
    fields: {
      from: 'De',
      to: 'Para',
      cc: 'Cc',
      bcc: 'Cco',
    },
    actions: {
      send: 'Enviar',
      sendNow: 'Enviar ahora',
      moreSendOptions: 'Más opciones de envío',
      sendOptions: 'Opciones de envío',
      scheduleSend: 'Programar envío',
      saveDraft: 'Guardar borrador',
      discard: 'Descartar',
    },
    saveDraftPrompt: {
      title: '¿Guardar borrador?',
      description: '¿Quieres guardar este mensaje como borrador?',
    },
    dropZone: 'Suelta los archivos para adjuntar',
    toast: {
      addRecipient: 'Añade al menos un destinatario.',
      invalidEmail: 'Introduce una dirección de correo válida.',
      sendFailed: 'No se pudo enviar el correo. Inténtalo de nuevo.',
      scheduleFailed: 'No se pudo programar el envío. Inténtalo de nuevo.',
      scheduled: 'Correo programado para el {{time}}',
      uploadFailed: 'No se pudo subir el adjunto.',
      signatureFailed: 'No se pudo cargar la firma.',
    },
  },

  inlineReply: {
    placeholder: 'Escribe tu respuesta…',
    forwardTo: 'Reenviar a:',
    replyAllTo: 'Responder a todos a:',
    replyTo: 'Responder a:',
    cc: 'Cc:',
    bcc: 'Cco:',
    ccBccToggle: 'Cc/Cco',
    addRecipients: 'Añadir destinatarios',
    send: 'Enviar',
    quotedPrefix: 'El {{date}}, {{author}} escribió:',
    forwardHeader:
      '\n\n---------- Mensaje reenviado ----------\nDe: {{from}}\nFecha: {{date}}\nAsunto: {{subject}}\nPara: {{to}}\n\n',
  },

  smartReply: {
    quickReplies: 'Respuestas rápidas',
  },

  ai: {
    toolbar: {
      draft: 'Redactar',
      polish: 'Pulir',
      shorter: 'Más corto',
      longer: 'Más largo',
      tone: 'Tono',
      suggestSubject: 'Sugerir asunto',
    },
    draftModal: {
      title: 'Redactar con IA',
      subtitle: 'Describe qué quieres decir y Alia lo redactará por ti.',
      placeholder:
        'p. ej., Rechaza la reunión con educación y sugiere la próxima semana',
      toneLabel: 'Tono:',
      cancel: 'Cancelar',
      draft: 'Redactar',
    },
    toneMenu: {
      title: 'Cambiar el tono a…',
    },
    tones: {
      professional: 'Profesional',
      casual: 'Informal',
      friendly: 'Cercano',
      formal: 'Formal',
    },
  },

  threadSummary: {
    title: 'Resumen de la conversación',
    messages_one: '{{count}} mensaje',
    messages_other: '{{count}} mensajes',
    keyPoints: 'Puntos clave',
    actionItems: 'Acciones pendientes',
    due: 'Para: {{date}}',
    unavailable: 'No se pudo resumir esta conversación ahora.',
  },

  staleThread: {
    consider: 'Plantéate enviar una respuesta rápida',
    reply: 'Responder',
  },

  followUpReminder: {
    pastDue: 'Compromiso vencido',
    upcoming: 'Compromiso próximo',
    description: 'Dijiste «{{text}}» a {{recipient}}',
    deadline: {
      dueToday: 'Vence hoy',
      overdueOneDay: 'Vencido hace 1 día',
      overdueDays: 'Vencido hace {{days}} días',
      dueTomorrow: 'Vence mañana',
      dueInDays: 'Vence en {{days}} días',
    },
    fallbackName: 'alguien',
    view: 'Ver',
    done: 'Hecho',
  },

  reminder: {
    create: {
      title: 'Crear recordatorio',
      placeholder: '¿De qué quieres que te recordemos?',
      whenLabel: '¿Cuándo?',
      submit: 'Crear recordatorio',
      presets: {
        laterToday: 'Más tarde hoy',
        tomorrowMorning: 'Mañana por la mañana',
        thisWeekend: 'Este fin de semana',
        nextWeek: 'La próxima semana',
      },
    },
    time: {
      overdue: 'Vencido · {{date}}, {{time}}',
      today: 'Hoy, {{time}}',
      tomorrow: 'Mañana, {{time}}',
      onDate: '{{date}}, {{time}}',
    },
  },

  snooze: {
    title: 'Posponer hasta…',
    options: {
      laterToday: 'Más tarde hoy',
      tomorrow: 'Mañana',
      thisWeekend: 'Este fin de semana',
      nextWeek: 'La próxima semana',
    },
    time: {
      today: 'Hoy, {{time}}',
      tomorrow: 'Mañana, {{time}}',
      onDate: '{{date}}, {{time}}',
    },
  },

  schedule: {
    title: 'Programar envío',
    options: {
      laterToday: 'Más tarde hoy',
      tomorrowMorning: 'Mañana por la mañana',
      tomorrowAfternoon: 'Mañana por la tarde',
      mondayMorning: 'El lunes por la mañana',
    },
  },

  template: {
    insert: 'Insertar plantilla',
  },

  selection: {
    archive: 'Archivar',
    delete: 'Eliminar',
    star: 'Destacar',
    markRead: 'Marcar como leído',
  },

  subscriptions: {
    title: 'Suscripciones',
    subtitle:
      'Al darte de baja puede tardar unos días en dejar de llegarte mensajes',
    empty: {
      title: 'No se han encontrado suscripciones',
      subtitle:
        'Aquí aparecerán los remitentes que te escriben con frecuencia.',
    },
    unsubscribe: 'Darse de baja',
    block: 'Bloquear',
    frequency: {
      twentyPlus: 'Más de 20 correos recientes',
      tenToTwenty: '10-20 correos recientes',
      count_one: '{{count}} correo reciente',
      count_other: '{{count}} correos recientes',
    },
  },

  contacts: {
    searchPlaceholder: 'Buscar contactos…',
    addContact: 'Añadir contacto',
    cancel: 'Cancelar',
    saveContact: 'Guardar contacto',
    save: 'Guardar',
    edit: {
      cancel: 'Cancelar',
    },
    delete: {
      title: '¿Eliminar este contacto?',
      description: 'Esta acción no se puede deshacer.',
      cta: 'Eliminar',
    },
    starredFilter: 'Destacados',
    autoCollected: 'Recopilado automáticamente',
    empty: {
      noMatch: 'Ningún contacto coincide con tu búsqueda.',
      none: 'Aún no tienes contactos.',
    },
    toast: {
      nameEmailRequired: 'Nombre y correo son obligatorios.',
      created: 'Contacto creado.',
      updated: 'Contacto actualizado.',
      deleted: 'Contacto eliminado.',
    },
    form: {
      name: 'Nombre *',
      email: 'Correo *',
      company: 'Empresa',
      notes: 'Notas',
    },
  },

  shortcuts: {
    title: 'Atajos de teclado',
    close: 'Cerrar',
    actions: {
      compose: 'Redactar',
      reply: 'Responder',
      replyAll: 'Responder a todos',
      forward: 'Reenviar',
      archive: 'Archivar',
      delete: 'Eliminar',
      nextMessage: 'Mensaje siguiente',
      previousMessage: 'Mensaje anterior',
      starUnstar: 'Destacar / quitar destacado',
      markUnread: 'Marcar como no leído',
      search: 'Buscar',
      help: 'Esta ayuda',
    },
  },

  cards: {
    purchase: {
      header: 'Compra',
      order: 'Pedido n.º',
      moreItems: '+{{count}} más',
      summary: 'Detalles de la compra',
    },
    bill: {
      header: 'Factura',
      account: 'Cuenta',
      due: 'Vence el {{date}}',
      overdue: 'Vencida · {{date}}',
      summary: 'Detalles de la factura',
    },
    trip: {
      header: 'Viaje',
      confirmation: 'Confirmación',
      summary: 'Detalles del viaje',
    },
    package: {
      header: 'Paquete',
      tracking: 'Seguimiento',
      estimated: 'Estimado {{date}}',
      summary: 'Detalles del paquete',
    },
    event: {
      header: 'Evento',
      addToCalendar: 'Añadir al calendario',
      googleCalendar: 'Google Calendar',
      addToCalendarDialog: 'Añadir al calendario',
      defaultTitle: 'Evento',
      summary: 'Detalles del evento',
    },
  },

  importance: {
    urgent: 'Urgente',
    action: 'Requiere acción',
    important: 'Importante',
    fyi: 'Para tu información',
  },

  attachment: {
    sizeBytes: '{{value}} B',
    sizeKb: '{{value}} KB',
    sizeMb: '{{value}} MB',
  },

  settings: {
    head: 'Ajustes · Inbox · Oxy',
    title: 'Ajustes',
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
      title: 'Inicia sesión para acceder a tu inbox',
      subtitle: 'Conecta tu identidad Oxy para sincronizar mensajes, etiquetas y preferencias en todos tus dispositivos.',
      footer: 'Al iniciar sesión aceptas nuestros Términos y reconoces nuestra Política de Privacidad.',
    },
  },

  notifications: {
    push: {
      channel: {
        name: 'Correo',
        description: 'Notificaciones de correo nuevo',
      },
    },
  },
};

export default es;
