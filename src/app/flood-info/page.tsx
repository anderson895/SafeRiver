'use client';

import { useState } from 'react';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Grid from '@mui/material/Grid';
import Stack from '@mui/material/Stack';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import Typography from '@mui/material/Typography';
import Avatar from '@mui/material/Avatar';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Link from 'next/link';
import InfoOutlined from '@mui/icons-material/InfoOutlined';
import BlockOutlined from '@mui/icons-material/BlockOutlined';
import MedicalServicesOutlined from '@mui/icons-material/MedicalServicesOutlined';
import DirectionsRunOutlined from '@mui/icons-material/DirectionsRunOutlined';
import type { SvgIconComponent } from '@mui/icons-material';
import PageHeader from '@/components/common/PageHeader';
import { TABS, ARTICLES, SAFETY_TIPS, type TabId } from '@/content/flood-education';
import { useI18n } from '@/i18n/I18nProvider';
import { pick } from '@/i18n/lang';

const TIP_ICON: Record<string, SvgIconComponent> = {
  info: InfoOutlined,
  block: BlockOutlined,
  kit: MedicalServicesOutlined,
  evacuate: DirectionsRunOutlined,
};

export default function FloodInfoPage() {
  const { dict, lang } = useI18n();
  const [tab, setTab] = useState<TabId>('overview');

  const articles = ARTICLES.filter((a) => a.tab === tab);
  const isTl = lang === 'tl';

  return (
    <>
      <PageHeader title={dict.floodInfo.title} subtitle={dict.app.tagline} />

      <Card sx={{ mb: 3 }}>
        <Tabs
          value={tab}
          onChange={(_, v: TabId) => setTab(v)}
          variant="scrollable"
          scrollButtons="auto"
          // Six tabs overflow on a phone. Scrolling beats wrapping them into an
          // unreadable stack, for the users most likely to be on mobile.
          allowScrollButtonsMobile
          sx={{ borderBottom: '1px solid', borderColor: 'divider', px: 1 }}
        >
          {TABS.map((t) => (
            <Tab key={t.id} value={t.id} label={pick(t.label, lang)} />
          ))}
        </Tabs>

        <CardContent>
          <Stack spacing={4}>
            {articles.map((article) => (
              <Box key={article.id}>
                <Typography variant="h6" sx={{ fontWeight: 700, mb: 1.5 }}>
                  {pick(article.title, lang)}
                </Typography>

                <Stack spacing={1.5}>
                  {article.body.map((para, i) => (
                    <Typography key={i} variant="body1" sx={{ lineHeight: 1.75 }}>
                      {pick(para, lang)}
                    </Typography>
                  ))}
                </Stack>

                {article.callout && (
                  <Alert severity="warning" variant="outlined" sx={{ mt: 2 }}>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                      {pick(article.callout, lang)}
                    </Typography>
                  </Alert>
                )}
              </Box>
            ))}
          </Stack>
        </CardContent>
      </Card>

      <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>
        {dict.floodInfo.safetyTips}
      </Typography>

      <Grid container spacing={2} sx={{ mb: 3 }}>
        {SAFETY_TIPS.map((tip) => {
          const Icon = TIP_ICON[tip.icon] ?? InfoOutlined;
          return (
            <Grid key={tip.id} size={{ xs: 6, md: 3 }}>
              <Card sx={{ height: '100%' }}>
                <CardContent>
                  <Stack spacing={1.25} sx={{ alignItems: 'center', textAlign: 'center' }}>
                    <Avatar sx={{ bgcolor: 'primary.main', width: 44, height: 44 }}>
                      <Icon />
                    </Avatar>
                    <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                      {pick(tip.title, lang)}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {pick(tip.body, lang)}
                    </Typography>
                  </Stack>
                </CardContent>
              </Card>
            </Grid>
          );
        })}
      </Grid>

      <Card sx={{ bgcolor: 'primary.main', color: 'primary.contrastText' }}>
        <CardContent>
          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            spacing={2}
            sx={{ alignItems: { sm: 'center' }, justifyContent: 'space-between' }}
          >
            <Box>
              <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                {isTl ? 'Gusto ninyong makatanggap ng babala?' : 'Want to be warned early?'}
              </Typography>
              <Typography variant="body2" sx={{ opacity: 0.9 }}>
                {isTl
                  ? 'Makakatanggap kayo ng email kapag nagpapakawala ng tubig ang San Roque Dam.'
                  : 'Get an email when San Roque Dam releases water.'}
              </Typography>
            </Box>
            <Button
              component={Link}
              href="/subscribe"
              variant="contained"
              color="inherit"
              sx={{ color: 'primary.main', flexShrink: 0 }}
            >
              {dict.nav.subscribe}
            </Button>
          </Stack>
        </CardContent>
      </Card>
    </>
  );
}
