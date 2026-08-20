import type { Bilingual } from './flood-education';

/**
 * Content for the About page.
 *
 * The limitations section is deliberately specific and deliberately public.
 * Every figure in it was measured against the delivered data during
 * development, and several contradict what the upstream sources claim. A
 * hazard system that hides what it does not know is more dangerous than one
 * that states it plainly.
 */

export interface Source {
  name: string;
  role: Bilingual;
  licence: string;
  url: string;
}

export const SOURCES: Source[] = [
  {
    name: 'Project NOAH / UP NOAH Center',
    role: {
      en: 'Flood hazard maps for 5-, 25- and 100-year return periods',
      tl: 'Mapa ng panganib sa baha para sa 5, 25 at 100 taon',
    },
    licence: 'ODbL v1.0',
    url: 'https://noah.up.edu.ph/',
  },
  {
    name: 'DOST-PAGASA',
    role: {
      en: 'Daily dam bulletin — reservoir levels, gate openings and discharge for Ambuklao, Binga and San Roque',
      tl: 'Araw-araw na dam bulletin — lebel ng tubig, bukas na gate at pinapakawala sa Ambuklao, Binga at San Roque',
    },
    licence: 'Philippine government public information',
    url: 'https://www.pagasa.dost.gov.ph/flood',
  },
  {
    name: 'Open-Meteo',
    role: {
      en: 'Hourly rainfall forecast, and Agno River discharge from the GloFAS flood model',
      tl: 'Oras-oras na forecast ng ulan, at daloy ng Ilog Agno mula sa GloFAS',
    },
    licence: 'CC BY 4.0',
    url: 'https://open-meteo.com/',
  },
  {
    name: 'RainViewer',
    role: { en: 'Rain radar imagery', tl: 'Larawan ng radar ng ulan' },
    licence: 'Public tile service',
    url: 'https://www.rainviewer.com/',
  },
  {
    name: 'GADM v4.1',
    role: {
      en: 'Municipal and barangay boundaries',
      tl: 'Hangganan ng bayan at barangay',
    },
    licence: 'Free for non-commercial use',
    url: 'https://gadm.org/',
  },
  {
    name: 'OpenFreeMap / OpenStreetMap',
    role: { en: 'Base map', tl: 'Batayang mapa' },
    licence: 'ODbL',
    url: 'https://www.openstreetmap.org/copyright',
  },
];

export interface Limitation {
  id: string;
  title: Bilingual;
  body: Bilingual;
}

