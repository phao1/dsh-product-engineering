---
name: pe-product-analytics
description: "Adding analytics, session recordings, heatmaps, 'what did users do', Clarity or PostHog: behaviour analytics without analytics cookies, read back by the agent."
user-invocable: true
---

# Product analytics: what people did, without analytics cookies

## DeepSeek Harness

This skill is available through `skill({ name: "pe-product-analytics" })` or the user's `/pe-product-analytics` invocation. When the workflow needs another `pe-` skill, load it by name if model-invocable. The user starts `/pe-start-here`, `/pe-ship-check`, `/pe-handover`, and `/pe-retro`. Resolve bundled resources from this skill's base directory. Read and write project files in the current workspace.

Write explanations and project artifacts in the user's requested language. Preserve code, paths, tool names, and policy identifiers. Use the tools and permissions the active DSH profile exposes and record any check that could not run.

When Product Engineering tools are available and the work belongs to a project, find it with `product_list({})` or use the supplied project ID. Read it with `product_get({ projectId })` before acting on its state. Use `product_record({ projectId, expectedRevision, command })` to record only relevant drafts (`artifact.save`), observed sources (`evidence.add`), or proposed owner decisions (`decision.add`). Use the revision from the latest project read and reconcile conflicts before retrying. Link real sources and report what you observed. The owner resolves decisions, attests checks, and advances stages in the workbench.

**Start the next round from what people did after release.** Look at clicks, stopping points and things people never found. Set up analytics without analytics cookies, keeping only essential cookies, and let the agent read the data without asking for screenshots.

Every vendor fact carries the date it was read.

## The default, and the option

