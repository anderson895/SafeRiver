'use client';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import Link from '@mui/material/Link';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Alert from '@mui/material/Alert';
import OpenInNewOutlined from '@mui/icons-material/OpenInNewOutlined';
import PageHeader from '@/components/common/PageHeader';
import { SOURCES, LIMITATIONS, PRIVACY } from '@/content/about';
import { useI18n } from '@/i18n/I18nProvider';
import { pick } from '@/i18n/lang';

const CONTACT = process.env.NEXT_PUBLIC_CONTACT_EMAIL ?? 'cyl242110@gmail.com';

export default function AboutPage() {
  const { dict, lang } = useI18n();
  const isTl = lang === 'tl';

  return (
    <>
      <PageHeader title={dict.nav.about} subtitle={dict.app.tagline} />

      <Stack spacing={3}>
        <Card>
          <CardContent>
            <Typography variant="h6" sx={{ fontWeight: 700, mb: 1.5 }}>
              {isTl ? 'Tungkol sa sistemang ito' : 'About this system'}
            </Typography>
            <Typography variant="body1" sx={{ lineHeight: 1.75 }}>
              {isTl
                ? 'Pinagsasama-sama ng sistemang ito ang opisyal na impormasyon tungkol sa baha para sa mga komunidad sa Ilog Agno sa San Manuel, Pangasinan: mapa ng panganib, datos ng pag-ulan, at abiso tungkol sa lebel ng tubig at pagpapakawala sa dam.'
                : 'This system brings together official flood information for the Agno River communities of San Manuel, Pangasinan: hazard mapping, rainfall data, and reservoir level and dam release advisories.'}
            </Typography>
            <Typography variant="body1" sx={{ lineHeight: 1.75, mt: 1.5 }}>
              {isTl
                ? 'Hindi ito gumagawa ng sariling simulasyon ng baha. Ipinaparating nito ang impormasyong galing sa PAGASA, Project NOAH at iba pang opisyal na pinagmulan, at pinapadali ang pag-abot nito sa mga residente.'
                : 'It does not perform its own flood simulation. It relays information produced by PAGASA, Project NOAH and other official sources, and makes it easier for residents to reach.'}
            </Typography>
          </CardContent>
        </Card>

        {/* Sources, with licences, because two of them legally require it. */}
        <Card>
          <CardContent>
            <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>
              {isTl ? 'Pinagmulan ng datos' : 'Data sources'}
            </Typography>

            <Stack spacing={2}>
              {SOURCES.map((s, i) => (
                <Box key={s.name}>
                  {i > 0 && <Divider sx={{ mb: 2 }} />}
                  <Stack
                    direction="row"
                    spacing={1}
                    sx={{ alignItems: 'center', flexWrap: 'wrap', mb: 0.5 }}
                    useFlexGap
                  >
                    <Link
                      href={s.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      sx={{ fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 0.5 }}
                    >
                      {s.name}
                      <OpenInNewOutlined sx={{ fontSize: 14 }} />
                    </Link>
                    <Chip size="small" variant="outlined" label={s.licence} sx={{ height: 20, fontSize: 11 }} />
                  </Stack>
                  <Typography variant="body2" color="text.secondary">
                    {pick(s.role, lang)}
                  </Typography>
                </Box>
              ))}
            </Stack>

            <Alert severity="info" variant="outlined" sx={{ mt: 3 }}>
              <Typography variant="caption">
                {isTl
                  ? 'Ang mapa ng panganib sa baha ay ipinamamahagi sa ilalim ng ODbL v1.0, tulad ng orihinal. Kinakailangan ang pagkilala sa Project NOAH / UP NOAH Center, at anumang derivative ay dapat manatiling ODbL.'
                  : 'The flood hazard layers are redistributed under ODbL v1.0, as the original requires. Attribution to Project NOAH / UP NOAH Center is required, and any further derivative must remain under ODbL.'}
              </Typography>
            </Alert>
          </CardContent>
        </Card>

        {/* Stated publicly and in detail. A hazard system that hides what it
            does not know is more dangerous than one that says so. */}
        <Card sx={{ borderColor: 'warning.main' }}>
          <CardContent>
            <Typography variant="h6" sx={{ fontWeight: 700, mb: 0.5 }}>
              {isTl ? 'Mga limitasyon' : 'Limitations'}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2.5 }}>
              {isTl
                ? 'Bawat bilang dito ay sinukat mismo sa datos na ginagamit ng sistema.'
                : 'Every figure here was measured against the data this system actually uses.'}
            </Typography>

            <Stack spacing={2.5}>
              {LIMITATIONS.map((l) => (
                <Box key={l.id}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 0.5 }}>
                    {pick(l.title, lang)}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.7 }}>
                    {pick(l.body, lang)}
                  </Typography>
                </Box>
              ))}
            </Stack>
          </CardContent>
        </Card>

        <Card>
          <CardContent>
            <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>
              {pick(PRIVACY.title, lang)}
            </Typography>
            <Stack spacing={1.75}>
              {PRIVACY.points.map((p, i) => (
                <Typography key={i} variant="body2" sx={{ lineHeight: 1.75 }}>
                  {pick(p, lang)}
                </Typography>
              ))}
            </Stack>
            <Divider sx={{ my: 2 }} />
            <Typography variant="body2">
              {isTl ? 'Makipag-ugnayan: ' : 'Contact: '}
              <Link href={`mailto:${CONTACT}`}>{CONTACT}</Link>
            </Typography>
          </CardContent>
        </Card>

        <Typography variant="caption" color="text.secondary">
          {isTl
            ? 'Undergraduate thesis project. Hindi ito opisyal na sistema ng gobyerno. Sa emerhensiya, sundin ang inyong barangay officials at ang MDRRMO.'
            : 'Undergraduate thesis project. This is not an official government system. In an emergency, follow your barangay officials and the MDRRMO.'}
        </Typography>
      </Stack>
    </>
  );
}
