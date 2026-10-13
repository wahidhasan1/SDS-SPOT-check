import {
  LayoutDashboard, BookOpen, Library, ScanText, GraduationCap, ClipboardList, Phone, Swords, BarChart3, User, Settings, Crown, Shield,
  type LucideIcon,
} from 'lucide-react';

export interface NavItem { to: string; label: string; icon: LucideIcon }
export interface NavSection { title: string; items: NavItem[] }

export const NAV: NavSection[] = [
  { title: '', items: [{ to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard }] },
  {
    title: 'Learn',
    items: [
      { to: '/grammar', label: 'Grammar', icon: BookOpen },
      { to: '/vocabulary', label: 'Vocabulary', icon: Library },
      { to: '/reader', label: 'Book reader', icon: ScanText },
    ],
  },
  {
    title: 'IELTS',
    items: [
      { to: '/ielts', label: 'IELTS practice', icon: GraduationCap },
      { to: '/ielts/mock', label: 'Mock tests', icon: ClipboardList },
    ],
  },
  {
    title: 'Speak & play',
    items: [
      { to: '/speak', label: 'Voice practice', icon: Phone },
      { to: '/battles', label: 'Battles', icon: Swords },
    ],
  },
  {
    title: 'You',
    items: [
      { to: '/progress', label: 'Progress', icon: BarChart3 },
      { to: '/profile', label: 'Profile', icon: User },
      { to: '/settings', label: 'Settings', icon: Settings },
      { to: '/premium', label: 'Premium', icon: Crown },
    ],
  },
];

export const ADMIN_ITEM: NavItem = { to: '/admin', label: 'Admin', icon: Shield };

export const MOBILE_TABS: NavItem[] = [
  { to: '/dashboard', label: 'Home', icon: LayoutDashboard },
  { to: '/grammar', label: 'Learn', icon: BookOpen },
  { to: '/ielts', label: 'IELTS', icon: GraduationCap },
  { to: '/speak', label: 'Speak', icon: Phone },
];