export const LIMITATIONS: Limitation[] = [
  {
    id: 'unmapped',
    title: {
      en: 'Two-thirds of San Manuel has no hazard mapping',
      tl: 'Dalawang-katlo ng San Manuel ay walang mapa ng panganib',
    },
    body: {
      en: 'Barangays San Roque, Lapalo and Narra — 78.8 of the municipality\'s 118.9 km² — are not covered by the Project NOAH survey. Measured by sampling a 130 m grid inside each barangay, coverage is 0%, 3% and 1% respectively. They are hatched on the map. Absence of colour there means the area was never surveyed, not that it is safe.',
      tl: 'Ang Barangay San Roque, Lapalo at Narra — 78.8 sa 118.9 km² ng bayan — ay hindi sakop ng survey ng Project NOAH. Sinukat sa pamamagitan ng 130 m grid sa bawat barangay, ang saklaw ay 0%, 3% at 1%. Nakaguhit-guhit ang mga ito sa mapa. Ang kawalan ng kulay doon ay nangangahulugang hindi ito nasukat, hindi na ligtas ito.',
    },
  },
  {
    id: 'resolution',
    title: {
      en: 'Hazard mapping has a 30-metre resolution',
      tl: 'Ang mapa ng panganib ay may 30-metrong resolusyon',
    },
    body: {
      en: 'Measured from the delivered geometry: 97.5% of 35,322 polygon segments are exactly 30.0 m. The system indicates whether an area is at risk, not whether a particular house is. The stepped edges visible when zoomed in are the real shape of the data and have not been smoothed, because smoothing would imply precision the survey does not have.',
      tl: 'Sinukat mula mismo sa datos: 97.5% ng 35,322 segment ay eksaktong 30.0 m. Ipinapakita ng sistema kung ang isang lugar ay nasa panganib, hindi ang isang partikular na bahay. Ang hagdan-hagdang gilid kapag naka-zoom ay ang tunay na hugis ng datos at hindi pinakinis, dahil magpapahiwatig iyon ng katumpakang wala naman.',
    },
  },
  {
    id: 'dam-frequency',
    title: {
      en: 'Dam readings are published once a day',
      tl: 'Isang beses sa isang araw inilalathala ang datos ng dam',
    },
    body: {
      en: 'PAGASA publishes its dam bulletin at about 08:00 daily. This system polls every 30 minutes so that a new bulletin is picked up quickly, but it cannot show a level that PAGASA has not published. Trend charts therefore have one point per day, and a sudden release between bulletins will not appear until the next one — or until a DRRM officer posts a manual advisory.',
      tl: 'Inilalathala ng PAGASA ang dam bulletin tuwing mga alas-8:00 ng umaga. Sinusuri ito ng sistema kada 30 minuto para mabilis makuha ang bago, ngunit hindi nito maipapakita ang hindi pa inilalathala. Kaya isang punto lang kada araw ang chart, at ang biglaang pagpapakawala sa pagitan ng bulletin ay hindi lilitaw hanggang sa susunod — o hanggang may mag-post na abiso ang DRRM.',
    },
  },
  {
    id: 'no-river-gauge',
    title: {
      en: 'There is no river gauge reading for the Agno at San Manuel',
      tl: 'Walang sukat ng ilog sa Agno sa San Manuel',
    },
    body: {
      en: 'No free public source publishes river stage at the municipality. The Water Level page therefore shows reservoir elevation from the dam bulletin, with Normal, Alert and Critical derived from the rule curve and the published spilling level. The Agno River discharge shown alongside is modelled by GloFAS at roughly 5 km resolution, not measured on the ground.',
      tl: 'Walang libreng pampublikong pinagmulan ng lebel ng ilog sa bayan. Kaya ang Lebel ng Tubig ay nagpapakita ng lebel sa reservoir mula sa dam bulletin, at ang Normal, Alerto at Kritikal ay hango sa rule curve at sa inilathalang lebel ng pag-apaw. Ang daloy ng Ilog Agno sa tabi nito ay modelo ng GloFAS sa humigit-kumulang 5 km na resolusyon, hindi aktwal na sinukat.',
    },
  },
  {
    id: 'thresholds',
    title: {
      en: 'Alert thresholds are provisional',
      tl: 'Pansamantala pa ang mga threshold ng babala',
    },
    body: {
      en: 'The levels at which this system raises an advisory, watch or warning were derived from the published spilling levels and discharge figures. They are a design decision by this project, not an official standard, and are pending validation with the San Manuel MDRRMO.',
      tl: 'Ang mga antas kung kailan naglalabas ng abiso o babala ang sistema ay hango sa inilathalang lebel ng pag-apaw at datos ng pagpapakawala. Desisyon ito ng proyektong ito, hindi opisyal na pamantayan, at naghihintay pa ng pagpapatunay mula sa MDRRMO ng San Manuel.',
    },
  },
  {
    id: 'boundary',
    title: {
      en: 'Boundary data is generalised',
      tl: 'Heneralisado ang datos ng hangganan',
    },
    body: {
      en: 'GADM places San Manuel at 119.1 km² against an official 129.18 km². Place labels come from OpenStreetMap while boundaries come from GADM, and the two are not co-registered, so a village label may not sit inside the barangay polygon you would expect.',
      tl: 'Inilalagay ng GADM ang San Manuel sa 119.1 km² samantalang 129.18 km² ang opisyal. Ang mga pangalan ng lugar ay mula sa OpenStreetMap habang ang hangganan ay mula sa GADM, at hindi magkatugma ang dalawa — kaya maaaring hindi nasa loob ng inaasahang barangay ang isang label.',
    },
  },
];

export const PRIVACY: { title: Bilingual; points: Bilingual[] } = {
  title: { en: 'Privacy notice', tl: 'Paunawa sa privacy' },
  points: [
    {
      en: 'If you subscribe to alerts, we store your email address, your chosen language, your barangay if you provide one, and the date, time and IP address of your consent. The consent record is kept because the Data Privacy Act of 2012 (RA 10173) requires us to be able to demonstrate that you agreed.',
      tl: 'Kung magpapa-abiso kayo, iniimbak namin ang inyong email, napiling wika, barangay kung ibibigay ninyo, at ang petsa, oras at IP address ng inyong pagpayag. Iniingatan ang talaan ng pagpayag dahil hinihingi ng Data Privacy Act of 2012 (RA 10173) na mapatunayan naming sumang-ayon kayo.',
    },
    {
      en: 'Your address is used only to send flood alerts. It is never sold, shared or used for anything else. Alerts are sent to each subscriber individually, so no subscriber ever sees another subscriber\'s address.',
      tl: 'Ginagamit lamang ang inyong email para sa mga babala sa baha. Hindi ito ibinebenta, ibinabahagi, o ginagamit sa iba. Isahan ang pagpapadala, kaya walang subscriber na nakakakita ng email ng iba.',
    },
    {
      en: 'You can unsubscribe at any time using the link in every email. Unsubscribing stops all messages immediately.',
      tl: 'Maaari kayong mag-unsubscribe anumang oras gamit ang link sa bawat email. Titigil agad ang lahat ng mensahe.',
    },
    {
      en: 'You may request a copy of your data or its permanent deletion. Contact the address below and it will be actioned.',
      tl: 'Maaari kayong humingi ng kopya ng inyong datos o ng permanenteng pagbura nito. Makipag-ugnayan sa email sa ibaba at aaksyunan ito.',
    },
  ],
};