- **Default to Microsoft Clarity with cookies off.** Session recordings, one page each without cookies, and heatmaps, free, with the project's cookies switched off and storage consent denied from the page, so Clarity sets no cookie and cannot follow a visitor between visits. Not on a product aimed at people under 18, where Clarity says it shouldn't be used (Clarity's FAQ, read on `2026-10-29`).
- **That removes the cookie, not the question.** The EDPB reads ePrivacy Article 5(3) as covering any script that has the browser send information (Guidelines 2/2023, § 33), so whether the product may record visitors without a consent banner where it is offered is the owner's decision, with their counsel. The agent asks for it by name before the tag goes on, and never states it as settled. If consent is needed, the tag loads only after the visitor accepts, through the banner in § When a cookie comes in, with the denial still queued so it stays cookieless, and the browser test proves nothing from the tool loads before acceptance.
- **Add PostHog when the question needs events.** Use it for funnels and counts on the landing page within a day, on anonymous visitors, without cookies (§ PostHog). Retention, use per account and experiments need an id that lasts (`identify()` or a stored id), which PostHog says makes the id personal data and undoes the cookieless mode. That id, and PostHog on any page past the landing page, are each a new decision for the owner, built and reviewed as its own change (§ PostHog, Start PostHog only in Clarity's tag component behind the same check); an id that lasts also brings everything in § When a cookie comes in.
- **Start with Clarity on the landing page (rule 5).** Both can run; add PostHog when a question names an event.

## What binds

1. **Off without a project id.** An empty id means no script, no request and nothing to consent to (`pe-environments`, optional feature switches). Development leaves it empty, so the owner's own testing never lands in the data.
2. **Clarity's two halves, and only one of them is code.**
   - **Have the owner switch the project's cookies off.** Switch the project's cookies off in the dashboard, putting it in consent mode. Screenshot the setting when it is set.
   - **Define Clarity's queue and queue denial before the tag runs.** The agent adds a script before the tag: `window.clarity = window.clarity || function () { (window.clarity.q = window.clarity.q || []).push(arguments) }; window.clarity('consentv2', { ad_Storage: 'denied', analytics_Storage: 'denied' })`. Called before the queue exists, the denial throws, and nothing else notices. Clarity then gives each page view its own id, writes no `_clck` or `_clsk` cookie, and cannot follow anyone between visits.
   - **Read pages, flows and stopping points, not visitors or pages per session.** Without cookies each page view is its own session and every visitor counts as new. Since 31 October 2025 Clarity also applies consent mode by default to visitors from the EEA, the UK and Switzerland; the page's own denial makes every visitor the same, wherever Clarity places them (Clarity's docs, read on `2026-10-29`).
   - **Test the denial and measure storage with the tag running.** A unit test fails if `granted` appears anywhere in the component or denial is not queued before adding the tag's script. With the test project's id (§ What the owner does by hand), a browser test first proves that script loaded. An unknown id gets an empty answer and loads nothing. Then visit every tagged page and read the cookie jar, `localStorage`, `sessionStorage` and IndexedDB. The privacy policy promises both halves, and a person can flip the dashboard setting. Where the local gate runs no vendor, the browser test is guarded live (the `pe-derive-tests` skill: behind an explicit flag), skipping loudly without a test id, and the `pe-release-gate` checklist runs it at each release that touches a tagged page or the tag. On production, the page's half is the same build the unit test held, and the dashboard's half shows only in the dashboard, so its screenshot is the evidence (§ What the owner does by hand, step 2).
3. **Add the analytics policy sentence with the tag and gate its rendering.** Render it only when the project id is set, so no deploy names a tool that does not load. The legal test pins both states (apply `pe-legal-pages`; `pe-ui-design`, `references/screens.md`).
4. **The Content-Security-Policy admits the tool's origins only once it is wired.** Apply `pe-clerk-production`, the CSP. Clarity's docs name `*.clarity.ms` and `c.bing.com`; PostHog's name `*.posthog.com`, plus `worker-src 'self' blob: data:`, or only the product's own domain behind a reverse proxy (both read on `2026-10-29`).
5. **Tag only the landing page, as a document of its own.** Clarity records the address and referrer of the page it runs on, and of every page the visitor reaches without a full page load, because it follows the browser's history (Microsoft's `clarity` repository, `packages/clarity-js/src/core/history.ts`); its masking covers neither referrers nor query parameters it was not asked to mask (Clarity's FAQ; both read on `2026-10-29`). In one root layout, a document that moved without a full page load can hold pricing (checkout for members), sign-up (which carries the identity provider's invitation ticket in its query), the member home, or a page whose unguessable id is its only lock (`pe-saas-authorization`), in its history or ahead of it. So:
   - **Add the script only to a document holding solely the landing page.** The tag's component checks: `const n = window.navigation; if (n && location.pathname === '/' && n.entries().filter((e) => e.sameDocument).length === 1) addTag()`. Add nothing where the Navigation API is missing. Links to a landing page can carry ad click ids (`gclid`, `fbclid`) and an email platform's subscriber id (Klaviyo's `_kx`), which PostHog's own code lists as personal data (posthog-js, read on `2026-10-29`). PostHog masks its own list and, through `custom_personal_data_properties`, the rest the agent names (§ PostHog). Clarity records the page address as it is unless its support masks named parameters for the project (page addresses only, not referrers or clicked links; Clarity's FAQ, read on `2026-10-30`), so before the tag goes on the agent names to the owner every click id in posthog-js's `PERSONAL_DATA_CAMPAIGN_PARAMS` (`gclid`, `fbclid`, `msclkid`, `ttclid`, `li_fat_id` …) and the subscriber id of the owner's email platform, whether or not today's links carry them, and the owner has Clarity's support mask them in both projects or decides with counsel to record them. Never strip them in the browser: called from the tag's mount effect, `history.replaceState` runs before Next's router patches the History API, and the router writes the original address back at its next refresh or server action (Next 16 `app-router.tsx`, read on `2026-10-30`). A load at `/` is not enough: after a client-side arrival (a `<Link>`, `router.push`, the identity provider's redirect after sign-out), a reload, a Back that reloads the page, or a link to `/` followed while on it keeps the entries reached before, and Back reaches them inside the same document (observed in Chrome 156, `2026-10-29`);
   - **Make every way out of the landing page a full load.** Use a plain `<a href>`, never `<Link>`, `next/form`'s `<Form>`, `router.push` or a server action that redirects, and nothing from the identity provider's client library on the page (its sign-in and user buttons, its sign-up form, its pricing table, its hooks); the provider in the root layout stays (`pe-clerk-production`), and any plan cards the landing shows are its own, read from the billing file (`pe-app-lifecycle`, default choices, pricing); a landing that names no price shows none;
   - **Send `Referrer-Policy: strict-origin` across the whole site.** Set it (`pe-clerk-production`, the CSP), so no page hands its address to the next, and the raw-response check there reads it on the landing page and on a page reached by an id;
   - **Test every departure and history path for full loads and no analytics.** A browser test opens the landing page and follows each of its same-origin links that leave `/` (not `mailto:` or `tel:`, a link that opens a new tab, a link to another origin, or a link to `/` itself or a fragment on it) and submits each of its forms with valid test values, failing when a link or a submission changes the address or adds a history entry without a new `load` event, or when the page it reaches adds a `*.clarity.ms` script or sends a request there after its own `load` event. Then, from the member home, it signs out onto the landing page and walks each path from there, signing in and out again before the next: Back; a reload of `/`, then Back; the landing page's link to `/`, then Back; a public page, Back to `/`, then Back again. Each fails on any request to `*.clarity.ms` from the sign-out on.
   - **Hold the client-library ban with the front door's source guard.** Once any file imports the tag's component, wherever it is mounted and whatever its project id, it fails on any import from the identity provider's client library in every layout, template, loading, error, global-error and not-found file around the landing page, the landing page and every component they import, the root layout's provider excepted (`pe-clerk-production`, the front door).

   **Tag another page only after the owner decides.** Use the tool's strictest masking and state it in the policy.
6. **The agent reads the data back itself.** Use the vendor's MCP server. The agent uses a token the owner made (§ Reading it back). The token is an operator value, one per environment, never in the app's runtime (`pe-environments`).

## PostHog

**Keep PostHog cookieless and within the same landing-page boundary.** These are PostHog's own docs, read on `2026-10-29`:

- **Enable cookieless mode in both code and the project settings.** Set `cookieless_mode: 'always'` in `posthog-js` init and switch on *Enable cookieless tracking* in project settings (Settings, Project, Web analytics), without which cookieless events are ignored. PostHog says this needs no banner unless something else on the site uses cookies; the consent question (§ The default, and the option) still applies.
- **Cookieless PostHog counts each visitor as new every day.** Session replay and surveys are off for anyone who has not consented. For recordings, keep Clarity beside it.
- **Start PostHog only in Clarity's tag component behind the same check.** It runs only on the landing page, never from `instrumentation-client.ts` or a provider in a layout, as PostHog's Next.js guide does, and with `mask_personal_data_properties: true` and `custom_personal_data_properties` listing every parameter the agent named that PostHog's own list lacks (an email platform's subscriber id other than Klaviyo's `_kx`, such as Mailchimp's `mc_eid`), both held by a unit test. A source guard fails on any import of `posthog-js` outside that component. The test environment gives PostHog a fake key, so rule 5's browser test first sees its request from the landing page, then fails on one to its host (or the proxy path) wherever it fails on `*.clarity.ms`. PostHog past the landing page is a new decision for the owner, built and reviewed as its own change.
- **`on_reject` captures nothing until the visitor has chosen.** That means a banner: § When a cookie comes in.
- **Have the owner choose the cloud by where users are.** PostHog has US and EU clouds (`https://eu.i.posthog.com`). PostHog recommends a reverse proxy through the product's own domain before production, which it says typically captures 10 to 30% more events; the CSP then admits only that domain.

