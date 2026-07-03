# n8n-nodes-oido

n8n community nodes for [Oido Studio](https://oidostudio.com). Call Oido agents from inside your workflows, and (soon) trigger workflows from Oido events.

## Nodes

- **Oido Agent** — run an Oido agent with a dynamic input and use its answer downstream.
- **Oido Trigger** — start a workflow when an Oido event fires (agent run finished, channel message, ticket created). _(coming with the events release)_

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
