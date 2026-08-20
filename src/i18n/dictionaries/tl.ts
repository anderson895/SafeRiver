import type { Dictionary } from './en';

/**
 * Tagalog / Filipino.
 *
 * Annotated as `Dictionary`, so TypeScript rejects this file the moment a key
 * from `en.ts` is missing or misspelled. Translations cannot silently drift.
 *
 * Register note: this is written for residents, not for officials. Where a
 * technical term is genuinely more recognisable in English (CMS, dam), it is
 * kept in English rather than forced into an unfamiliar Tagalog coinage.
 */
export const tl: Dictionary = {
  app: {
    name: 'Sistema ng Impormasyon sa Baha ng San Manuel',
    shortName: 'SafeRiver',
    tagline: 'Ilog Agno — San Manuel, Pangasinan',
  },
  nav: {
    dashboard: 'Dashboard',
    rainfall: 'Pag-ulan',
    waterLevel: 'Lebel ng Tubig',
    damAdvisory: 'Abiso sa Dam',
    floodInfo: 'Tungkol sa Baha',
    alerts: 'Mga Babala',
    subscribe: 'Magpa-abiso',
    about: 'Tungkol Dito',
  },
  dashboard: {
    mapTitle: 'Interaktibong Mapa ng Panganib sa Baha',
    latestAlerts: 'Pinakabagong Babala',
    noAlerts: 'Walang aktibong babala',
    noAlertsHint: 'Patuloy na binabantayan ang kalagayan. Dito lalabas ang mga abiso.',
    returnPeriod: 'Sitwasyon ng baha',
    returnPeriodHint: 'Ang 100-taon ay ang pinakamalalang sitwasyong nakamapa.',
  },
  hazard: {
    legend: 'Antas ng panganib sa baha',
    low: 'Mababa (0–0.5 m)',
    medium: 'Katamtaman (0.5–1.5 m)',
    high: 'Mataas (higit 1.5 m)',
    none: 'Walang nakamapang panganib sa baha dito',
    dataGapNotice:
      'Hindi sakop ng mapa ang hilagang mataas na bahagi ng San Manuel. Ang kawalan ng kulay doon ay nangangahulugang "hindi nakamapa", hindi "ligtas".',
  },
  water: {
    title: 'Pagsubaybay sa Lebel ng Tubig',
    selectStation: 'Pumili ng dam',
    currentLevel: 'Kasalukuyang Lebel ng Tubig',
    normalLevel: 'Normal na Lebel',
    alertLevel: 'Lebel ng Alerto',
    criticalLevel: 'Kritikal na Lebel',
    rising: 'Tumataas',
    falling: 'Bumababa',
    steady: 'Walang pagbabago',
    trendTitle: 'Takbo ng Lebel ng Tubig sa Reservoir',
    riverCondition: 'Kalagayan ng Ilog Agno',
    discharge: 'Daloy ng ilog',
  },
  dam: {
    title: 'Abiso sa Dam',
    currentRelease: 'Kasalukuyang Pinapakawalan',
    gatesOpen: 'Bukas na gate',
    trend: 'Takbo',
    lastUpdated: 'Huling update',
    releaseHistory: 'Kasaysayan ng Pagpapakawala',
    normalOperation: 'Normal na Operasyon',
    floodWatch: 'Binabantayan sa Baha',
    releasing: 'Nagpapakawala ng Tubig',
    notReleasing: 'Walang pinapakawalan',
    ofNhwl: 'ng lebel ng pag-apaw',
  },
  rainfall: {
    title: 'Impormasyon sa Pag-ulan',
    mapTab: 'Mapa ng Ulan',
    dataTab: 'Datos ng Ulan',
    current: 'Kasalukuyang Pag-ulan',
    forecast: 'Forecast ng Pag-ulan',
    next24h: 'Susunod na 24 Oras',
    intensity: 'Lakas',
    total24h: 'Kabuuan sa 24 oras',
    viewDetailed: 'Tingnan ang detalyadong datos',
  },
  intensity: {
    NONE: 'Walang ulan',
    LIGHT: 'Mahinang ulan',
    MODERATE: 'Katamtamang ulan',
    HEAVY: 'Malakas na ulan',
    INTENSE: 'Napakalakas na ulan',
    TORRENTIAL: 'Sobrang lakas na ulan',
  },
  warning: {
    NONE: 'Walang babala',
    YELLOW: 'Dilaw na Babala',
    ORANGE: 'Kahel na Babala',
    RED: 'Pulang Babala',
  },
  severity: {
    INFO: 'Impormasyon',
    ADVISORY: 'Abiso',
    WATCH: 'Pagbabantay',
    WARNING: 'Babala',
    CRITICAL: 'Kritikal',
  },
  floodInfo: {
    title: 'Tungkol sa Baha',
    overview: 'Panimula',
    whatIsFlood: 'Ano ang Baha?',
    types: 'Mga Uri ng Baha',
    before: 'Bago Bumaha',
    during: 'Habang Bumabaha',
    after: 'Pagkatapos ng Baha',
    safetyTips: 'Mga Payo sa Kaligtasan',
    learnMore: 'Alamin pa',
  },
  common: {
    lastUpdated: 'Huling update {time}',
    source: 'Pinagmulan',
    loading: 'Naglo-load…',
    noData: 'Wala pang datos',
    error: 'May naganap na problema',
    retry: 'Subukan ulit',
    staleWarning: 'Mahigit {hours} oras na ang datos na ito at maaaring luma na.',
    meters: 'm',
    cms: 'CMS',
    mmPerHour: 'mm/oras',
    viewAll: 'Tingnan lahat',
  },
  a11y: {
    openMenu: 'Buksan ang menu',
    closeMenu: 'Isara ang menu',
    language: 'Wika',
    mainNav: 'Pangunahing nabigasyon',
    alertCount: '{count} aktibong babala',
  },
};
