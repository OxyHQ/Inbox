import type { LocaleDict } from '../types';

/**
 * English (en-US) translation dictionary for the Inbox app.
 *
 * Keys are namespaced by feature area (`common.*`, `tabs.*`, `inbox.*`,
 * `compose.*`, etc.). Use `{{var}}` placeholders for interpolation values
 * such as counts or names.
 *
 * Settings strings live alongside the rest of the dictionary but the
 * SettingsLanding / sections / subscreen components are still being
 * rebuilt in parallel — see the audit notes in the task report for the
 * catalog of settings literals that still need adoption.
 */
const en: LocaleDict = {
  common: {
    cancel: 'Cancel',
    save: 'Save',
    ok: 'OK',
    continue: 'Continue',
    back: 'Back',
    next: 'Next',
    done: 'Done',
    close: 'Close',
    loading: 'Loading…',
    error: 'Error',
    success: 'Success',
    retry: 'Retry',
    delete: 'Delete',
    edit: 'Edit',
    remove: 'Remove',
    confirm: 'Confirm',
    submit: 'Submit',
    search: 'Search',
    yes: 'Yes',
    no: 'No',
    or: 'or',
    and: 'and',
    open: 'Open',
    discard: 'Discard',
    of: 'of',
    more: 'More',
    less: 'Less',
  },

  app: {
    name: 'Inbox',
    title: 'Inbox by Oxy',
    titleSuffix: '· Oxy',
  },

  tabs: {
    inbox: 'Inbox',
    search: 'Search',
    settings: 'Settings',
  },

  drawer: {
    starred: 'Starred',
    snoozed: 'Snoozed',
    subscriptions: 'Subscriptions',
    labels: 'Labels',
    more: 'More',
    less: 'Less',
    notSignedIn: 'Not signed in',
    accountSwitcher: 'Account Switcher',
    addAnotherAccount: 'Add another account',
    signOut: 'Sign out',
    switchAccount: 'Switch account, signed in as {{name}}',
    switchingAccount: 'Switching account…',
    expandSidebar: 'Expand sidebar',
    collapseSidebar: 'Collapse sidebar',
    signedOut: {
      title: 'Sign in to manage your email',
      subtitle: 'Access your mailboxes, labels, and compose new messages.',
    },
    mailboxes: {
      Inbox: 'Inbox',
      Sent: 'Sent',
      Drafts: 'Drafts',
      Trash: 'Trash',
      Spam: 'Spam',
      Archive: 'Archive',
      Starred: 'Starred',
      Snoozed: 'Snoozed',
    },
    mailboxA11y: '{{name}}, {{count}} unread',
  },

  home: {
    greeting: {
      morning: 'Good morning',
      afternoon: 'Good afternoon',
      evening: 'Good evening',
      withName: '{{greeting}}, {{name}}',
    },
    todaysBrief: "Today's Brief",
    openMenu: 'Open menu',
    jumpToToday: 'Jump to today',
    previousWeek: 'Previous week',
    nextWeek: 'Next week',
    regenerateBrief: 'Regenerate brief',
    inboxSection: 'Inbox',
    needsResponse: 'Needs Response',
    followUp: 'Follow Up',
    needsResponseA11y_one: 'Needs response, {{count}} email',
    needsResponseA11y_other: 'Needs response, {{count}} emails',
    followUpA11y_one: 'Follow up, {{count}} email',
    followUpA11y_other: 'Follow up, {{count}} emails',
    days: {
      sun: 'SUN',
      mon: 'MON',
      tue: 'TUE',
      wed: 'WED',
      thu: 'THU',
      fri: 'FRI',
      sat: 'SAT',
    },
    stats: {
      unread: '{{count}} unread',
      starred: '{{count}} starred',
      attachments: '{{count}}',
    },
    brief: {
      analyzing: 'Alia is analyzing your inbox…',
      unavailable: 'Unable to generate brief right now.',
      empty: 'No emails to summarize yet.',
      writing: 'Writing your brief…',
      preparing: 'Preparing your brief…',
      failed: "Couldn't write today's brief.",
      nothingNew: 'Nothing new today.',
      tapRetry: 'Tap to retry.',
    },
    feedEmpty: {
      title: 'All caught up',
      subtitle: 'Nothing new in your inbox.',
    },
    signedOut: {
      subtitle:
        'Sign in to see your daily brief, emails that need a reply, and follow-ups waiting on you.',
    },
  },


  inbox: {
    title: 'Inbox',
    starredTitle: 'Starred',
    searchInMailbox: 'Search in {{mailbox}}',
    emptyTitle: 'Nothing here',
    emptyAllCaught: "You're all caught up.",
    emptySignIn: 'Sign in to access your mail.',
    pagination: '{{from}}–{{to}} of {{total}}',
    remind: 'Remind',
    bundled: 'Bundled',
    flat: 'Flat',
    composeFab: 'Compose new email',
    composeFabLabel: 'Compose',
    askAlia: 'Ask Alia',
    askAliaHint: 'Opens the Alia AI assistant to ask questions about your inbox',
    sections: {
      reminders: 'Reminders',
      pinned: 'Pinned',
      today: 'Today',
      yesterday: 'Yesterday',
      thisWeek: 'This Week',
      thisMonth: 'This Month',
      earlier: 'Earlier',
    },
    aliaSuggestions: {
      unread: {
        label: 'Unread emails',
        prompt: 'What emails need my attention?',
      },
      todaysSummary: {
        label: "Today's summary",
        prompt: 'Summarize my emails from today',
      },
      withAttachments: {
        label: 'With attachments',
        prompt: 'Find emails with attachments',
      },
    },
    aliaClientContext:
      'User is in the Inbox app viewing their email. Use oxy_inbox tools to access their emails.',
    toast: {
      archiveUnavailable: 'Archive folder not available.',
      trashUnavailable: 'Trash folder not available.',
      offlineSync_one: 'Synced {{count}} offline action.',
      offlineSync_other: 'Synced {{count}} offline actions.',
      newVersionAvailable: 'New version available — refresh to update.',
      newEmail: 'New email from {{sender}}',
    },
  },

  message: {
    detail: {
      noSubject: '(no subject)',
      emptyMessage: '(empty message)',
      messagesInConversation_one: '{{count}} message in this conversation',
      messagesInConversation_other: '{{count}} messages in this conversation',
      toRecipients: 'to {{recipients}}',
      ccRecipients: ', cc: {{recipients}}',
    },
    actions: {
      archive: 'Archive',
      delete: 'Delete',
      markUnread: 'Mark as unread',
      markRead: 'Mark read',
      reply: 'Reply',
      replyAll: 'Reply all',
      forward: 'Forward',
      pin: 'Pin message',
      unpin: 'Unpin message',
      star: 'Star message',
      unstar: 'Unstar message',
      snooze: 'Snooze',
      print: 'Print',
      more: 'More actions',
      moreInline: 'More',
      reportSpam: 'Report spam',
      label: 'Label',
      downloadEml: 'Download .eml',
      messageActions: 'Message actions',
    },
    labelPicker: {
      title: 'Labels',
      empty: 'No labels yet',
    },
    toast: {
      attachmentFailed: 'Failed to download attachment.',
      fileSystemUnavailable: 'File system not available on this device.',
      sharingUnavailable: 'Sharing is not available on this device.',
      printFailed: 'Failed to print email.',
      downloadFailed: 'Failed to download email.',
      saveEmailDialog: 'Save email',
    },
  },

  empty: {
    selectConversation: 'Select a conversation',
    nothingHere: 'Nothing here',
  },

  notFound: {
    title:
      "Couldn't find that conversation. It may have been moved, archived, or deleted.",
    back: 'Back to Inbox',
  },

  search: {
    placeholder: 'Search mail',
    clear: 'Clear search',
    openMenu: 'Open menu',
    goBack: 'Go back',
    filters: {
      from: 'From',
      fromValue: 'From: {{value}}',
      hasAttachment: 'Has attachment',
    },
    nl: {
      understanding: 'Understanding your search…',
      searching: 'Searching: {{filters}}',
      allEmails: 'all emails',
      fromValue: 'from {{value}}',
      toValue: 'to {{value}}',
      subjectContains: 'subject contains "{{value}}"',
      withAttachments: 'with attachments',
      starred: 'starred',
      unread: 'unread',
      read: 'read',
    },
    empty: {
      noResults: 'No results found',
      idle: 'Search your emails',
    },
    results_one: '{{count}} result',
    results_other: '{{count}} results',
  },

  compose: {
    titleCompose: 'Compose',
    titleReply: 'Reply',
    titleForward: 'Forward',
    headTitleCompose: 'Compose · Inbox · Oxy',
    headTitleWithSubject: '{{subject}} · Compose · Oxy',
    placeholders: {
      to: 'Recipients',
      subject: 'Subject',
      body: 'Compose email',
    },
    fields: {
      from: 'From',
      to: 'To',
      cc: 'Cc',
      bcc: 'Bcc',
    },
    actions: {
      send: 'Send',
      sendNow: 'Send now',
      moreSendOptions: 'More send options',
      sendOptions: 'Send options',
      scheduleSend: 'Schedule send',
      saveDraft: 'Save draft',
      discard: 'Discard',
    },
    saveDraftPrompt: {
      title: 'Save draft?',
      description: 'Do you want to save this message as a draft?',
    },
    dropZone: 'Drop files to attach',
    toast: {
      addRecipient: 'Please add at least one recipient.',
      invalidEmail: 'Please enter a valid email address.',
      sendFailed: 'Unable to send email. Please try again.',
      scheduleFailed: 'Failed to schedule email. Please try again.',
      scheduled: 'Email scheduled for {{time}}',
      uploadFailed: 'Failed to upload attachment.',
      signatureFailed: 'Failed to load signature.',
    },
  },

  inlineReply: {
    placeholder: 'Write your reply…',
    forwardTo: 'Forward to:',
    replyAllTo: 'Reply all to:',
    replyTo: 'Reply to:',
    cc: 'Cc:',
    bcc: 'Bcc:',
    ccBccToggle: 'Cc/Bcc',
    addRecipients: 'Add recipients',
    send: 'Send',
    quotedPrefix: 'On {{date}}, {{author}} wrote:',
    forwardHeader:
      '\n\n---------- Forwarded message ----------\nFrom: {{from}}\nDate: {{date}}\nSubject: {{subject}}\nTo: {{to}}\n\n',
  },

  smartReply: {
    quickReplies: 'Quick replies',
  },

  ai: {
    toolbar: {
      draft: 'Draft',
      polish: 'Polish',
      shorter: 'Shorter',
      longer: 'Longer',
      tone: 'Tone',
      suggestSubject: 'Suggest subject line',
    },
    draftModal: {
      title: 'Draft with AI',
      subtitle: 'Describe what you want to say, and Alia will draft it for you.',
      placeholder: 'e.g., Decline the meeting politely, suggest next week instead',
      toneLabel: 'Tone:',
      cancel: 'Cancel',
      draft: 'Draft',
    },
    toneMenu: {
      title: 'Change tone to…',
    },
    tones: {
      professional: 'Professional',
      casual: 'Casual',
      friendly: 'Friendly',
      formal: 'Formal',
    },
  },

  threadSummary: {
    title: 'Thread Summary',
    messages_one: '{{count}} message',
    messages_other: '{{count}} messages',
    keyPoints: 'Key Points',
    actionItems: 'Action Items',
    due: 'Due: {{date}}',
    unavailable: 'Unable to summarize this thread right now.',
  },

  staleThread: {
    consider: 'Consider sending a quick reply',
    reply: 'Reply',
  },

  followUpReminder: {
    pastDue: 'Past due commitment',
    upcoming: 'Upcoming commitment',
    description: 'You said "{{text}}" to {{recipient}}',
    deadline: {
      dueToday: 'Due today',
      overdueOneDay: 'Overdue by 1 day',
      overdueDays: 'Overdue by {{days}} days',
      dueTomorrow: 'Due tomorrow',
      dueInDays: 'Due in {{days}} days',
    },
    fallbackName: 'someone',
    view: 'View',
    done: 'Done',
  },

  reminder: {
    create: {
      title: 'Create reminder',
      placeholder: 'What do you want to be reminded about?',
      whenLabel: 'When?',
      submit: 'Create reminder',
      presets: {
        laterToday: 'Later today',
        tomorrowMorning: 'Tomorrow morning',
        thisWeekend: 'This weekend',
        nextWeek: 'Next week',
      },
    },
    time: {
      overdue: 'Overdue · {{date}}, {{time}}',
      today: 'Today, {{time}}',
      tomorrow: 'Tomorrow, {{time}}',
      onDate: '{{date}}, {{time}}',
    },
  },

  snooze: {
    title: 'Snooze until…',
    options: {
      laterToday: 'Later today',
      tomorrow: 'Tomorrow',
      thisWeekend: 'This weekend',
      nextWeek: 'Next week',
    },
    time: {
      today: 'Today, {{time}}',
      tomorrow: 'Tomorrow, {{time}}',
      onDate: '{{date}}, {{time}}',
    },
  },

  schedule: {
    title: 'Schedule send',
    options: {
      laterToday: 'Later today',
      tomorrowMorning: 'Tomorrow morning',
      tomorrowAfternoon: 'Tomorrow afternoon',
      mondayMorning: 'Monday morning',
    },
  },

  template: {
    insert: 'Insert Template',
  },

  selection: {
    archive: 'Archive',
    delete: 'Delete',
    star: 'Star',
    markRead: 'Mark read',
  },

  subscriptions: {
    title: 'Subscriptions',
    subtitle:
      'When you unsubscribe, it can take a few days to stop receiving messages',
    empty: {
      title: 'No subscriptions found',
      subtitle: 'Senders who email you frequently will appear here.',
    },
    unsubscribe: 'Unsubscribe',
    block: 'Block',
    frequency: {
      twentyPlus: '20+ emails recently',
      tenToTwenty: '10-20 emails recently',
      count_one: '{{count}} email recently',
      count_other: '{{count}} emails recently',
    },
  },

  contacts: {
    searchPlaceholder: 'Search contacts…',
    addContact: 'Add contact',
    cancel: 'Cancel',
    saveContact: 'Save contact',
    save: 'Save',
    edit: {
      cancel: 'Cancel',
    },
    delete: {
      title: 'Delete this contact?',
      description: 'This action cannot be undone.',
      cta: 'Delete',
    },
    starredFilter: 'Starred',
    autoCollected: 'Auto-collected',
    empty: {
      noMatch: 'No contacts match your search.',
      none: 'No contacts yet.',
    },
    toast: {
      nameEmailRequired: 'Name and email are required.',
      created: 'Contact created.',
      updated: 'Contact updated.',
      deleted: 'Contact deleted.',
    },
    form: {
      name: 'Name *',
      email: 'Email *',
      company: 'Company',
      notes: 'Notes',
    },
  },

  shortcuts: {
    title: 'Keyboard shortcuts',
    close: 'Close',
    actions: {
      compose: 'Compose',
      reply: 'Reply',
      replyAll: 'Reply all',
      forward: 'Forward',
      archive: 'Archive',
      delete: 'Delete',
      nextMessage: 'Next message',
      previousMessage: 'Previous message',
      starUnstar: 'Star / unstar',
      markUnread: 'Mark unread',
      search: 'Search',
      help: 'This help',
    },
  },

  cards: {
    purchase: {
      header: 'Purchase',
      order: 'Order #',
      moreItems: '+{{count}} more',
      summary: 'Purchase details',
    },
    bill: {
      header: 'Bill',
      account: 'Account',
      due: 'Due {{date}}',
      overdue: 'Overdue · {{date}}',
      summary: 'Bill details',
    },
    trip: {
      header: 'Trip',
      confirmation: 'Confirmation',
      summary: 'Trip details',
    },
    package: {
      header: 'Package',
      tracking: 'Tracking',
      estimated: 'Est. {{date}}',
      summary: 'Package details',
    },
    event: {
      header: 'Event',
      addToCalendar: 'Add to Calendar',
      googleCalendar: 'Google Calendar',
      addToCalendarDialog: 'Add to Calendar',
      defaultTitle: 'Event',
      summary: 'Event details',
    },
  },

  importance: {
    urgent: 'Urgent',
    action: 'Action needed',
    important: 'Important',
    fyi: 'FYI',
  },

  attachment: {
    sizeBytes: '{{value}} B',
    sizeKb: '{{value}} KB',
    sizeMb: '{{value}} MB',
  },

  settings: {
    head: 'Settings · Inbox · Oxy',
    title: 'Settings',
  },

  auth: {
    gate: {
      title: 'Sign in to access your inbox',
      subtitle: 'Connect your Oxy identity to sync messages, labels, and preferences across every device.',
      footer: 'By signing in you agree to our Terms and acknowledge our Privacy Policy.',
    },
  },

  notifications: {
    push: {
      channel: {
        name: 'Email',
        description: 'New mail notifications',
      },
    },
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
};

export default en;
