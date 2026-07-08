/*
 * Local shim so the schema components synced verbatim from ui-only
 * (apps/design/src/components/schema/*) can keep their upstream-relative
 * `../../lib/ui` import while resolving to the production helper.
 */
export { setButtonLoading } from '@web/lib/ui';
