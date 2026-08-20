/**
 * English is the source of truth for the translation shape.
 *
 * `tl.ts` is typed as `Dictionary`, so adding a key here without adding its
 * Tagalog counterpart is a COMPILE ERROR rather than a string that silently
 * renders in the wrong language. That guarantee is the whole reason this is
 * hand-rolled instead of using i18next — worth stating in the thesis.
 */
export const en = {
  app: {
    name: 'San Manuel Flood Information System',
    shortName: 'SafeRiver',
    tagline: 'Agno River — San Manuel, Pangasinan',
  },
  nav: {
    dashboard: 'Dashboard',
    rainfall: 'Rainfall',
    waterLevel: 'Water Level',
    damAdvisory: 'Dam Advisory',
    floodInfo: 'Flood Information',
    alerts: 'Alerts',
    subscribe: 'Get Alerts',
    about: 'About',
  },
  dashboard: {
    mapTitle: 'Interactive Flood Hazard Map',
    latestAlerts: 'Latest Alerts',
    noAlerts: 'No active alerts',
    noAlertsHint: 'Conditions are being monitored. You will see advisories here.',
    returnPeriod: 'Flood scenario',
    returnPeriodHint: 'A 100-year flood is the most severe mapped scenario.',
  },
  hazard: {
    legend: 'Flood hazard level',
    low: 'Low (0–0.5 m)',
    medium: 'Medium (0.5–1.5 m)',
    high: 'High (more than 1.5 m)',
    none: 'No mapped flood hazard here',
    notMapped: 'Not mapped',
    dataGapNotice:
      'Barangays San Roque, Lapalo and Narra have no flood hazard mapping — roughly two-thirds of San Manuel by area. They are shown hatched. Absence of colour there means NOT SURVEYED, not safe.',
  },
  water: {
    title: 'Water Level Monitoring',
    selectStation: 'Select dam',
    currentLevel: 'Current Water Level',
    normalLevel: 'Normal Level',
    alertLevel: 'Alert Level',
    criticalLevel: 'Critical Level',
    rising: 'Rising',
    falling: 'Falling',
    steady: 'Steady',
    trendTitle: 'Reservoir Water Level Trend',
    riverCondition: 'Agno River Condition',
    discharge: 'River discharge',
  },
  dam: {
    title: 'Dam Advisory',
    currentRelease: 'Current Release',
    gatesOpen: 'Gates open',
    trend: 'Trend',
    lastUpdated: 'Last updated',
    releaseHistory: 'Release History',
    normalOperation: 'Normal Operation',
    floodWatch: 'Flood Watch',
    releasing: 'Releasing Water',
    notReleasing: 'Not releasing',
    ofNhwl: 'of spilling level',
  },
  rainfall: {
    title: 'Rainfall Information',
    mapTab: 'Rainfall Map',
    dataTab: 'Rainfall Data',
    current: 'Current Rainfall',
    forecast: 'Rainfall Forecast',
    next24h: 'Next 24 Hours',
    intensity: 'Intensity',
    total24h: '24-hour total',
    viewDetailed: 'View detailed data',
  },
  intensity: {
    NONE: 'No rain',
    LIGHT: 'Light rain',
    MODERATE: 'Moderate rain',
    HEAVY: 'Heavy rain',
    INTENSE: 'Intense rain',
    TORRENTIAL: 'Torrential rain',
  },
  warning: {
    NONE: 'No warning',
    YELLOW: 'Yellow Warning',
    ORANGE: 'Orange Warning',
    RED: 'Red Warning',
  },
  severity: {
    INFO: 'Information',
    ADVISORY: 'Advisory',
    WATCH: 'Watch',
    WARNING: 'Warning',
    CRITICAL: 'Critical',
  },
  floodInfo: {
    title: 'Flood Information',
    overview: 'Overview',
    whatIsFlood: 'What is a Flood?',
    types: 'Types of Floods',
    before: 'Before a Flood',
    during: 'During a Flood',
    after: 'After a Flood',
    safetyTips: 'Flood Safety Tips',
    learnMore: 'Learn more',
  },
  common: {
    lastUpdated: 'Last updated {time}',
    source: 'Source',
    loading: 'Loading…',
    noData: 'No data available yet',
    error: 'Something went wrong',
    retry: 'Try again',
    staleWarning: 'This data is more than {hours} hours old and may be out of date.',
    meters: 'm',
    cms: 'CMS',
    mmPerHour: 'mm/hr',
    viewAll: 'View all',
  },
  a11y: {
    openMenu: 'Open navigation menu',
    closeMenu: 'Close navigation menu',
    language: 'Language',
    mainNav: 'Main navigation',
    alertCount: '{count} active alerts',
  },
} as const;

/**
 * Widens every leaf from its literal type to `string`, recursively, while
 * preserving the key structure.
 *
 * Without this, `as const` above would make each value a literal type and a
 * translation would have to equal the English text verbatim to compile — the
 * exact opposite of what we want. With it, the contract is purely structural:
 * every key must exist, with the same nesting, but the text is free.
 */
type Translations<T> = {
  -readonly [K in keyof T]: T[K] extends string ? string : Translations<T[K]>;
};

/** Structural contract every locale must satisfy. */
export type Dictionary = Translations<typeof en>;
