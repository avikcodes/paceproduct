import type { ClerkAppearanceTheme } from "@clerk/shared/types";

const primary = "oklch(0.546 0.245 262.881)";

export const clerkAppearance: ClerkAppearanceTheme = {
  variables: {
    colorPrimary: primary,
    colorBackground: "oklch(1 0 0)",
    colorForeground: "oklch(0.145 0 0)",
    colorMutedForeground: "oklch(0.4 0 0)",
    colorInput: "oklch(1 0 0)",
    colorInputForeground: "oklch(0.145 0 0)",
    colorNeutral: "oklch(0.145 0 0)",
    colorBorder: "oklch(0.922 0 0)",
    borderRadius: "0.5rem",
    fontSize: "0.875rem",
    spacing: "1rem",
    fontFamily:
      "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
  },
  elements: {
    card: {
      boxShadow:
        "0 1px 2px oklch(0 0 0 / 0.04), 0 8px 24px oklch(0 0 0 / 0.06)",
      border: "1px solid oklch(0.922 0 0)",
    },
    headerTitle: {
      fontSize: "1.25rem",
      fontWeight: "600",
      letterSpacing: "-0.025em",
    },
    formButtonPrimary: {
      background: primary,
      boxShadow: "0 1px 2px oklch(0 0 0 / 0.06)",
      borderRadius: "0.5rem",
    },
    formFieldInput: {
      borderRadius: "0.5rem",
      borderColor: "oklch(0.922 0 0)",
    },
    footerActionLink: {
      color: primary,
    },
    identityPreviewEditButton: {
      color: primary,
    },
  },
};
