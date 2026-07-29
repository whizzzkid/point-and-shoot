# Checkout review

2 notes captured.

`session.json` is the canonical record. This Markdown file is a convenience projection.

## Note 1/2 — Checkout

### Problem

The primary action is pushed against the card edge.

### Location

- Page: `https://example.com/checkout`
- Captured: `2026-07-28T12:01:00.000Z`
- Screenshot: [`./shots/note-01.webp`](./shots/note-01.webp)
- Region: `x=810, y=612, width=180, height=48`
- Viewport: `1280 × 720`
- Capture clipped: no

### Evidence

#### Element 1

Selector bundle:

```json
{
  "reachable": true,
  "testIds": [
    {
      "attribute": "data-testid",
      "value": "place-order"
    }
  ],
  "ariaRoleName": {
    "role": "button",
    "name": "Place order"
  },
  "cssPath": [
    "button.checkout-action"
  ],
  "xpath": [
    "/html/body/main/button[1]"
  ],
  "tagClasses": "button.checkout-action",
  "textSnippet": "Place order"
}
```

Framework hint:

```json
{
  "framework": "react",
  "name": "CheckoutButton"
}
```

Computed style evidence:

```json
{
  "self": {
    "box": {
      "width": 180,
      "height": 48,
      "paddingTop": 12,
      "paddingRight": 16,
      "paddingBottom": 12,
      "paddingLeft": 16,
      "marginTop": 0,
      "marginRight": 0,
      "marginBottom": 0,
      "marginLeft": 0,
      "borderTopWidth": 1,
      "borderRightWidth": 1,
      "borderBottomWidth": 1,
      "borderLeftWidth": 1
    },
    "typography": {
      "fontFamily": "Inter",
      "fontSize": 16,
      "fontWeight": "600",
      "lineHeight": "24px",
      "letterSpacing": "0px"
    },
    "color": {
      "color": "#ffffff",
      "backgroundColor": "#4f7cff",
      "borderTopColor": "#4f7cff",
      "borderRightColor": "#4f7cff",
      "borderBottomColor": "#4f7cff",
      "borderLeftColor": "#4f7cff"
    }
  },
  "parent": null,
  "siblings": []
}
```

## Note 2/2 — Order summary

### Problem

The total wraps onto a second line at desktop width.

### Location

- Page: `https://example.com/checkout/summary`
- Captured: `2026-07-28T12:02:00.000Z`
- Screenshot: [`./shots/note-02.webp`](./shots/note-02.webp)
- Region: `x=72, y=120, width=420, height=260`
- Viewport: `1280 × 720`
- Capture clipped: yes

### Evidence

#### Element 1

Selector bundle:

```json
{
  "reachable": false,
  "unreachable": "cross-origin-iframe",
  "testIds": [],
  "tagClasses": "section.order-summary",
  "textSnippet": "Order summary"
}
```

Computed style evidence was unavailable.
