import { SCHEMA_VERSION, type Session } from "../schema.ts";

function pixels(value: number): string {
  return `${value}px`;
}

function hex(value: string): string {
  return `#${value}`;
}

/** Representative session used by export golden-file tests. */
export const EXPORT_FIXTURE_SESSION: Session = {
  schemaVersion: SCHEMA_VERSION,
  id: "session-checkout",
  name: "Checkout review",
  createdAt: "2026-07-28T12:00:00.000Z",
  endedAt: null,
  notes: [
    {
      id: "note-button",
      createdAt: "2026-07-28T12:01:00.000Z",
      pageUrl: "https://example.com/checkout?access_token=secret&step=payment",
      pageTitle: "Checkout",
      region: {
        screenshot:
          "data:image/webp;base64,UklGRiIAAABXRUJQVlA4IBYAAAAwAQCdASoBAAEAAUAmJQBOgCHwAP7+4HAAAA==",
        viewport: { width: 1280, height: 720 },
        box: { x: 810, y: 612, width: 180, height: 48 },
        truncated: false,
      },
      elements: [
        {
          selectors: {
            reachable: true,
            testIds: [{ attribute: "data-testid", value: "place-order" }],
            ariaRoleName: { role: "button", name: "Place order" },
            cssPath: ["button.checkout-action"],
            xpath: ["/html/body/main/button[1]"],
            tagClasses: "button.checkout-action",
            textSnippet: "Place order",
          },
          styleDigest: {
            self: {
              box: {
                width: 180,
                height: 48,
                paddingTop: 12,
                paddingRight: 16,
                paddingBottom: 12,
                paddingLeft: 16,
                marginTop: 0,
                marginRight: 0,
                marginBottom: 0,
                marginLeft: 0,
                borderTopWidth: 1,
                borderRightWidth: 1,
                borderBottomWidth: 1,
                borderLeftWidth: 1,
              },
              typography: {
                fontFamily: "Inter",
                fontSize: 16,
                fontWeight: "600",
                lineHeight: pixels(24),
                letterSpacing: pixels(0),
              },
              color: {
                color: hex("ffffff"),
                backgroundColor: hex("4f7cff"),
                borderTopColor: hex("4f7cff"),
                borderRightColor: hex("4f7cff"),
                borderBottomColor: hex("4f7cff"),
                borderLeftColor: hex("4f7cff"),
              },
            },
            parent: null,
            siblings: [],
          },
          componentHint: { framework: "react", name: "CheckoutButton" },
        },
      ],
      text: "The primary action is pushed against the card edge.",
    },
    {
      id: "note-summary",
      createdAt: "2026-07-28T12:02:00.000Z",
      pageUrl: "https://example.com/checkout/summary",
      pageTitle: "Order summary",
      stripQuery: false,
      region: {
        screenshot:
          "data:image/webp;base64,UklGRiIAAABXRUJQVlA4IBYAAAAwAQCdASoBAAEAAUAmJQBOgCHwAP7+4HAAAA==",
        viewport: { width: 1280, height: 720 },
        box: { x: 72, y: 120, width: 420, height: 260 },
        truncated: true,
      },
      elements: [
        {
          selectors: {
            reachable: false,
            unreachable: "cross-origin-iframe",
            testIds: [],
            tagClasses: "section.order-summary",
            textSnippet: "Order summary",
          },
          styleDigest: null,
        },
      ],
      text: "The total wraps onto a second line at desktop width.",
    },
  ],
};
