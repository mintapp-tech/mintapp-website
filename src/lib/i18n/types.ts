export type Lang = "ar" | "en";

export interface CaseStudyContent {
  eyebrow: string;
  name: string;
  category: string;
  title: string;
  sub: string;
  meta: { k: string; v: string }[];
  challengeTitle: string;
  challengeCopy: string;
  approachTitle: string;
  approachCopy: string;
  approachPoints: { t: string; d: string }[];
  uxTitle: string;
  uxPoints: { t: string; d: string }[];
  screensTitle: string;
  screensCopy: string;
  dsTitle: string;
  dsCopy: string;
  outcomeTitle: string;
  outcomeCopy: string;
  outcomePoints: string[];
  featuresTitle?: string;
  featureGroups?: { t: string; items: string[] }[];
  relatedTitle: string;
  back: string;
}

export interface HomeContent {
  tagline: string;
  nav: {
    home: string;
    work: string;
    services: string;
    about: string;
    start: string;
    lang: string;
    menu: string;
    close: string;
    switchLang: string;
    skip: string;
  };
  // The header's Contact panel: two routes, a project or a general inquiry.
  contact: {
    nav: string;
    title: string;
    startTitle: string;
    startDesc: string;
    generalTitle: string;
    generalDesc: string;
    reply: string;
    close: string;
  };
  hero: {
    eyebrow: string;
    title: string;
    sub: string;
    cta1: string;
    cta2: string;
    fit: string;
    // Visual only (aria-hidden): an unclear idea resolving into a first-call direction.
    board: {
      idea: string;
      direction: string;
      fragments: string[];
      context: string;
      contextText: string;
      questions: string;
      next: string;
      nextText: string;
    };
  };
  testimonials: {
    eyebrow: string;
    title: string;
    // Shown under a quote displayed in its original language (no approved translation).
    quotedIn: { en: string; ar: string };
    // Shown only with labelled sample content on a review Preview.
  };
  work: {
    eyebrow: string;
    title: string;
    intro: string;
    cta: string;
    featured: { name: string; category: string; desc: string; tags: string[] };
    p1: { name: string; category: string; desc: string; tags: string[] };
    p2: { name: string; category: string; desc: string; tags: string[] };
    p3: { name: string; category: string; desc: string; tags: string[] };
    p4: { name: string; category: string; desc: string; tags: string[] };
    p5: { name: string; category: string; desc: string; tags: string[] };
    p6: { name: string; category: string; desc: string; tags: string[] };
  };
  svc: {
    eyebrow: string;
    title: string;
    more: string;
    needLabel: string;
    items: { title: string; need: string; desc: string; points: string[] }[];
    stripLabel: string;
    strip: string[];
  };
  proc: {
    eyebrow: string;
    title: string;
    steps: { n: string; title: string; desc: string; points?: string[] }[];
    note: string;
  };
  final: { title: string; sub: string; cta: string; emailLabel: string };
  footer: {
    pitch: string;
    explore: string;
    contact: string;
    region: string;
    based: string;
    langBtn: string;
    rights: string;
    privacy: string;
  };
  start: {
    title: string;
    sub: string;
    optional: string;
    fName: string;
    fCompany: string;
    fEmail: string;
    fPhone: string;
    fDesc: string;
    fDescHelp: string;
    fDescPh: string;
    confidentialTitle: string;
    confidentialItems: string[];
    confidentialNote: string;
    consentPrefix: string;
    consentLinkText: string;
    consentSuffix: string;
    consentError: string;
    cta: string;
    sending: string;
    submitError: string;
    errorSummary: string;
    fieldErrorMessages: {
      required: string;
      too_short: string;
      too_long: string;
      invalid_email: string;
      invalid_locale: string;
      consent_required: string;
      invalid_format: string;
      invalid_value: string;
      invalid: string;
    };
    turnstileFailed: string;
    turnstileUnavailable: string;
    turnstileScriptError: string;
    turnstileRetry: string;
    privacy: string;
    sideTitle: string;
    sidePoints: { t: string; d: string }[];
    prepClarify: string;
    sideNote: string;
  };
  success: {
    badge: string;
    title: string;
    copy: string;
    scheduling: {
      title: string;
      intro: string;
      unavailable: string;
      errorTitle: string;
      errorBody: string;
      retry: string;
      loading: string;
      languageNote: string;
    };
    nextTitle: string;
    next: string[];
    home: string;
    note: string;
  };
  csArrentio: CaseStudyContent;
  csJameel: CaseStudyContent;
  csNazarih: CaseStudyContent;
  csTaskaty: CaseStudyContent;
  csTangleVibe: CaseStudyContent;
  csRentop: CaseStudyContent;
  csKwayes: CaseStudyContent;
  svcp: {
    title: string;
    sub: string;
    fitTitle: string;
    delivTitle: string;
    capsTitle: string;
    procTitle: string;
    relatedLabel: string;
    cta: string;
    cats: {
      name: string;
      desc: string;
      fit: string[];
      deliv: string[];
      caps: string[];
      proc: string[];
      relatedName: string;
      relatedCat: string;
    }[];
    note: string;
  };
  about: {
    title: string;
    sub: string;
    purposeTitle: string;
    purposeCopy: string;
    approachTitle: string;
    approachCopy: string;
    valuesTitle: string;
    values: { t: string; d: string }[];
    modelTitle: string;
    model: { t: string; d: string }[];
    regionTitle: string;
    regionCopy: string;
    ctaTitle: string;
    ctaBtn: string;
  };
  privacy: {
    title: string;
    sub: string;
    updated: string;
    sections: { title: string; body: string; list?: string[] }[];
    processorsTitle: string;
    processors: { name: string; role: string }[];
    processorsNote: string;
    turnstileLinkText: string;
    contactTitle: string;
    contactCopy: string;
    contactEmail: string;
    disclaimer: string;
  };
  intern: {
    label: string;
    warn: string;
    lead: string;
    meta: { k: string; v: string }[];
    s: {
      summary: string;
      assumptions: string;
      users: string;
      platform: string;
      features: string;
      flow: string;
      visual: string;
      screens: string;
      phases: string;
      questions: string;
      risks: string;
      tech: string;
    };
    summary: string;
    assumptions: string[];
    users: string[];
    platform: string;
    features: string[];
    flow: string[];
    visual: string;
    screens: string[];
    phases: { t: string; d: string }[];
    questions: string[];
    risks: string[];
    tech: string[];
  };
}
