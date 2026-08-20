/**
 * Flood education content, bilingual.
 *
 * Data-driven rather than hardcoded JSX so it can be translated, reordered and
 * edited without touching components — and so a missing Tagalog string is
 * visible rather than silently falling back to English.
 *
 * Written for San Manuel specifically. Generic flood advice is freely
 * available everywhere and residents ignore it; what is useful here is the
 * local mechanism — the Ambuklao/Binga/San Roque cascade on the Agno — and
 * what to do about it. That specificity is the point.
 */

export interface Bilingual {
  en: string;
  tl: string;
}

export interface Article {
  id: string;
  tab: TabId;
  title: Bilingual;
  body: Bilingual[];
  /** Optional highlighted callout rendered after the body. */
  callout?: Bilingual;
}

export type TabId = 'overview' | 'what' | 'types' | 'before' | 'during' | 'after';

export const TABS: Array<{ id: TabId; label: Bilingual }> = [
  { id: 'overview', label: { en: 'Overview', tl: 'Panimula' } },
  { id: 'what', label: { en: 'What is a Flood?', tl: 'Ano ang Baha?' } },
  { id: 'types', label: { en: 'Types of Floods', tl: 'Mga Uri ng Baha' } },
  { id: 'before', label: { en: 'Before a Flood', tl: 'Bago Bumaha' } },
  { id: 'during', label: { en: 'During a Flood', tl: 'Habang Bumabaha' } },
  { id: 'after', label: { en: 'After a Flood', tl: 'Pagkatapos ng Baha' } },
];

