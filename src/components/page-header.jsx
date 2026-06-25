/**
 * Optional action bar for a page. The page name already shows in the top
 * navbar, so this intentionally renders no heading or description — it only
 * holds action buttons passed as children (and nothing at all if there are
 * none). This is an internal tool; pages don't need explanatory copy.
 */
export function PageHeader({ children }) {
  if (!children) return null;
  return <div className="flex items-center justify-end gap-2">{children}</div>;
}
