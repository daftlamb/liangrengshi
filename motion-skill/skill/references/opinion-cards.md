# Modernist opinion cards

Use this route when the user provides one complete Chinese viewpoint rather than a free-form animation brief.

## Contract

- Keep 12–40 Chinese characters after punctuation and whitespace are excluded.
- Extract no more than two emphasis phrases.
- Do not expand the sentence into an article or invent supporting claims.
- Generate one 900×1200, five-second card.

## Semantic layouts

- `contrast`: “不是 A，而是 B”. Reduce A and concentrate motion around B.
- `converge`: “关键、核心、取决于、最终”. Gather the field toward the conclusion.
- `propagate`: causal or influence language. Move energy through the grid.
- `focus`: one dominant statement with restrained ambient response.

The v2 renderer shares a modernist base composition across these relations. Preserve the inferred relation and emphasis in the CLI result so future layouts can diverge without changing the user contract.

## Relationship diagrams

Use `diagram` when the card should explain a relationship rather than only state a viewpoint. The first implementation uses line-and-circle tokens: two labeled nodes and a connecting edge for contrast or causal motion. It is a compact infographic, not a general chart editor.

This mode can currently create geometric semantic icons only. It does not import custom SVG assets or bind an external dataset; use ordinary card composition when those are required.

## Visual system

Use warm paper, black type, muted structural dots, and one electric-blue signal accent. Keep the statement readable at rest. Motion explains one semantic relationship; it never adds new copy.

## Refinement

After generation, use ordinary scene patches for requests such as calmer motion, a different accent, more whitespace, or stronger emphasis. Keep the original opinion text unchanged unless the user asks to rewrite it.