export const ARTICLES: Article[] = [
  // ---------------------------------------------------------------- overview
  {
    id: 'why-san-manuel-floods',
    tab: 'overview',
    title: { en: 'Why San Manuel floods', tl: 'Bakit bumabaha sa San Manuel' },
    body: [
      {
        en: 'San Manuel sits on the Agno River, one of the largest river systems in Luzon. Three dams sit along it: Ambuklao and Binga in Benguet, and San Roque here in San Manuel itself.',
        tl: 'Ang San Manuel ay nasa Ilog Agno, isa sa pinakamalalaking sistema ng ilog sa Luzon. Tatlong dam ang nasa daanan nito: ang Ambuklao at Binga sa Benguet, at ang San Roque dito mismo sa San Manuel.',
      },
      {
        en: 'When heavy rain falls over the Cordillera, Ambuklao and Binga release water downstream. That water collects in San Roque. When San Roque in turn opens its gates, the discharge flows into the Agno and raises water levels across the low-lying barangays.',
        tl: 'Kapag malakas ang ulan sa Cordillera, nagpapakawala ng tubig ang Ambuklao at Binga pababa. Naiipon ang tubig na iyon sa San Roque. Kapag nagbukas naman ng gate ang San Roque, dumadaloy ito sa Agno at tumataas ang tubig sa mabababang barangay.',
      },
      {
        en: 'This is why upstream releases matter here even when it is not raining in San Manuel. Water released in Benguet takes time to arrive — and that time is warning you can act on.',
        tl: 'Kaya mahalaga ang pagpapakawala sa itaas kahit hindi umuulan sa San Manuel. May tagal bago dumating ang tubig mula Benguet — at ang tagal na iyon ay babala na puwede mong pakinabangan.',
      },
    ],
    callout: {
      en: 'The most dangerous situation is heavy rain over San Manuel at the same time as a dam release. Saturated ground cannot absorb more water, so the river rises faster.',
      tl: 'Ang pinakadelikado ay malakas na ulan sa San Manuel na sabay sa pagpapakawala ng dam. Hindi na kayang sumipsip ng basang lupa, kaya mas mabilis tumaas ang ilog.',
    },
  },
  {
    id: 'how-to-use',
    tab: 'overview',
    title: { en: 'How to use this site', tl: 'Paano gamitin ang site na ito' },
    body: [
      {
        en: 'The Dashboard map shows which areas are prone to flooding, based on official Project NOAH hazard mapping. Find your barangay and check its hazard level.',
        tl: 'Ipinapakita ng mapa sa Dashboard kung aling lugar ang madaling bahain, batay sa opisyal na mapa ng Project NOAH. Hanapin ang inyong barangay at tingnan ang antas ng panganib.',
      },
      {
        en: 'Dam Advisory and Water Level show live readings from the PAGASA dam bulletin. Rainfall shows current and forecast rain over San Manuel.',
        tl: 'Ang Abiso sa Dam at Lebel ng Tubig ay nagpapakita ng datos mula sa PAGASA dam bulletin. Ang Pag-ulan naman ay nagpapakita ng kasalukuyan at inaasahang ulan sa San Manuel.',
      },
      {
        en: 'Sign up under Get Alerts to receive an email when conditions become dangerous. You will only be emailed when something changes — not every day.',
        tl: 'Mag-sign up sa Magpa-abiso para makatanggap ng email kapag delikado na ang kalagayan. Ipapadalhan lamang kayo kapag may nagbago — hindi araw-araw.',
      },
    ],
  },

  // ------------------------------------------------------------------ what
  {
    id: 'definition',
    tab: 'what',
    title: { en: 'What is a flood?', tl: 'Ano ang baha?' },
    body: [
      {
        en: 'A flood is an overflow of water that submerges land that is usually dry. It can come from heavy rainfall, a river rising past its banks, or water released from a dam.',
        tl: 'Ang baha ay pag-apaw ng tubig na tumatakip sa lupang karaniwang tuyo. Maaari itong magmula sa malakas na ulan, sa pag-apaw ng ilog, o sa tubig na pinakawalan ng dam.',
      },
      {
        en: 'Floodwater is dangerous at surprisingly shallow depths. Fifteen centimetres of moving water can knock an adult off their feet. Sixty centimetres can carry away most vehicles.',
        tl: 'Delikado ang baha kahit mababaw pa lang. Ang labinlimang sentimetro ng umaagos na tubig ay kayang magpatumba ng matanda. Ang animnapung sentimetro ay kayang tangayin ang halos lahat ng sasakyan.',
      },
    ],
    callout: {
      en: 'You cannot judge depth or current by looking. Water that appears calm can be moving fast underneath, and the road beneath it may have washed away.',
      tl: 'Hindi mo masusukat ang lalim o agos sa pagtingin lamang. Ang tubig na mukhang kalmado ay maaaring mabilis ang agos sa ilalim, at maaaring wala nang kalsada sa ibaba nito.',
    },
  },

  // ----------------------------------------------------------------- types
  {
    id: 'riverine',
    tab: 'types',
    title: { en: 'River flooding', tl: 'Pag-apaw ng ilog' },
    body: [
      {
        en: 'The Agno rises past its banks after sustained rain upstream. This is the most common flood type here and usually develops over hours, which gives time to prepare.',
        tl: 'Umaapaw ang Agno kapag matagal ang ulan sa itaas. Ito ang pinakakaraniwang uri dito at karaniwang unti-unti sa loob ng ilang oras, kaya may panahon pang maghanda.',
      },
    ],
  },
  {
    id: 'dam-release',
    tab: 'types',
    title: { en: 'Dam release flooding', tl: 'Baha mula sa pagpapakawala ng dam' },
    body: [
      {
        en: 'When San Roque opens its spillway gates, a large volume enters the Agno in a short time. Water levels downstream can rise quickly even under clear skies.',
        tl: 'Kapag binuksan ng San Roque ang mga spillway gate, malaking dami ng tubig ang pumapasok sa Agno sa maikling panahon. Mabilis tumataas ang tubig sa ibaba kahit maaliwalas ang panahon.',
      },
      {
        en: 'Dam operators announce releases in advance. This system relays those advisories, and the alert you receive is your time to move.',
        tl: 'May abiso ang mga operator ng dam bago magpakawala. Ipinaparating ng sistemang ito ang mga abisong iyon, at ang babalang matatanggap ninyo ang panahon ninyo para kumilos.',
      },
    ],
  },
  {
    id: 'flash',
    tab: 'types',
    title: { en: 'Flash floods', tl: 'Biglaang baha' },
    body: [
      {
        en: 'Intense rainfall over a short period can flood creeks and low areas within minutes, far faster than the river itself rises. Flash floods give little or no warning.',
        tl: 'Ang napakalakas na ulan sa maikling oras ay kayang bahain ang mga sapa at mabababang lugar sa loob ng ilang minuto, mas mabilis kaysa sa pag-apaw ng ilog. Halos walang babala ang biglaang baha.',
      },
    ],
  },

  // ---------------------------------------------------------------- before
  {
    id: 'prepare',
    tab: 'before',
    title: { en: 'Prepare before the water rises', tl: 'Maghanda bago tumaas ang tubig' },
    body: [
      {
        en: 'Know your barangay hazard level on the Dashboard map, and know the route to your nearest evacuation centre. Decide in advance where you will go.',
        tl: 'Alamin ang antas ng panganib ng inyong barangay sa mapa, at alamin ang daan papunta sa pinakamalapit na evacuation center. Magpasya nang maaga kung saan kayo pupunta.',
      },
      {
        en: 'Prepare a go-bag: drinking water, food that needs no cooking, medicines, flashlight, batteries, phone power bank, and copies of important documents in a sealed plastic bag.',
        tl: 'Maghanda ng go-bag: inuming tubig, pagkaing hindi na kailangang lutuin, gamot, flashlight, baterya, power bank, at kopya ng mahahalagang dokumento sa naka-selyong plastik.',
      },
      {
        en: 'Move livestock, vehicles and valuables to higher ground early. Doing it once, early, is far safer than doing it in the dark while water is rising.',
        tl: 'Ilipat nang maaga sa mataas na lugar ang mga alagang hayop, sasakyan, at mahahalagang gamit. Mas ligtas gawin ito nang maaga kaysa sa dilim habang tumataas na ang tubig.',
      },
    ],
    callout: {
      en: 'Charge your phone and power bank as soon as an advisory is issued. Power often fails before the flood peaks.',
      tl: 'I-charge agad ang telepono at power bank sa oras na may abiso. Madalas nawawalan ng kuryente bago pa umabot sa pinakamataas ang baha.',
    },
  },

  // ---------------------------------------------------------------- during
  {
    id: 'stay-safe',
    tab: 'during',
    title: { en: 'While the flood is happening', tl: 'Habang bumabaha' },
    body: [
      {
        en: 'Do not walk, swim or drive through floodwater. Most flood deaths happen to people who tried to cross.',
        tl: 'Huwag maglakad, lumangoy, o magmaneho sa baha. Karamihan ng namamatay sa baha ay mga sumubok tumawid.',
      },
      {
        en: 'Stay away from the riverbank and from bridges. Banks collapse without warning when the current is strong.',
        tl: 'Lumayo sa pampang ng ilog at sa mga tulay. Biglang gumuguho ang pampang kapag malakas ang agos.',
      },
      {
        en: 'Avoid downed power lines and switch off electricity at the main if water is entering your home. Never touch electrical equipment while standing in water.',
        tl: 'Iwasan ang mga nakalaglag na linya ng kuryente at patayin ang kuryente sa main kapag pumapasok na ang tubig. Huwag hahawak ng kagamitang de-kuryente habang nakatayo sa tubig.',
      },
      {
        en: 'Follow your barangay officials. If they tell you to evacuate, go immediately — do not wait to see how high the water gets.',
        tl: 'Sundin ang inyong barangay officials. Kapag pinalikas kayo, umalis agad — huwag nang hintayin kung gaano kataas ang tubig.',
      },
    ],
  },

  // ----------------------------------------------------------------- after
  {
    id: 'returning',
    tab: 'after',
    title: { en: 'After the water goes down', tl: 'Pagkatapos humupa ang tubig' },
    body: [
      {
        en: 'Return home only when officials say it is safe. Floodwater can undermine roads and foundations without any visible sign.',
        tl: 'Umuwi lamang kapag sinabi ng mga opisyal na ligtas na. Nasisira ng baha ang kalsada at pundasyon kahit walang nakikitang senyales.',
      },
      {
        en: 'Do not drink water from taps or wells that were flooded until authorities confirm it is safe. Boil water for drinking if you are unsure.',
        tl: 'Huwag uminom ng tubig mula sa gripo o balon na binaha hangga\'t hindi sinasabing ligtas. Pakuluan ang tubig kung hindi sigurado.',
      },
      {
        en: 'Wash thoroughly after contact with floodwater, and see a health worker if you develop fever, muscle pain or red eyes. Leptospirosis is common after floods in the Philippines and is treatable when caught early.',
        tl: 'Maghugas nang mabuti pagkatapos madikit sa baha, at magpatingin sa health worker kapag nilagnat, sumakit ang kalamnan, o namula ang mata. Karaniwan ang leptospirosis pagkatapos ng baha sa Pilipinas at nagagamot ito kapag maagang natukoy.',
      },
      {
        en: 'Photograph damage before cleaning up. Your barangay may need it for assistance claims.',
        tl: 'Kunan ng litrato ang mga nasira bago maglinis. Maaaring kailanganin ito ng inyong barangay para sa mga claim ng tulong.',
      },
    ],
  },
];

