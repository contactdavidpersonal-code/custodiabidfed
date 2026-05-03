"use client";

import { useEffect } from "react";

/**
 * Root-level error boundary. Catches errors that escape the layout itself
 * (e.g. ClerkProvider crashes). Replaces the entire document so it must
 * include <html> and <body>. Inline styles only — Tailwind/global CSS may
 * not be available if the layout failed to mount.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[app] global error boundary:", error);
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          fontFamily: '"Segoe UI", system-ui, sans-serif',
          background: "#f7f7f3",
          color: "#10231d",
          minHeight: "100dvh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "2rem 1rem",
          letterSpacing: "-0.01em",
        }}
      >
        <div style={{ maxWidth: "28rem", width: "100%" }}>
          <p
            style={{
              fontSize: 11,
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.18em",
              color: "#a06b1a",
              margin: 0,
            }}
          >
            Critical error
          </p>
          <h1
            style={{
              fontSize: "1.75rem",
              fontWeight: 700,
              lineHeight: 1.2,
              margin: "0.5rem 0 0",
            }}
          >
            The app couldn&apos;t load.
          </h1>
          <p
            style={{
              fontSize: "0.95rem",
              lineHeight: 1.55,
              color: "#3f5a51",
              margin: "0.75rem 0 0",
            }}
          >
            Your data is safe. Please try again, or refresh the page.
          </p>
          {error?.digest ? (
            <p
              style={{
                fontFamily: "monospace",
                fontSize: 11,
                color: "#7a5410",
                margin: "1rem 0 0",
              }}
            >
              Reference: {error.digest}
            </p>
          ) : null}
          <button
            type="button"
            onClick={reset}
            style={{
              marginTop: "1.5rem",
              background: "#0e2a23",
              color: "#bdf2cf",
              border: "none",
              padding: "0.85rem 1.25rem",
              fontSize: "0.9rem",
              fontWeight: 700,
              cursor: "pointer",
              minHeight: 48,
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
