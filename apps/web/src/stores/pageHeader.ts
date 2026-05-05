import { atom } from 'nanostores';
import type { Breadcrumb } from '../lib/types';

export interface PageHeaderState {
  title?: string;
  breadcrumbs: Breadcrumb[];
}

// Hydrated by Header.astro from the server-rendered props. Client scripts or
// islands can call `$pageHeader.set(...)` to update the topbar at runtime;
// the value resets on every Astro navigation.
export const $pageHeader = atom<PageHeaderState>({ breadcrumbs: [] });
