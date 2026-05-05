import appConfig from '../../app-config.json';
import type { NavItem } from './types';

export type { NavItem };

interface AppConfig {
  product: {
    name: string;
    version: string;
  };
  owner: {
    firstName: string;
    lastName: string;
    email: string;
  };
  navigation: {
    top: NavItem[];
    bottom: NavItem[];
  };
  createdAt: string;
}

export function getConfig(): AppConfig {
  return appConfig as AppConfig;
}

export function getNavItems(): NavItem[] {
  const items = getConfig().navigation.top;
  if (!items.length || items[0].label !== 'Home' || items[0].href !== '/') {
    return [{ label: 'Home', href: '/', icon: 'home' }, ...items];
  }
  return items;
}

export function getFooterNavItems(): NavItem[] {
  return getConfig().navigation.bottom;
}

export function getProductName(): string {
  return getConfig().product.name;
}

export function getProductVersion(): string {
  return getConfig().product.version;
}

export function getOwner(): AppConfig['owner'] {
  return getConfig().owner;
}

export interface RouteInfo {
  href: string;
  label: string;
  parent?: { label: string; href?: string };
}

export function getAllRoutes(): RouteInfo[] {
  const config = getConfig();
  const routes: RouteInfo[] = [];
  const allItems = [...config.navigation.top, ...config.navigation.bottom];

  for (const item of allItems) {
    if (item.href && item.href !== '/') {
      routes.push({ href: item.href, label: item.label });
    }
    if (item.children) {
      for (const child of item.children) {
        if (child.href) {
          routes.push({
            href: child.href,
            label: child.label,
            parent: { label: item.label, href: item.href },
          });
        }
      }
    }
  }

  return routes;
}

export function getRouteInfo(pathname: string): RouteInfo | undefined {
  const normalized = pathname.replace(/\/+$/, '') || '/';
  return getAllRoutes().find(
    (r) => r.href === normalized || r.href === pathname,
  );
}

export function getBreadcrumbs(pathname: string): { label: string; href?: string }[] {
  const crumbs: { label: string; href?: string }[] = [{ label: 'Home', href: '/' }];
  if (pathname === '/') return crumbs;

  const route = getRouteInfo(pathname);
  if (!route) return crumbs;

  if (route.parent) {
    crumbs.push({ label: route.parent.label, href: route.parent.href });
  }
  crumbs.push({ label: route.label });
  return crumbs;
}

/**
 * Bundles the common data every SidebarLayout page needs.
 * Eliminates the repeated 5-import / 5-variable boilerplate from pages.
 *
 * Extended to surface the onboarded user's Organization + Space context
 * (populated by the middleware via getAccountContext) so the sidebar and
 * dashboard render real names instead of a "Main Project" placeholder.
 */
export function getPageContext(locals: App.Locals) {
  const user = locals.user;
  const account = locals.account;

  return {
    navItems: getNavItems(),
    footerNavItems: getFooterNavItems(),
    productName: getProductName(),
    productVersion: getProductVersion(),
    user: user ? { name: user.name, email: user.email } : { name: 'Guest', email: '' },
    organization: account?.organization ?? null,
    currentSpace: account?.space?.name ?? null,
    spaces: account?.spaces ?? [],
  };
}
