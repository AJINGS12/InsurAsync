# InsurAsync

**Claims shouldn't need everyone on the same call at the same time to move forward.**

InsurAsync is a WebMCP-powered demo where three independent AI agents — representing a **policyholder**, an **insurer**, and a **repair shop** — negotiate an insurance claim to resolution using real, structured tools instead of email chains, phone tag, and mailed letters.

Built for the OpenAI WebMCP Challenge hackathon.

**Live demo:** https://insurasync.vercel.app
**Video walkthrough:** https://youtu.be/0cB3Nb6ohd0


---

## The problem

Filing an insurance claim today turns the policyholder into an unpaid project manager: relaying documents between an insurer and a repair shop who never talk to each other directly, chasing status updates by phone, and waiting weeks for information that should take seconds to confirm.

## What InsurAsync does

Each party's page exposes real WebMCP tools scoped to that party's own data:

- The **policyholder's** agent files a structured incident report, uploads requested documents, and gives the final human confirmation before a claim settles.
- The **insurer's** agent checks real coverage terms, requests exactly the documents needed for that claim type, and validates repair estimates against real policy limits.
- The **repair shop's** agent proposes and revises estimates based on real parts/labor pricing.

A shared live negotiation log (the homepage) shows every tool call as it happens — the whole claim resolving in a single synchronized flow instead of weeks of back-and-forth. A human (the policyholder) always gives the final confirmation before anything is settled — this is intentionally the one step no agent can perform.

## Why WebMCP

Before WebMCP, an agent trying to help with a claim could only guess its way through each party's UI (fragile, unreliable, unsafe) or ask a human to manually relay information between three separate systems. WebMCP lets each party define exactly what an agent can do on their page, with real validation logic — so agents negotiate with real data and real rules, not guesses.

---

## Tools implemented

```js
document.modelContext.registerTool({
  name: "submit_incident_report",
  description: "File a structured incident report to start a claim",
  inputSchema: {
    type: "object",
    properties: {
      incident_type: { type: "string" },
      date: { type: "string" },
      description: { type: "string" },
      photos: { type: "array", items: { type: "string" } },
      estimated_severity: { type: "string" }
    },
    required: ["incident_type", "date", "description"]
  },
  execute: async (input) => {
    // stores claim, returns claim_id
  }
});
```

Full tool graph (8 tools across 3 parties):

- **Policyholder:** `submit_incident_report`, `upload_document`, `confirm_settlement`
- **Insurer:** `check_coverage`, `request_missing_docs`, `check_estimate_against_policy`
- **Repair shop:** `propose_estimate`, `revise_estimate`

See [`/app/policyholder/page.js`](./app/policyholder/page.js), [`/app/insurer/page.js`](./app/insurer/page.js), and [`/app/repair-shop/page.js`](./app/repair-shop/page.js) for the tool registrations, and [`/app/api/claims`](./app/api/claims) for the underlying validation logic each tool calls.

---

## Tech stack

- **Next.js (App Router)** — frontend and API routes
- **WebMCP** (`document.modelContext.registerTool`) — one set of tools per party page
- **Redis** (hosted on Vercel) — real persistent claim storage, surviving cold starts and separate serverless invocations
- **Mock data** for policy terms, document requirements, and repair pricing — no real insurer integration; this is a demonstration of the negotiation pattern, not a production insurance system

## Testing with an agent

InsurAsync's tools only respond to a genuine WebMCP-capable browser — not a browser that simply reads page text.

**Recommended: ChatGPT desktop app's in-app browser** — supports WebMCP out of the box, no setup required. Open the in-app browser panel, navigate to the live URL, and prompt it to take actions on the page (e.g. "file an insurance claim for a car collision on August 20th 2026, I got rear-ended at a stoplight").

**Alternative: Google Chrome** — enable WebMCP support first via `chrome://flags/#enable-webmcp-testing`, then relaunch Chrome before testing.

**Note:** ChatGPT's standard web-browsing/search tool (as opposed to its dedicated in-app browser) reads page content as text and cannot call WebMCP tools. Use the in-app browser specifically.

### Suggested test flow

1. On `/policyholder`, ask the agent to file an incident report.
2. On `/insurer`, ask it to check coverage, then request missing documents.
3. Back on `/policyholder`, ask it to upload the requested documents.
4. On `/repair-shop`, ask it to propose a repair estimate.
5. On `/insurer`, ask it to check the estimate against policy.
6. Back on `/policyholder`, click **Confirm Settlement** yourself — this step is deliberately human-only and cannot be triggered by an agent.

Watch `/` (the homepage) throughout — it shows a live, shared log of every tool call across all three parties.

## Running locally

```bash
git clone https://github.com/AJINGS12/InsurAsync.git
cd InsurAsync
npm install
```

You'll need a Redis instance for claim persistence. Create a free Redis database (e.g. via Vercel's Storage tab), then create a `.env.local` file in the project root:


Then run:

```bash
npm run dev
```

Open `/policyholder`, `/insurer`, and `/repair-shop` in separate tabs, and `/` for the shared live log.

## Scope note

This demonstrates the core agent-to-agent negotiation pattern end-to-end for a single claim. There's no authentication — each page shows the most recently filed claim (or a claim specified via `?claim=CLM-XXXX` in the URL), rather than claims scoped to a logged-in user. A production version would add real authentication, real insurer/repair-shop integrations, real file uploads, and more nuanced coverage rules.

## License

MIT — see [LICENSE](./LICENSE).