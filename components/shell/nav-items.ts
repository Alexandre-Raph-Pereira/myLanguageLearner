import {
  BookOpen,
  ClipboardCheck,
  House,
  Languages,
  Settings,
  type LucideIcon,
} from "lucide-react";

export type NavItem = { href: string; label: string; icon: LucideIcon };

export const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "Home", icon: House },
  { href: "/words", label: "Words", icon: Languages },
  { href: "/grammar", label: "Grammar", icon: BookOpen },
  { href: "/tests", label: "Tests", icon: ClipboardCheck },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function isActive(pathname: string, href: string): boolean {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}
