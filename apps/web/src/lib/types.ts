/** Shared type definitions used across layouts, components, and config. */

export interface NavItem {
  label: string;
  href?: string;
  icon: string;
  badge?: string;
  badges?: Array<"new" | string>;
  isTitle?: boolean;
  isDisabled?: boolean;
  isDimmed?: boolean;
  children?: NavItem[];
}

export interface UserInfo {
  name: string;
  email: string;
  avatar?: string;
  role?: string;
}

export interface Breadcrumb {
  label: string;
  href?: string;
}
