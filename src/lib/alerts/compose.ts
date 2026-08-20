import type { Severity, Signal, TriggerData } from './types';

export interface Bilingual {
  en: string;
  tl: string;
}

export interface ComposedAlert {
  title: Bilingual;
  body: Bilingual;
  actionAdvice: Bilingual;
}

const SEVERITY_LABEL: Record<Severity, Bilingual> = {
  NONE: { en: 'Normal', tl: 'Normal' },
  INFO: { en: 'All Clear', tl: 'Ligtas Na' },
  ADVISORY: { en: 'Advisory', tl: 'Abiso' },
  WATCH: { en: 'Watch', tl: 'Pagbabantay' },
  WARNING: { en: 'Warning', tl: 'Babala' },
  CRITICAL: { en: 'Critical', tl: 'Kritikal' },
};

/** What a resident should actually DO. The most important line in the email. */
const ACTION: Record<Severity, Bilingual> = {
  NONE: { en: '', tl: '' },
  INFO: {
    en: 'Conditions have returned to normal. Stay informed through official channels.',
    tl: 'Normal na ang kalagayan. Manatiling nakikinig sa mga opisyal na abiso.',
  },
  ADVISORY: {
    en: 'Monitor updates. Prepare an emergency kit and important documents.',
    tl: 'Sundan ang mga update. Maghanda ng emergency kit at mahahalagang dokumento.',
  },
  WATCH: {
    en: 'Be ready to evacuate. Move valuables and livestock to higher ground. Avoid the riverbank.',
    tl: 'Maghandang lumikas. Ilipat sa mataas na lugar ang mga gamit at alagang hayop. Iwasan ang tabing-ilog.',
  },
  WARNING: {
    en: 'Move to higher ground now if you live near the Agno River. Follow your barangay officials.',
    tl: 'Lumipat na sa mataas na lugar kung malapit kayo sa Ilog Agno. Sundin ang inyong barangay officials.',
  },
  CRITICAL: {
    en: 'Evacuate immediately. Do not cross floodwaters. Proceed to the nearest evacuation centre.',
    tl: 'Lumikas kaagad. Huwag tumawid sa baha. Pumunta sa pinakamalapit na evacuation center.',
  },
};

function fmt(value: number | null, unit: string): string {
  if (value == null) return '—';
  return `${Number.isInteger(value) ? value : value.toFixed(2)} ${unit}`;
}

/**
 * Turns a signal into resident-facing bilingual copy.
 *
 * Rainfall messages distinguish observed from forecast rather than blurring
 * them: telling someone it *is* raining hard when it is merely predicted to
 * erodes trust in every later alert.
 */
export function compose(signal: Signal, severity: Severity): ComposedAlert {
  const t: TriggerData = signal.trigger;
  const sev = SEVERITY_LABEL[severity];
  const dam = t.damName ?? 'the dam';
  const damTl = t.damName ?? 'ang dam';

  if (severity === 'INFO') {
    return {
      title: { en: 'All Clear', tl: 'Ligtas Na' },
      body: {
        en: `Conditions for ${signal.category.replace('_', ' ').toLowerCase()} have returned to normal levels.`,
        tl: 'Bumalik na sa normal ang kalagayan.',
      },
      actionAdvice: ACTION.INFO,
    };
  }

  switch (signal.category) {
    case 'DAM_RELEASE':
      return {
        title: {
          en: `${sev.en}: Water release at ${dam}`,
          tl: `${sev.tl}: Pagpapakawala ng tubig sa ${damTl}`,
        },
        body: {
          en: `${dam} is discharging ${fmt(t.value, t.unit)}. Water levels along the Agno River may rise.`,
          tl: `Nagpapakawala ang ${damTl} ng ${fmt(t.value, t.unit)}. Maaaring tumaas ang tubig sa Ilog Agno.`,
        },
        actionAdvice: ACTION[severity],
      };

    case 'WATER_LEVEL': {
      const rising = t.metric === 'rwlDeviation24h';
      return {
        title: {
          en: `${sev.en}: ${dam} reservoir level`,
          tl: `${sev.tl}: Lebel ng tubig sa ${damTl}`,
        },
        body: rising
          ? {
              en: `${dam} rose ${fmt(t.value, t.unit)} in the past 24 hours. A release may follow.`,
              tl: `Tumaas ang ${damTl} ng ${fmt(t.value, t.unit)} sa nakalipas na 24 oras. Maaaring magpakawala ng tubig.`,
            }
          : {
              // Quote the real spilling level (NHWL), never the triggering bound.
              en: t.nhwl != null
                ? `${dam} is at ${fmt(t.value, t.unit)}, against a spilling level of ${fmt(t.nhwl, t.unit)}.`
                : `${dam} is at ${fmt(t.value, t.unit)}.`,
              tl: t.nhwl != null
                ? `Nasa ${fmt(t.value, t.unit)} ang ${damTl}, samantalang ${fmt(t.nhwl, t.unit)} ang lebel ng pag-apaw.`
                : `Nasa ${fmt(t.value, t.unit)} ang ${damTl}.`,
            },
        actionAdvice: ACTION[severity],
      };
    }

    case 'RAINFALL': {
      const isForecast = t.metric === 'rainfallForecast3hMmHr';
      const isAccum = t.metric === 'rainfall24hTotalMm';
      return {
        title: {
          en: `${sev.en}: ${isForecast ? 'Heavy rain expected' : 'Heavy rainfall'} in San Manuel`,
          tl: `${sev.tl}: ${isForecast ? 'Inaasahang malakas na ulan' : 'Malakas na pag-ulan'} sa San Manuel`,
        },
        body: isAccum
          ? {
              en: `${fmt(t.value, t.unit)} of rain is expected over 24 hours. Low-lying areas may flood.`,
              tl: `Inaasahang ${fmt(t.value, t.unit)} na ulan sa loob ng 24 oras. Maaaring bumaha sa mabababang lugar.`,
            }
          : {
              en: `Rainfall ${isForecast ? 'forecast to reach' : 'measured at'} ${fmt(t.value, t.unit)}.`,
              tl: `${isForecast ? 'Inaasahang aabot sa' : 'Nasusukat na'} ${fmt(t.value, t.unit)} ang ulan.`,
            },
        actionAdvice: ACTION[severity],
      };
    }

    default:
      return {
        title: { en: `${sev.en} advisory`, tl: `${sev.tl}` },
        body: {
          en: `${t.metric}: ${fmt(t.value, t.unit)}`,
          tl: `${t.metric}: ${fmt(t.value, t.unit)}`,
        },
        actionAdvice: ACTION[severity],
      };
  }
}

/** Subject line carrying both languages, since we do not know the reader's preference at a glance. */
export function subjectLine(alert: ComposedAlert, severity: Severity): string {
  const tag = severity === 'INFO' ? 'LIGTAS NA/ALL CLEAR' : `${SEVERITY_LABEL[severity].tl.toUpperCase()}/${SEVERITY_LABEL[severity].en.toUpperCase()}`;
  return `[${tag}] ${alert.title.en}`;
}
