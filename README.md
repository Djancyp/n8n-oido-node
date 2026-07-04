# n8n-nodes-oido

n8n community nodes for [Oido Studio](https://oidostudio.com). Call Oido agents from inside your workflows, trigger workflows from Oido events, and let agents trigger your workflows.

## Nodes

- **Oido** — actions:
  - *Run Agent* — run an Oido agent with a dynamic input and use its answer downstream (waits for the result, or fire-and-forget). Usable as a tool by n8n's AI Agent node.
  - *Respond to Agent* — return a shaped response (items, custom JSON, text; status code, headers) to the agent that dispatched the workflow. Requires an Oido Trigger (Agent Dispatch) upstream.
- **Oido Trigger** — triggers:
  - *Oido Event* — start the workflow when an Oido event fires: agent run finished (optionally filtered to one agent) or channel message received (optionally filtered to one channel).
  - *Agent Dispatch* — let Oido agents start this workflow with their `trigger_workflow` tool (the agent must be bound to the workflow in Studio → n8n). Choose how to respond: immediately, with the last node's output, or via a Respond to Agent node.

## Install

n8n → **Settings → Community Nodes → Install** → `n8n-nodes-oido`.

Requires n8n community packages enabled (`N8N_COMMUNITY_PACKAGES_ENABLED=true`).

## Credential — Oido API

- **Base URL**: `http://oido:5577` when n8n runs in the same Docker network as Oido; otherwise your public API URL.
- **API Key**: create one in Oido Studio → **Settings → API Keys** (starts with `oido_sk_`).

## Develop

```bash
npm install
npm run build      # → dist/
npm publish        # community package (keyword: n8n-community-node-package)
```
