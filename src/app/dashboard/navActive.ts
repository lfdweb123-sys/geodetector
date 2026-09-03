export function isNavItemActive(pathname: string, href: string): boolean {
  return href === '/dashboard' ? pathname === '/dashboard' : pathname.startsWith(href);
}
