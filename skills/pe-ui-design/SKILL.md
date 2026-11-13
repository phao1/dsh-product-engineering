---
name: pe-ui-design
description: "Designing or reviewing product screens, mocks, prototypes, or artifacts that show them: its design system, colour, type, components; judging the look."
user-invocable: true
---

# UI design

## DeepSeek Harness

This skill is available through `skill({ name: "pe-ui-design" })` or the user's `/pe-ui-design` invocation. When the workflow needs another `pe-` skill, load it by name if model-invocable. The user starts `/pe-start-here`, `/pe-ship-check`, `/pe-handover`, and `/pe-retro`. Resolve bundled resources from this skill's base directory. Read and write project files in the current workspace.

Write explanations and project artifacts in the user's requested language. Preserve code, paths, tool names, and policy identifiers. Use the tools and permissions the active DSH profile exposes and record any check that could not run.

When Product Engineering tools are available and the work belongs to a project, find it with `product_list({})` or use the supplied project ID. Read it with `product_get({ projectId })` before acting on its state. Use `product_record({ projectId, expectedRevision, command })` to record only relevant drafts (`artifact.save`), observed sources (`evidence.add`), or proposed owner decisions (`decision.add`). Use the revision from the latest project read and reconcile conflicts before retrying. Link real sources and report what you observed. The owner resolves decisions, attests checks, and advances stages in the workbench.

**Load this skill for the whole of a product's look.** It holds the rules, which outside skill leads when, and how to judge the result. Reading only part of the method leaves already documented mistakes open to repetition.

## What binds, in order

1. **Keep taste and changes to written rules with the owner.** Apply the `pe-agent-instructions` skill to record choices and their precedence. Put each visual question to them as specimens built in the product's real tokens, side by side, never described in words. `references/review.md` says how to sort a fix from an owner's call.
2. **Apply the method to every kit and every screen.** Read `references/method.md`. A mock, prototype or artifact of a screen is high fidelity too: read the method; where the product has a kit, load its CSS and compose it rather than imitate it (a new product's artifact keeps its values in tokens, and the design stage builds the kit); and check a screenshot against the method before the owner sees it. A product departs from a rule only by the owner's decision, recorded in its kit README with the reason.
3. **Keep the product's kit in three files and compose every screen from it.** Put them wherever the product keeps design, often a `design/` folder: `tokens.css`, every raw value (colour, type, space, radius, duration); `kit.css`, the primitives, built from tokens only; and the kit README, the product's own design document: its direction, palette, type, layout and button roles, each with its reason, and every departure from the method. With no provided design system, start the kit at the design stage, before the first app screen (an artifact before it keeps its values in tokens); maintain it and extend its primitives for each later need so buttons, fields and dialogs remain one set. Screens compose the kit; a screen never invents a style.
4. **Take collection suggestions only through the kit's tokens or primitives.** Record them in the kit README; read `references/collections.md`. Where a collection disagrees with the method, the method wins.

**Use the current installed design method.** Confirm it is available in each builder's session before sharing screen work.

**Give each builder access to the design workflow.** DSH builders load `pe-ui-design` through the skill catalog. An external builder uses its host's approved copy. Record the product's design choices in the kit README so any builder can read them.

## Before any screen: the jobs map

**Map the user's jobs before drawing any screen, a builder's included.** Work out what people come to do, with one row per job: the job in the user's words → its screen → the screen's one question → its primary action. Put the map in the proposal artifact and every stage brief adding screens. A screen with no job is cut; a job with no screen is a gap.

- **The product's data rules stay out of the copy.** The brief lists them (how records are split, sampled, versioned or locked), and a screen shows each only as an outcome in plain words: "12 traces wait for your review", never the table or the method's own vocabulary.
- **Default to the familiar tool's structure when replacing one the owner knows.** Generalize that structure and justify every departure in the kit README.
- **The example data fills every screen.** Fill every tab too. Show empty states on purpose beside it, so a click-through never meets an empty screen.

## A stage with screens is done only after the visual checks

**Run every visual check before the owner's click-through.** Complete the newcomer walkthrough below, the rendered-screen pass against `references/screens.md § What to verify visually`, and the app-screen screenshot critique. Critique at 1440, 768 and 390, with three rounds at most.

**Run the scored Impeccable-style audit before the owner's click-through at the first screens and whenever the kit changes.** Fix its P0 and P1 findings. Rerun it before a release changing a screen or kit, and whenever the owner asks. Both critique and audit run from `references/collections.md` checklists without installing the collections. The owner then judges the look (`references/review.md`).

### The newcomer walkthrough

**Give a fresh session only the ordered screenshots and the user's job.** Never give the brief or code; alternatively, ask a person new to the domain. Ask the same questions for every screen: what is it for, what would you press next, and what is unclear? Fix any screen it cannot explain or next step it cannot find. Capture every route and dialog with a Playwright crawl at 1280 and 390. Crop pages taller than about 3,000px into ordered parts for reading without downscaling. For Clerk's test-user sign-in recipe, apply the `pe-clerk-production` skill (`references/authenticated-mile.md`); other providers use their development test sessions.

## Which collection leads, stage by stage

| Stage | Leads | Take | Keep out |
|---|---|---|---|
| The jobs. Before any screen | this skill, § Before any screen | the jobs map; the data rules kept out of the copy | a screen per table |
| Direction. No look yet; the look is the problem; a public page whose job is to persuade | design direction checklist in `references/collections.md` | a direction grounded in the product's subject; a plan for palette, type and layout checked against generic defaults before implementation | a new direction per screen. Once one is picked, it stops leading |
| A choice between options. A palette, a font pairing, a chart type, a stack's convention | UI/UX Pro Max | candidates to choose from. The pick goes into the kit by hand | its persisted design-system files and its installer: a second design system beside the kit |
| The kit | the method, with `frontend-design`'s plan | tokens and primitives that satisfy every rule in `method.md`, each held by a test where one can be written | anything a collection proposes that the method forbids |
| Screens people work in. Dashboards, admin, tables, settings | the app-screen checklist in `references/collections.md § Taste`, distilled from its last upstream app chapter | the screen's one question and face; every block's empty, zero, loading and error state; colour only on data, status and the one primary action; its screenshot critique, three rounds at most | Taste's current company-page system, and its palette and type when a kit exists |
| Charts | chart checklist in `references/collections.md` and the product's chart tools | form first, colour last; a measured palette; one axis; hover by default | state colours reused as series colours |
| What a screen says | `references/screens.md § What a screen may claim` and the writing checklist in `references/collections.md` | sentences as true as what the renderer receives; one function for every summary of a state | — |
| Before it ships | `references/screens.md § What to verify visually`, then Impeccable | every width, state, theme and role; Pro Max's web checks (`quick-reference.md` §1–3, §8, §9, inside the UI/UX Pro Max skill; without it, its distilled list in `collections.md`) as a quick pass; Impeccable's audit, hardening and polish | Pro Max's native/mobile pre-delivery checklist for web work; Impeccable's commands that write their own design documents, and any redesign through it; ellipsis for text a person typed |
| The owner judges the look | `references/review.md` | measured claims, before/after specimens in the real tokens, fixes split from the owner's calls | opinions without numbers |
| A standalone artifact page | the artifact checklist in `references/collections.md` | its page contract and both themes | — |

Read `references/collections.md` for each collection's purpose and usable checklists. Use the bundled method and the browser or screenshot facilities available in the DSH session. Record any visual check that could not run and the routes, states or widths still needing evidence.

## The owner's standing preferences

**Record your preferences in the kit README or user-level agent instructions.** For one product, use the kit README with a pointer from the product's entry file. For every product, use your user-level agent instructions. Use your own words and the date of each choice; edits to the installed pack vanish at its next update. The entries below are the author's worked examples: a taste call with its receipt and scope. Until you write your own, treat them as one owner's taste, not rules.

- **Weight doesn't mark state.** "Colors already say this. Two things saying the same it unnecessary in my opinion." (author preference, `2026-10-22`, rejecting "bold only on problems".)
  - Don't propose bold, size or weight as a second signal for what colour, shape and word already carry.
  - This is separate from the method's *state is form as well as text*. That rule exists so colour is never the only signal: it's accessibility, not emphasis, and it stays.
  - It covers bold that's already there, not only new proposals. "Same weight for every state" (author preference, `2026-10-22`, asked whether a down badge's word and a failed value should lose their bold): a problem's badge, value, row and name wear the weight of their healthy counterparts. A title stays bold because every title is, whatever state it describes.