## When a cookie comes in

**Explain all three changes before adding any non-essential cookie.** This includes PostHog with cookies on, advertising pixels, chat widgets and anything else:

1. **Load nothing that sets the cookie before the visitor accepts.** Add a consent banner. Nothing that sets the cookie loads before the visitor accepts; refusing is as easy as accepting, and the choice can be changed later from the footer. The unit test turns around: it fails if the tag loads before consent.
2. **Name the cookie in the policy in the same change.** Include who sets it, what for and how long it lasts; apply `pe-legal-pages`.
3. **List the owner's dashboard steps by name for that tool.** Include the setting that turns cookies on, the data processing agreement, the data region, and the retention period.

## Reading it back

**Read the data, answer the question and weigh it against each hypothesis.** Apply `pe-propose`. Use an authorized read-only analytics connection or a dated aggregate export. Keep credentials in the owner's secret store and record counts and redacted paths. Keep session recordings and identifiers out of product records.

- **Use Clarity's read-only data with the project's credential.** Microsoft's `@microsoft/clarity-mcp-server` reads `CLARITY_API_TOKEN` from its process environment (version 2.0.1, observed `2026-10-29`). If the owner configures the server in DSH, use the approved package version and pass the token to the stdio process through a secret-backed environment value. Use metrics and documentation first. Clarity's export answers up to ten requests per project per day in the upstream observation, covering approximately the previous one to three days. Keep daily counts and paths with IDs replaced by `:id` if the question needs a weekly series.
- **Use PostHog's hosted MCP server with read-only access.** The upstream endpoint is `https://mcp.posthog.com/mcp?readonly=true`. Confirm the project and region in the vendor's current docs and use the owner's approved authentication method. Query the project's relevant read tools through the configured DSH connection. The queries use ordinary PostHog quotas, and AI-backed tools can incur PostHog AI spend.

