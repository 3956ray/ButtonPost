# ButtonPost — Editorial Publishing Desk

## Design principle

**Write once. Publish everywhere.** Focus the product around authorship, not integration complexity. Visitors understand the product quickly; returning users see a compact writing desk. This redesign changes presentation and UX, not the publishing engine.

## Palette and hierarchy

| Token | Value | Use |
| --- | --- | --- |
| Ink | `#222720` | Primary text, navigation |
| Paper | `#fffdf8` | Editing surfaces |
| Canvas | `#f5f3eb` | Quiet background |
| Signal coral | `#c54327` | Primary publication and brand accent |
| Muted | `#606960` | Secondary prose |
| Semantic status | Green / ochre / red | Published, pending/reviewing, failed |

System sans-serif typography is paired with a restrained italic serif hero. The distribution illustration uses CSS, not stock or downloaded visuals; decorative platform monograms are Latin-first for reliable global display.

## Publishing workflow

1. **Write.** One original post, title + Markdown-friendly source, optional images.
2. **Choose.** Cloud publishing first. Browser platforms disabled until optional local setup succeeds.
3. **Send.** A single visually dominant button with independent results and explicit failed-only retry.
4. **Review.** Browser-local history below the primary task.
5. **Extend.** Local Runner only opens on request or first pairing.

## Eight-part self-check

| Area | Implemented treatment | Verification |
| --- | --- | --- |
| Typography | Responsive scale, editorial voice, clear label hierarchy | Preview screenshots at four widths |
| Whitespace | Wide visitor hero, compact signed-in hero, generous form rhythm | Browser geometry checks |
| Hierarchy | Write → choose → publish, secondary Runner below | Manual flow audit |
| Color | Restrained warm palette, single saturated CTA, semantic statuses | Source review and contrast spot-check |
| Motion | Hover and subtle decorative signals | Reduced-motion CSS |
| Microinteraction | Keyboard focus, selected platform ring, explicit retry, progressive disclosure | Browser smoke |
| Responsive | 1440, 768, 390, 320 px | Automated overflow assertions |
| Originality | Authored CSS distribution illustration, not template imagery | Component review |

## Known release gates

Automation checks the **signed-out visitor state** with non-secret mock public Supabase configuration. It does not verify authenticated X/DEV workflows, an actual browser publisher, or real Safari/Windows rendering. Before merge, manually review the Vercel Preview signed-in, connection settings, pricing, history failure states and Runner setup on actual devices.

This design does **not** change Paddle, Title requirements, API adapters, stored credentials or publication quotas.
