import type { LocaleDict } from '../types';

/**
 * Portuguese (pt-PT) translation dictionary for the Inbox app.
 *
 * Tone: informal "tu" — matches the rest of the Oxy ecosystem.
 * Punctuation and capitalization mirror the source EN strings.
 */
const pt: LocaleDict = {
  common: {
    cancel: 'Cancelar',
    save: 'Guardar',
    ok: 'OK',
    continue: 'Continuar',
    back: 'Voltar',
    next: 'Seguinte',
    done: 'Concluído',
    close: 'Fechar',
    loading: 'A carregar…',
    error: 'Erro',
    success: 'Pronto',
    retry: 'Tentar novamente',
    delete: 'Eliminar',
    edit: 'Editar',
    remove: 'Remover',
    confirm: 'Confirmar',
    submit: 'Enviar',
    search: 'Pesquisar',
    yes: 'Sim',
    no: 'Não',
    or: 'ou',
    and: 'e',
    open: 'Abrir',
    discard: 'Descartar',
    of: 'de',
    more: 'Mais',
    less: 'Menos',
  },

  app: {
    name: 'Inbox',
    title: 'Inbox da Oxy',
    titleSuffix: '· Oxy',
  },

  tabs: {
    inbox: 'Caixa de entrada',
    search: 'Pesquisar',
    settings: 'Definições',
  },

  drawer: {
    starred: 'Com estrela',
    snoozed: 'Adiados',
    subscriptions: 'Subscrições',
    labels: 'Etiquetas',
    more: 'Mais',
    less: 'Menos',
    notSignedIn: 'Sessão não iniciada',
    accountSwitcher: 'Seletor de conta',
    addAnotherAccount: 'Adicionar outra conta',
    signOut: 'Terminar sessão',
    switchAccount: 'Trocar de conta, sessão iniciada como {{name}}',
    switchingAccount: 'A trocar de conta…',
    expandSidebar: 'Expandir barra lateral',
    collapseSidebar: 'Recolher barra lateral',
    signedOut: {
      title: 'Inicia sessão para gerir o teu correio',
      subtitle: 'Acede às caixas, etiquetas e compõe novas mensagens.',
    },
    mailboxes: {
      Inbox: 'Caixa de entrada',
      Sent: 'Enviados',
      Drafts: 'Rascunhos',
      Trash: 'Lixo',
      Spam: 'Spam',
      Archive: 'Arquivo',
      Starred: 'Com estrela',
      Snoozed: 'Adiados',
    },
    mailboxA11y: '{{name}}, {{count}} por ler',
  },

  home: {
    greeting: {
      morning: 'Bom dia',
      afternoon: 'Boa tarde',
      evening: 'Boa noite',
      withName: '{{greeting}}, {{name}}',
    },
    todaysBrief: 'Resumo de hoje',
    openMenu: 'Abrir menu',
    jumpToToday: 'Ir para hoje',
    previousWeek: 'Semana anterior',
    nextWeek: 'Semana seguinte',
    regenerateBrief: 'Regenerar resumo',
    inboxSection: 'Caixa de entrada',
    needsResponse: 'Precisa de resposta',
    followUp: 'Pendente de seguimento',
    needsResponseA11y_one: 'Precisa de resposta, {{count}} email',
    needsResponseA11y_other: 'Precisa de resposta, {{count}} emails',
    followUpA11y_one: 'Pendente de seguimento, {{count}} email',
    followUpA11y_other: 'Pendente de seguimento, {{count}} emails',
    days: {
      sun: 'DOM',
      mon: 'SEG',
      tue: 'TER',
      wed: 'QUA',
      thu: 'QUI',
      fri: 'SEX',
      sat: 'SÁB',
    },
    stats: {
      unread: '{{count}} por ler',
      starred: '{{count}} com estrela',
      attachments: '{{count}}',
    },
    brief: {
      analyzing: 'A Alia está a analisar a tua caixa…',
      unavailable: 'Não foi possível gerar o resumo agora.',
      empty: 'Ainda não há emails para resumir.',
      writing: 'A escrever o teu resumo…',
      preparing: 'A preparar o teu resumo…',
      failed: 'Não foi possível escrever o resumo de hoje.',
      nothingNew: 'Nada de novo hoje.',
      tapRetry: 'Toca para tentar novamente.',
    },
    feedEmpty: {
      title: 'Tudo em dia',
      subtitle: 'Não há nada novo na caixa.',
    },
    signedOut: {
      subtitle:
        'Inicia sessão para ver o resumo diário, os emails que precisam de resposta e os seguimentos pendentes.',
    },
  },


  inbox: {
    title: 'Caixa de entrada',
    starredTitle: 'Com estrela',
    searchInMailbox: 'Pesquisar em {{mailbox}}',
    emptyTitle: 'Não há nada aqui',
    emptyAllCaught: 'Estás em dia.',
    emptySignIn: 'Inicia sessão para aceder ao teu correio.',
    pagination: '{{from}}–{{to}} de {{total}}',
    remind: 'Lembrar',
    bundled: 'Agrupados',
    flat: 'Lista',
    composeFab: 'Escrever novo email',
    composeFabLabel: 'Escrever',
    askAlia: 'Perguntar à Alia',
    askAliaHint: 'Abre o assistente de IA Alia para fazer perguntas sobre a caixa',
    sections: {
      reminders: 'Lembretes',
      pinned: 'Fixados',
      today: 'Hoje',
      yesterday: 'Ontem',
      thisWeek: 'Esta semana',
      thisMonth: 'Este mês',
      earlier: 'Anteriores',
    },
    aliaSuggestions: {
      unread: {
        label: 'Emails por ler',
        prompt: 'Que emails precisam da minha atenção?',
      },
      todaysSummary: {
        label: 'Resumo de hoje',
        prompt: 'Resume os emails de hoje',
      },
      withAttachments: {
        label: 'Com anexos',
        prompt: 'Procura emails com anexos',
      },
    },
    aliaClientContext:
      'User is in the Inbox app viewing their email. Use oxy_inbox tools to access their emails.',
    toast: {
      archiveUnavailable: 'Pasta Arquivo não disponível.',
      trashUnavailable: 'Pasta Lixo não disponível.',
      offlineSync_one: 'Sincronizada {{count}} ação offline.',
      offlineSync_other: 'Sincronizadas {{count}} ações offline.',
      newVersionAvailable: 'Nova versão disponível — atualiza a página.',
      newEmail: 'Novo email de {{sender}}',
    },
  },

  message: {
    detail: {
      noSubject: '(sem assunto)',
      emptyMessage: '(mensagem vazia)',
      messagesInConversation_one: '{{count}} mensagem nesta conversa',
      messagesInConversation_other: '{{count}} mensagens nesta conversa',
      toRecipients: 'a {{recipients}}',
      ccRecipients: ', cc: {{recipients}}',
    },
    actions: {
      archive: 'Arquivar',
      delete: 'Eliminar',
      markUnread: 'Marcar como não lido',
      markRead: 'Marcar como lido',
      reply: 'Responder',
      replyAll: 'Responder a todos',
      forward: 'Reencaminhar',
      pin: 'Fixar mensagem',
      unpin: 'Desafixar mensagem',
      star: 'Marcar com estrela',
      unstar: 'Remover estrela',
      snooze: 'Adiar',
      print: 'Imprimir',
      more: 'Mais ações',
      moreInline: 'Mais',
      reportSpam: 'Marcar como spam',
      label: 'Etiqueta',
      downloadEml: 'Transferir .eml',
      messageActions: 'Ações da mensagem',
    },
    labelPicker: {
      title: 'Etiquetas',
      empty: 'Ainda não há etiquetas',
    },
    toast: {
      attachmentFailed: 'Não foi possível transferir o anexo.',
      fileSystemUnavailable: 'Sistema de ficheiros indisponível neste dispositivo.',
      sharingUnavailable: 'Partilha indisponível neste dispositivo.',
      printFailed: 'Falha ao imprimir o email.',
      downloadFailed: 'Falha ao transferir o email.',
      saveEmailDialog: 'Guardar email',
    },
  },

  empty: {
    selectConversation: 'Seleciona uma conversa',
    nothingHere: 'Não há nada aqui',
  },

  notFound: {
    title:
      'Não foi possível encontrar essa conversa. Pode ter sido movida, arquivada ou eliminada.',
    back: 'Voltar à caixa',
  },

  search: {
    placeholder: 'Pesquisar no correio',
    clear: 'Limpar pesquisa',
    openMenu: 'Abrir menu',
    goBack: 'Voltar',
    filters: {
      from: 'De',
      fromValue: 'De: {{value}}',
      hasAttachment: 'Com anexo',
    },
    nl: {
      understanding: 'A interpretar a tua pesquisa…',
      searching: 'A pesquisar: {{filters}}',
      allEmails: 'todos os emails',
      fromValue: 'de {{value}}',
      toValue: 'para {{value}}',
      subjectContains: 'assunto contém "{{value}}"',
      withAttachments: 'com anexos',
      starred: 'com estrela',
      unread: 'por ler',
      read: 'lidos',
    },
    empty: {
      noResults: 'Sem resultados',
      idle: 'Pesquisa nos teus emails',
    },
    results_one: '{{count}} resultado',
    results_other: '{{count}} resultados',
  },

  compose: {
    titleCompose: 'Escrever',
    titleReply: 'Responder',
    titleForward: 'Reencaminhar',
    headTitleCompose: 'Escrever · Inbox · Oxy',
    headTitleWithSubject: '{{subject}} · Escrever · Oxy',
    placeholders: {
      to: 'Destinatários',
      subject: 'Assunto',
      body: 'Escreve o email',
    },
    fields: {
      from: 'De',
      to: 'Para',
      cc: 'Cc',
      bcc: 'Bcc',
    },
    actions: {
      send: 'Enviar',
      sendNow: 'Enviar agora',
      moreSendOptions: 'Mais opções de envio',
      sendOptions: 'Opções de envio',
      scheduleSend: 'Agendar envio',
      saveDraft: 'Guardar rascunho',
      discard: 'Descartar',
    },
    saveDraftPrompt: {
      title: 'Guardar rascunho?',
      description: 'Queres guardar esta mensagem como rascunho?',
    },
    dropZone: 'Larga os ficheiros aqui para anexar',
    toast: {
      addRecipient: 'Adiciona pelo menos um destinatário.',
      invalidEmail: 'Introduz um endereço de email válido.',
      sendFailed: 'Não foi possível enviar o email. Tenta novamente.',
      scheduleFailed: 'Não foi possível agendar o envio. Tenta novamente.',
      scheduled: 'Email agendado para {{time}}',
      uploadFailed: 'Não foi possível carregar o anexo.',
      signatureFailed: 'Não foi possível carregar a assinatura.',
    },
  },

  inlineReply: {
    placeholder: 'Escreve a tua resposta…',
    forwardTo: 'Reencaminhar para:',
    replyAllTo: 'Responder a todos para:',
    replyTo: 'Responder a:',
    cc: 'Cc:',
    bcc: 'Bcc:',
    ccBccToggle: 'Cc/Bcc',
    addRecipients: 'Adicionar destinatários',
    send: 'Enviar',
    quotedPrefix: 'Em {{date}}, {{author}} escreveu:',
    forwardHeader:
      '\n\n---------- Mensagem reencaminhada ----------\nDe: {{from}}\nData: {{date}}\nAssunto: {{subject}}\nPara: {{to}}\n\n',
  },

  smartReply: {
    quickReplies: 'Respostas rápidas',
  },

  ai: {
    toolbar: {
      draft: 'Esboço',
      polish: 'Polir',
      shorter: 'Mais curto',
      longer: 'Mais longo',
      tone: 'Tom',
      suggestSubject: 'Sugerir assunto',
    },
    draftModal: {
      title: 'Escrever com IA',
      subtitle: 'Descreve o que queres dizer e a Alia escreve por ti.',
      placeholder: 'p. ex., Recusa a reunião com cortesia e propõe a próxima semana',
      toneLabel: 'Tom:',
      cancel: 'Cancelar',
      draft: 'Esboço',
    },
    toneMenu: {
      title: 'Alterar o tom para…',
    },
    tones: {
      professional: 'Profissional',
      casual: 'Casual',
      friendly: 'Amigável',
      formal: 'Formal',
    },
  },

  threadSummary: {
    title: 'Resumo da conversa',
    messages_one: '{{count}} mensagem',
    messages_other: '{{count}} mensagens',
    keyPoints: 'Pontos-chave',
    actionItems: 'Ações pendentes',
    due: 'Prazo: {{date}}',
    unavailable: 'Não foi possível resumir esta conversa agora.',
  },

  staleThread: {
    consider: 'Considera enviar uma resposta rápida',
    reply: 'Responder',
  },

  followUpReminder: {
    pastDue: 'Compromisso vencido',
    upcoming: 'Compromisso próximo',
    description: 'Disseste «{{text}}» a {{recipient}}',
    deadline: {
      dueToday: 'Vence hoje',
      overdueOneDay: 'Atrasado 1 dia',
      overdueDays: 'Atrasado {{days}} dias',
      dueTomorrow: 'Vence amanhã',
      dueInDays: 'Vence dentro de {{days}} dias',
    },
    fallbackName: 'alguém',
    view: 'Ver',
    done: 'Concluído',
  },

  reminder: {
    create: {
      title: 'Criar lembrete',
      placeholder: 'Do que queres que te lembrem?',
      whenLabel: 'Quando?',
      submit: 'Criar lembrete',
      presets: {
        laterToday: 'Mais tarde hoje',
        tomorrowMorning: 'Amanhã de manhã',
        thisWeekend: 'Este fim de semana',
        nextWeek: 'Próxima semana',
      },
    },
    time: {
      overdue: 'Atrasado · {{date}}, {{time}}',
      today: 'Hoje, {{time}}',
      tomorrow: 'Amanhã, {{time}}',
      onDate: '{{date}}, {{time}}',
    },
  },

  snooze: {
    title: 'Adiar até…',
    options: {
      laterToday: 'Mais tarde hoje',
      tomorrow: 'Amanhã',
      thisWeekend: 'Este fim de semana',
      nextWeek: 'Próxima semana',
    },
    time: {
      today: 'Hoje, {{time}}',
      tomorrow: 'Amanhã, {{time}}',
      onDate: '{{date}}, {{time}}',
    },
  },

  schedule: {
    title: 'Agendar envio',
    options: {
      laterToday: 'Mais tarde hoje',
      tomorrowMorning: 'Amanhã de manhã',
      tomorrowAfternoon: 'Amanhã à tarde',
      mondayMorning: 'Segunda de manhã',
    },
  },

  template: {
    insert: 'Inserir modelo',
  },

  selection: {
    archive: 'Arquivar',
    delete: 'Eliminar',
    star: 'Marcar com estrela',
    markRead: 'Marcar como lido',
  },

  subscriptions: {
    title: 'Subscrições',
    subtitle:
      'Após cancelar a subscrição, pode demorar alguns dias até deixares de receber mensagens',
    empty: {
      title: 'Nenhuma subscrição encontrada',
      subtitle: 'Aqui aparecerão os remetentes que te escrevem com frequência.',
    },
    unsubscribe: 'Cancelar subscrição',
    block: 'Bloquear',
    frequency: {
      twentyPlus: 'Mais de 20 emails recentes',
      tenToTwenty: '10-20 emails recentes',
      count_one: '{{count}} email recente',
      count_other: '{{count}} emails recentes',
    },
  },

  contacts: {
    searchPlaceholder: 'Pesquisar contactos…',
    addContact: 'Adicionar contacto',
    cancel: 'Cancelar',
    saveContact: 'Guardar contacto',
    save: 'Guardar',
    edit: {
      cancel: 'Cancelar',
    },
    delete: {
      title: 'Eliminar este contacto?',
      description: 'Esta ação não pode ser anulada.',
      cta: 'Eliminar',
    },
    starredFilter: 'Com estrela',
    autoCollected: 'Recolhido automaticamente',
    empty: {
      noMatch: 'Nenhum contacto corresponde à pesquisa.',
      none: 'Ainda não tens contactos.',
    },
    toast: {
      nameEmailRequired: 'Nome e email são obrigatórios.',
      created: 'Contacto criado.',
      updated: 'Contacto atualizado.',
      deleted: 'Contacto eliminado.',
    },
    form: {
      name: 'Nome *',
      email: 'Email *',
      company: 'Empresa',
      notes: 'Notas',
    },
  },

  shortcuts: {
    title: 'Atalhos de teclado',
    close: 'Fechar',
    actions: {
      compose: 'Escrever',
      reply: 'Responder',
      replyAll: 'Responder a todos',
      forward: 'Reencaminhar',
      archive: 'Arquivar',
      delete: 'Eliminar',
      nextMessage: 'Mensagem seguinte',
      previousMessage: 'Mensagem anterior',
      starUnstar: 'Marcar / remover estrela',
      markUnread: 'Marcar como não lido',
      search: 'Pesquisar',
      help: 'Esta ajuda',
    },
  },

  cards: {
    purchase: {
      header: 'Compra',
      order: 'Encomenda n.º',
      moreItems: '+{{count}} mais',
      summary: 'Detalhes da compra',
    },
    bill: {
      header: 'Fatura',
      account: 'Conta',
      due: 'Vence em {{date}}',
      overdue: 'Vencida · {{date}}',
      summary: 'Detalhes da fatura',
    },
    trip: {
      header: 'Viagem',
      confirmation: 'Confirmação',
      summary: 'Detalhes da viagem',
    },
    package: {
      header: 'Encomenda',
      tracking: 'Rastreio',
      estimated: 'Est. {{date}}',
      summary: 'Detalhes da encomenda',
    },
    event: {
      header: 'Evento',
      addToCalendar: 'Adicionar ao calendário',
      googleCalendar: 'Google Calendar',
      addToCalendarDialog: 'Adicionar ao calendário',
      defaultTitle: 'Evento',
      summary: 'Detalhes do evento',
    },
  },

  importance: {
    urgent: 'Urgente',
    action: 'Requer ação',
    important: 'Importante',
    fyi: 'Para a tua informação',
  },

  attachment: {
    sizeBytes: '{{value}} B',
    sizeKb: '{{value}} KB',
    sizeMb: '{{value}} MB',
  },

  settings: {
    head: 'Definições · Inbox · Oxy',
    title: 'Definições',
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
      title: 'Inicia sessão para aceder à tua caixa',
      subtitle:
        'Liga a tua identidade Oxy para sincronizar mensagens, etiquetas e preferências em todos os dispositivos.',
      footer:
        'Ao iniciar sessão aceitas os nossos Termos e reconheces a nossa Política de Privacidade.',
    },
  },
};

export default pt;
