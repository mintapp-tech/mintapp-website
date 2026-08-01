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
    insights: string;
    start: string;
    lang: string;
  };
  hero: {
    eyebrow: string;
    title: string;
    sub: string;
    cta1: string;
    cta2: string;
    marks: string[];
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
    s1: { title: string; desc: string; items: string[] };
    s2: { title: string; desc: string; items: string[] };
    stripLabel: string;
    strip: string[];
  };
  proc: {
    eyebrow: string;
    title: string;
    steps: { n: string; title: string; desc: string }[];
  };
  diff: {
    eyebrow: string;
    title: string;
    copy: string;
    cta: string;
    note: string;
    steps: { n: string; title: string; desc: string }[];
  };
  ins: {
    title: string;
    all: string;
    read: string;
    items: { cat: string; title: string; blurb: string }[];
  };
  final: { title: string; sub: string; cta: string };
  footer: {
    pitch: string;
    explore: string;
    contact: string;
    region: string;
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
    fFile: string;
    fFileHint: string;
    fDate: string;
    fTime: string;
    cta: string;
    privacy: string;
    sideTitle: string;
    sidePoints: { t: string; d: string }[];
    sideNote: string;
    pickDate: string;
    pickTime: string;
  };
  success: {
    badge: string;
    title: string;
    copy: string;
    meeting: string;
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
}
