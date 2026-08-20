import DashboardOutlined from '@mui/icons-material/DashboardOutlined';
import WaterDropOutlined from '@mui/icons-material/WaterDropOutlined';
import ShowChartOutlined from '@mui/icons-material/ShowChartOutlined';
import WavesOutlined from '@mui/icons-material/WavesOutlined';
import MenuBookOutlined from '@mui/icons-material/MenuBookOutlined';
import NotificationsActiveOutlined from '@mui/icons-material/NotificationsActiveOutlined';
import type { SvgIconComponent } from '@mui/icons-material';
import type { Dictionary } from '@/i18n/dictionaries/en';

export interface NavItem {
  href: string;
  icon: SvgIconComponent;
  /** Resolves the label from the active dictionary, so nav is translated too. */
  label: (d: Dictionary) => string;
}

export const NAV_ITEMS: NavItem[] = [
  { href: '/', icon: DashboardOutlined, label: (d) => d.nav.dashboard },
  { href: '/rainfall', icon: WaterDropOutlined, label: (d) => d.nav.rainfall },
  { href: '/water-level', icon: ShowChartOutlined, label: (d) => d.nav.waterLevel },
  { href: '/dam-advisory', icon: WavesOutlined, label: (d) => d.nav.damAdvisory },
  { href: '/flood-info', icon: MenuBookOutlined, label: (d) => d.nav.floodInfo },
  { href: '/alerts', icon: NotificationsActiveOutlined, label: (d) => d.nav.alerts },
];

export const DRAWER_WIDTH = 248;