- **Use 8 px corners on an app's buttons.** "8 px corners in the app" (author preference, `2026-10-22`, a monitoring product, shown its pill buttons beside 8 px ones).
  - Inside the app, buttons and segmented controls take a corner between an input's and a panel's, so a control reads as part of the form around it.
  - Tags stay pills everywhere, so inside the app a pill means a label, not something to press. The marketing site and public pages may keep pill buttons.
  - Start the next product's app this way. If its brand points elsewhere, show the owner both before choosing.
- **Calm and reassuring is the target for monitoring and status products.** Supabase is the reference the owner named. A healthy screen says so in its own colour, and nothing on it says *press* or *beware* louder than that.

Each rule's origin, the case that taught it, is in `receipts.md` beside this file; read it when a rule's edge is unclear.

## How you can tell it worked

Every screen answers a mapped job and passed the walkthrough, rendered pass and screenshot critique; the last scored audit has no open P0 or P1. The owner approved its look at phone and desktop width, and every raw style value comes from the tokens.

## When something is learned

- **Send lessons true for any product to this collection.** Make a change for this collection, drafted in the product's feedback file or as an issue on the collection's repository (`/pe-retro` says how), naming the file it belongs in:
  - a rule for the kit or for building screens goes in `method.md`;
  - a rule about what screens claim, or how they're checked, goes in `screens.md`;
  - a change to the review procedure goes in `review.md`.

  Give each its receipt: the date, and what happened, in a product named by kind, not by name. Hold it with a test where one can be written: a rule only in a report is gone by the next product.
- **Keep lessons true only for this product in its kit README.**
- **Record owner preferences in their own words.** Use the kit README or their user-level agent instructions (§ The owner's standing preferences).

## Where the method lives

- **Replace `design` with `pe-ui-design` in product agent instructions.** Change any "apply `design`" instruction there.

- **Make `pe-ui-design` available to every DSH builder.** Use the installed plugin's skill catalog and verify each builder can load it. Record external builders' approved skill sources in the handoff when the project uses them.
- **Review stale project copies with the owner.** Compare existing design instructions against the current workflow. Move product-specific decisions to the kit README and report redundant copies for the owner to retire.
- **Nobody edits the installed pack and hopes it travels.** A product's lesson goes into its own docs the day it is learned, and the general one goes to this collection as above.

## Files

| File | Holds | Read when |
|---|---|---|
| `references/method.md` | the rules every kit and screen satisfies | writing or changing a kit; building any screen |
| `references/collections.md` | each collection's role, its constraints and its distilled checklist | choosing or applying a collection's method |
| `references/screens.md` | what a screen may claim; what to verify visually | changing what a screen says; before a release |
| `references/review.md` | reviewing a built product's look with its owner | the owner judges the look; a release's visual pass |
| `scripts/color.py` | OKLCH lightness, chroma and hue, and WCAG contrast (standard library only) | any question about a colour: measure it, don't describe it |
