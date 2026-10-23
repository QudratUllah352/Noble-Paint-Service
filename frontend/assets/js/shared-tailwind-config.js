// Inner-page tokens aligned with the homepage palette and typography.
tailwind.config = {
  "darkMode": "class",
  "theme": {
    "extend": {
      "colors": {
        "on-surface-variant": "#64748b",
        "on-tertiary": "#ffffff",
        "surface-dim": "#e2e8f0",
        "surface-container-lowest": "#ffffff",
        "surface-container": "#f1f5f9",
        "on-tertiary-fixed": "#261a00",
        "error": "#ba1a1a",
        "surface-bright": "#ffffff",
        "tertiary-container": "#eab308",
        "surface-variant": "#dbeafe",
        "error-container": "#ffdad6",
        "on-secondary-container": "#ffffff",
        "on-secondary-fixed": "#78350f",
        "primary-container": "#1d3fb8",
        "outline": "#64748b",
        "primary-fixed-dim": "#93c5fd",
        "on-secondary": "#ffffff",
        "tertiary-fixed-dim": "#fde047",
        "surface-container-low": "#f8fafc",
        "inverse-surface": "#2547d0",
        "primary": "#2547d0",
        "on-tertiary-container": "#422006",
        "surface-container-highest": "#cbd5e1",
        "on-background": "#1e293b",
        "on-primary": "#ffffff",
        "tertiary-fixed": "#fef9c3",
        "secondary-fixed-dim": "#fbbf24",
        "inverse-primary": "#bfdbfe",
        "secondary-fixed": "#fef3c7",
        "on-tertiary-fixed-variant": "#5c4300",
        "on-secondary-fixed-variant": "#92400e",
        "on-surface": "#1e293b",
        "primary-fixed": "#dbeafe",
        "on-error": "#ffffff",
        "surface-tint": "#2547d0",
        "inverse-on-surface": "#ffffff",
        "background": "#fcfdfd",
        "on-primary-container": "#dbeafe",
        "on-primary-fixed-variant": "#1d3fb8",
        "on-error-container": "#93000a",
        "tertiary": "#a16207",
        "surface": "#fcfdfd",
        "secondary": "#b45309",
        "outline-variant": "#e2e8f0",
        "surface-container-high": "#e2e8f0",
        "on-primary-fixed": "#18349c",
        "secondary-container": "#f59e0b",
        "brand": {
          "blue": "#2547d0",
          "blue-dark": "#1d3fb8",
          "blue-deep": "#18349c",
          "amber": "#f59e0b",
          "amber-hover": "#d97706",
          "yellow": "#eab308"
        }
      },
      "borderRadius": {
        "DEFAULT": "0.25rem",
        "lg": "0.5rem",
        "xl": "0.75rem",
        "full": "9999px"
      },
      "spacing": {
        "gutter-mobile": "1rem",
        "space-lg": "1.5rem",
        "space-sm": "0.5rem",
        "margin": "3rem",
        "margin-mobile": "1.25rem",
        "gutter": "1.5rem",
        "space-md": "1rem",
        "space-xs": "0.25rem",
        "space-xl": "2.5rem"
      },
      "fontFamily": {
        "label-md": [
          "Inter",
          "system-ui",
          "-apple-system",
          "BlinkMacSystemFont",
          "Segoe UI",
          "Roboto",
          "sans-serif"
        ],
        "headline-lg": [
          "Inter",
          "system-ui",
          "-apple-system",
          "BlinkMacSystemFont",
          "Segoe UI",
          "Roboto",
          "sans-serif"
        ],
        "headline-xl": [
          "Inter",
          "system-ui",
          "-apple-system",
          "BlinkMacSystemFont",
          "Segoe UI",
          "Roboto",
          "sans-serif"
        ],
        "headline-xl-mobile": [
          "Inter",
          "system-ui",
          "-apple-system",
          "BlinkMacSystemFont",
          "Segoe UI",
          "Roboto",
          "sans-serif"
        ],
        "body-sm": [
          "Inter",
          "system-ui",
          "-apple-system",
          "BlinkMacSystemFont",
          "Segoe UI",
          "Roboto",
          "sans-serif"
        ],
        "headline-lg-mobile": [
          "Inter",
          "system-ui",
          "-apple-system",
          "BlinkMacSystemFont",
          "Segoe UI",
          "Roboto",
          "sans-serif"
        ],
        "headline-sm": [
          "Inter",
          "system-ui",
          "-apple-system",
          "BlinkMacSystemFont",
          "Segoe UI",
          "Roboto",
          "sans-serif"
        ],
        "headline-md": [
          "Inter",
          "system-ui",
          "-apple-system",
          "BlinkMacSystemFont",
          "Segoe UI",
          "Roboto",
          "sans-serif"
        ],
        "body-md": [
          "Inter",
          "system-ui",
          "-apple-system",
          "BlinkMacSystemFont",
          "Segoe UI",
          "Roboto",
          "sans-serif"
        ],
        "body-lg": [
          "Inter",
          "system-ui",
          "-apple-system",
          "BlinkMacSystemFont",
          "Segoe UI",
          "Roboto",
          "sans-serif"
        ],
        "label-sm": [
          "Inter",
          "system-ui",
          "-apple-system",
          "BlinkMacSystemFont",
          "Segoe UI",
          "Roboto",
          "sans-serif"
        ],
        "label-lg": [
          "Inter",
          "system-ui",
          "-apple-system",
          "BlinkMacSystemFont",
          "Segoe UI",
          "Roboto",
          "sans-serif"
        ],
        "sans": [
          "Inter",
          "system-ui",
          "-apple-system",
          "BlinkMacSystemFont",
          "Segoe UI",
          "Roboto",
          "sans-serif"
        ]
      },
      "fontSize": {
        "label-md": [
          "13px",
          {
            "lineHeight": "18px",
            "fontWeight": "600"
          }
        ],
        "headline-lg": [
          "clamp(1.75rem, 3vw, 2.25rem)",
          {
            "lineHeight": "1.2",
            "fontWeight": "800"
          }
        ],
        "headline-xl": [
          "clamp(2.25rem, 5vw, 3.75rem)",
          {
            "lineHeight": "1.15",
            "fontWeight": "800",
            "letterSpacing": "-0.025em"
          }
        ],
        "headline-xl-mobile": [
          "32px",
          {
            "lineHeight": "40px",
            "fontWeight": "800"
          }
        ],
        "body-sm": [
          "14px",
          {
            "lineHeight": "20px",
            "fontWeight": "400"
          }
        ],
        "headline-lg-mobile": [
          "26px",
          {
            "lineHeight": "34px",
            "fontWeight": "700"
          }
        ],
        "headline-sm": [
          "20px",
          {
            "lineHeight": "28px",
            "fontWeight": "600"
          }
        ],
        "headline-md": [
          "24px",
          {
            "lineHeight": "32px",
            "fontWeight": "700"
          }
        ],
        "body-md": [
          "16px",
          {
            "lineHeight": "24px",
            "fontWeight": "400"
          }
        ],
        "body-lg": [
          "18px",
          {
            "lineHeight": "28px",
            "fontWeight": "400"
          }
        ],
        "label-sm": [
          "11px",
          {
            "lineHeight": "16px",
            "fontWeight": "700"
          }
        ],
        "label-lg": [
          "15px",
          {
            "lineHeight": "20px",
            "fontWeight": "600"
          }
        ]
      }
    }
  }
};