export interface SafetyTip {
  id: string;
  icon: 'info' | 'block' | 'kit' | 'evacuate';
  title: Bilingual;
  body: Bilingual;
}

export const SAFETY_TIPS: SafetyTip[] = [
  {
    id: 'stay-informed',
    icon: 'info',
    title: { en: 'Stay Informed', tl: 'Manatiling Alam' },
    body: {
      en: 'Monitor alerts and follow official advisories.',
      tl: 'Sundan ang mga babala at opisyal na abiso.',
    },
  },
  {
    id: 'avoid-floodwater',
    icon: 'block',
    title: { en: 'Avoid Floodwaters', tl: 'Iwasan ang Baha' },
    body: {
      en: 'Do not walk or drive through flooded areas.',
      tl: 'Huwag maglakad o magmaneho sa binahang lugar.',
    },
  },
  {
    id: 'emergency-kit',
    icon: 'kit',
    title: { en: 'Prepare an Emergency Kit', tl: 'Maghanda ng Emergency Kit' },
    body: {
      en: 'Water, food, medicine, flashlight, documents.',
      tl: 'Tubig, pagkain, gamot, flashlight, dokumento.',
    },
  },
  {
    id: 'evacuate',
    icon: 'evacuate',
    title: { en: 'Evacuate if Needed', tl: 'Lumikas Kung Kailangan' },
    body: {
      en: 'Leave early when officials tell you to go.',
      tl: 'Umalis agad kapag pinalikas na kayo.',
    },
  },
];
