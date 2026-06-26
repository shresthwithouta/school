"use client";

import { useEffect } from "react";

// Last-resort boundary: catches errors thrown by the ROOT layout itself (which
// the (app)/error.jsx boundary can't reach). It replaces the entire document,
// so it renders its own <html>/<body> and uses inline styles that don't depend
// on the theme provider or app CSS being available.
export default function GlobalError({ error, reset }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "24px",
          fontFamily:
            "system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
          background: "#f8fafc",
          color: "#0f172a",
        }}
      >
        <div style={{ maxWidth: "420px", width: "100%", textAlign: "center" }}>
          <div
            style={{
              width: "56px",
              height: "56px",
              margin: "0 auto",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              borderRadius: "16px",
              background: "rgba(225,29,72,0.1)",
              color: "#e11d48",
              fontSize: "28px",
              fontWeight: 700,
            }}
          >
            !
          </div>
          <h1
            style={{
              marginTop: "20px",
              fontSize: "22px",
              fontWeight: 600,
              letterSpacing: "-0.02em",
            }}
          >
            Something went wrong
          </h1>
          <p style={{ marginTop: "8px", fontSize: "14px", color: "#64748b", lineHeight: 1.6 }}>
            The application ran into an unexpected problem. Please reload the
            page — if it keeps happening, contact your administrator.
          </p>
          {error?.digest && (
            <p
              style={{
                marginTop: "16px",
                display: "inline-block",
                fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                fontSize: "12px",
                color: "#64748b",
                background: "#fff",
                border: "1px solid #e2e8f0",
                borderRadius: "6px",
                padding: "4px 10px",
              }}
            >
              Reference: {error.digest}
            </p>
          )}
          <div style={{ marginTop: "28px" }}>
            <button
              type="button"
              onClick={() => reset()}
              style={{
                background: "#4f46e5",
                color: "#fff",
                border: "none",
                borderRadius: "8px",
                padding: "10px 20px",
                fontSize: "14px",
                fontWeight: 500,
                cursor: "pointer",
              }}
            >
              Reload
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