## What the owner does by hand

**Ask the owner for each dashboard action and decision by name.** The agent wires the tag, denial, tests, CSP and policy line. These remain the owner's:

### Clarity
1. **Create a Clarity project for the production site.**
2. **Switch Clarity's cookies off and screenshot the setting.** Use Settings, Setup, Advanced Settings, *Cookies*.
3. **Create a second Clarity project solely for tests.** Switch its cookies off too; its id goes in the test environment only.
4. **Mask the named URL parameters or decide with counsel to record them.** Ask Clarity's support to mask them in both projects. Keep the reply beside the cookies screenshot.
5. **Give production's project id only after support replies or counsel decides.** Until then, production's id stays empty, so no tag loads. Give it to the agent for production's variables; development stays empty.
6. **Set up read access for the requested analysis.** A project admin can create a Data Export API token and configure a secret-backed connection, or export aggregate counts for the agent to read.

### PostHog, when it is added
1. **Create the PostHog project in the chosen US or EU cloud.**
2. **Switch on PostHog's cookieless tracking.** Use *Enable cookieless tracking* in Settings, Project, Web analytics.
3. **Set the PostHog host and ingestion key in the app's production configuration.** Set a separately scoped credential if the agent needs read access.
4. **Approve MCP OAuth or create a key from its preset.** Use the *MCP Server* preset for the personal API key.

**Accept PostHog's processing agreement and decide consent for either tool.** For Clarity, Microsoft says it operates as a data controller, so there is no processor agreement to accept. The policy names Microsoft as a recipient acting as controller with its own privacy statement. Counsel decides how the product's own collection role is described (Clarity's FAQ, read on `2026-10-29`). For either tool, decide consent (§ The default, and the option) and approve the policy line (`pe-legal-pages`).

Each rule's origin, the case that taught it, is in `receipts.md` beside this file; read it when a rule's edge is unclear.

## How you can tell it worked

Every tagged-page visit leaves no analytics cookie or stored browser id, and its recording appears in the dashboard. The agent answered a question about yesterday's visitors through MCP without asking the owner for a screenshot.

Related skills:

- `pe-legal-pages` (the policy line, the banner when a cookie comes in)
- `pe-environments` (empty means off; the token as an operator value)
- `pe-clerk-production` (the CSP)
- `pe-propose` (weighing what people did against each hypothesis)
- `pe-app-lifecycle` (when to propose it: a landing page exists and the privacy page can promise it).
