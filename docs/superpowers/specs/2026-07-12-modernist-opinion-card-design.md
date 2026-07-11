# Modernist Opinion Card v2 Design

## Product

Turn one Chinese opinion into one publishable 3:4 animated card. The first visual system is modernist editorial: strict grid, large sans-serif Chinese type, black/white/gray, one signal accent, and restrained generative motion.

## Input contract

- One complete opinion containing 12–40 Chinese characters after punctuation and whitespace are excluded.
- At most two emphasized phrases.
- No article expansion, carousel generation, photo sourcing, or long-video editing.

## Semantic layouts

- `focus`: one dominant conclusion.
- `contrast`: “不是 A，而是 B” and equivalent opposition.
- `converge`: several ideas point to one key phrase.
- `propagate`: cause, consequence, or influence spreads through the card.

The first implementation may render these through one shared modernist composition, but the inferred layout and emphasis must remain explicit outputs so later renderers can diverge safely.

## Motion roles

Static composition communicates the opinion. Motion explains or emphasizes one relationship. The supported personalities are `precise`, `elastic`, `flowing`, `magnetic`, and `restless`; v2 defaults to a restrained personality chosen from the semantic relation.

## Output

- 900×1200 browser preview.
- Valid structured scene with stable seed.
- Static key-frame candidate at the loop start.
- Five-second Xiaohongshu motion duration.
- A Live Photo export adapter that accepts a rendered JPG/MOV pair and creates a `.pvt` through the existing local packaging tool. Frame rendering into JPG/MOV remains a separate renderer boundary.

## Visual constraints

- Background, foreground, muted, and one accent color only.
- One primary and no more than two supporting bindings.
- Opinion remains readable at rest and at motion extremes.
- Motion cannot introduce unrelated copy.
- Generated work never writes into the skill root; use a task/output directory.

## Success

Given a valid opinion, one command produces a valid preview scene whose text, inferred relation, emphasized phrases, 3:4 dimensions, five-second duration, modernist palette, and motion bindings are deterministic. The skill can then preview it and package externally rendered JPG/MOV assets as a Live Photo.
