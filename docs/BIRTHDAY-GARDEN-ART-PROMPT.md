# Birthday Garden artwork brief

This is the handoff brief for the first bespoke artwork asset. Replace the
current `pat-a-cake.jpg` source in the Birthday celebration template only after
reviewing three substantially different concepts.

## Technical contract

- Canvas: exactly 1080 x 1350 px, portrait 4:5
- Delivery: WebP or PNG; no text, letters, logo, watermark, or border
- Message-safe area: x=90, y=300, width=530, height=620
- Artwork focal point: lower-right, bleeding off the right and bottom edges
- Hero artwork coverage: approximately 40-55% of the canvas
- Keep upper-left and center-left calm enough for overlay text
- Provide a flattened artwork and, if available, a transparent foreground layer

## Prompt

```text
Design a premium editorial birthday greeting card artwork for a digital ecard
application. Create a portrait composition at exactly 1080 x 1350 pixels with
a 4:5 aspect ratio.

The result should feel like beautiful illustrated stationery, not a webpage,
poster, dashboard, social media graphic, or generic birthday card.

Creative direction: a joyful garden celebration in late afternoon. Combine
hand-painted gouache flowers, loose botanical leaves, delicate ribbon, small
celebratory paper shapes, and a partially visible birthday cake. The feeling
should be warm, optimistic, artistic, and personal.

Use an asymmetrical editorial composition. Keep the upper-left and center-left
areas calm and readable. Reserve a clean message-safe area from approximately
x=90 to x=620 and y=300 to y=920. Place the illustrated celebration cluster
in the lower-right quadrant. Let flowers, leaves, ribbon, and cake bleed beyond
the right and bottom edges. Use foreground, midground, and background depth.
Do not center the artwork. Do not use a large central circle, blob,
symmetrical frame, or evenly distributed decorative icons.

Include a hand-painted birthday cake viewed slightly from the side, layered
cake with imperfect icing and a few candles, painted flowers and leaves, one
loose ribbon entering from the upper-right edge, and a few paper confetti
shapes integrated into the composition. Use subtle paper grain, brush
variation, imperfect painted edges, and natural overlap.

Palette: warm terracotta, apricot, butter yellow, muted sage, dusty rose,
warm cream, and small accents of deep burgundy or dark olive. Avoid neon and
rainbow palettes.

Use gouache and watercolor stationery illustration, tactile handmade paper,
subtle vintage print texture, slight ink imperfections, layered painted
shapes, and a premium independent stationery brand aesthetic.

Do not include text, letters, numbers, logos, watermarks, card mockups,
devices, flat vector UI illustration, generic geometric decorations as the
primary artwork, or artwork over the message-safe area.

Generate three genuinely different compositions:
1. botanical and elegant
2. playful and cake-focused
3. painterly and editorial
Do not make simple color variations.
```

## Selected design handoff

Return the chosen concept with:

```json
{
  "messageSafeArea": { "x": 90, "y": 300, "width": 530, "height": 620 },
  "messageAlignment": "left",
  "messageColor": "#FFF8EC",
  "taglineColor": "#F8D9B2",
  "supportingTextColor": "#FFF8EC",
  "recommendedFont": "caveat",
  "artworkFocalPoint": "lower-right",
  "backgroundColor": "#D97961"
}
```
