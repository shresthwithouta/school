// React warns in dev when rendering produces a <script> tag. Setting
// type="text/javascript" on the server and "text/plain" on the client avoids
// the warning while still letting the browser execute it during HTML parsing
// on hard navigations; see
// node_modules/next/dist/docs/.../preventing-flash-before-hydration.md.
export function InlineScript({ html }) {
  return (
    <script
      type={typeof window === "undefined" ? "text/javascript" : "text/plain"}
      suppressHydrationWarning
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
