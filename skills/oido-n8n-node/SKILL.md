---
name: oido-n8n-node
description: How to wire the Oido Studio community nodes (n8n-nodes-oido) into an n8n workflow — running Oido agents, responding to agent-dispatched runs, and using Oido embedding / rerank / OCR / wiki models. Use whenever building or editing an n8n workflow that should call an Oido agent, be triggered by an Oido event or agent dispatch, or reach Oido's embed/rerank/OCR/wiki endpoints. Consult even if the user only says "Oido node", "trigger my agent from n8n", or "let my agent run this workflow".
---

# Oido Studio n8n Node

The `n8n-nodes-oido` package adds two nodes and one credential. Use them when an
n8n workflow must talk to Oido Studio.

| Thing | Type string (use verbatim in workflow JSON) |
|-------|---------------------------------------------|
| Action node | `n8n-nodes-oido.oido` |
| Trigger node | `n8n-nodes-oido.oidoTrigger` |
| Credential | `oidoApi` |

Author with the n8n MCP tools (`n8n_search_nodes` → `n8n_get_node_schema` →
write JSON → `n8n_validate_workflow` → `n8n_create_workflow`). Connections are
keyed by node **name**, never id.

---

## Credential: `oidoApi`

Two fields:
- `baseUrl` — `http://oido:5577` inside the same Docker network, else the public
  API URL. Default is `http://oido:5577`.
- `apiKey` — org key from **Oido Studio → Settings → API Keys** (`oido_sk_…`).
  Sent as `Authorization: Bearer <apiKey>` on every request.

Both nodes require it. `agentId` / `channel` dropdowns load live from the API, so
the credential must be valid before those fields populate.

---

## Action node — `n8n-nodes-oido.oido`

Pick behavior with the `operation` parameter. Only set the params gated to that
operation (the table shows the params that matter).

| `operation` | Does | Key params | API |
|-------------|------|-----------|-----|
| `invoke` (default) | Run an Oido agent, use its answer | `agentId`, `input`, `wait` (bool), `invokeOptions.timeout` ms (≤600000) | `POST /v1/agents/{id}/invoke` |
| `respond` | Return data to the agent that dispatched this workflow | `respondWith` (`firstIncomingItem`\|`allIncomingItems`\|`json`\|`text`\|`noData`), `responseBody`/`responseText`/`responseKey`, `options.responseCode` | webhook response |
| `embed` | Text → embedding vector | `text` | `POST /v1/embeddings` |
| `rerank` | Rank docs by relevance | `query`, `documents` (JSON array of strings), `topN` (0 = all) | `POST /v1/rerank` |
| `ocrExtract` | OCR an image/PDF, return text (nothing stored) | `binaryPropertyName` (default `data`, ≤10MB) | `POST /v1/ocr/extract` |
| `ocrIngest` | Store image/PDF (async OCR + indexing) | `docBinaryPropertyName` (default `data`) | `POST /v1/ocr/ingest` |
| `ocrGetDocument` | Get an ingested doc + OCR status | `documentId` | `GET /v1/ocr/documents/{id}` |
| `ocrSearch` | Semantic search over ingested docs | `searchQuery`, `searchTopN` (default 10) | `GET /v1/ocr/search` |
| `wikiSearch` | Semantic search the org wiki | `wikiQuery`, `wikiRerank` (bool, default true) | `GET /v1/wiki/search` |
| `wikiGetPage` | Fetch a wiki page by slug | `wikiSlug` | `GET /v1/wiki/{slug}` |
| `wikiIngest` | Feed text/URL into the wiki pipeline (async) | `wikiIngestSource` (`text`\|`url`), `wikiContent`/`wikiSourceUrl`, `wikiSourceType` (`article`\|`chat_export`\|`document`\|`transcript`) | `POST /v1/wiki/ingest` |

Notes:
- `invoke` with `wait:false` is fire-and-forget (no answer). Long agent runs:
  keep `wait:true` but raise `invokeOptions.timeout`.
- `ocrIngest` is async — poll with `ocrGetDocument` using the returned id.
- The node is `usableAsTool: true`, so an n8n AI Agent node can call it as a tool.

---

## Trigger node — `n8n-nodes-oido.oidoTrigger`

Set `triggerOn` first:

### `triggerOn: "event"` — start on an Oido event
- `event`: `agent.run.finished` or `channel.message.received`.
- Optional filters: `agentId` (for `agent.run.finished`), `channel` (for
  `channel.message.received`). Empty = all.
- Registers via `POST /v1/webhooks/subscribe`; body arrives as the workflow item.

### `triggerOn: "agentDispatch"` — an agent runs THIS workflow via its `trigger_workflow` tool
- `responseMode`: `lastNode` (return last node's data), `responseNode` (use an
  Oido → `respond` node), or `onReceived` (fire-and-forget).
- `responseData` (when `lastNode`): `firstEntryJson` \| `allEntries` \| `noData`.
- Registers via `POST /v1/agent-triggers` (workflow id + webhook URL). The agent
  dispatches by workflow, and the webhook body's `data` becomes the item.

---

## Two workflows you'll build most

**1. Agent-dispatched round-trip** (agent calls a workflow, gets an answer back):
```
Oido Trigger (agentDispatch, responseMode=responseNode)
   → …do work…
   → Oido (operation=respond, respondWith=json)
```
Reason: `respond` throws unless an `oidoTrigger` node is an ancestor in the same
workflow. Wire the trigger upstream.

**2. Run an agent from any n8n trigger**:
```
<any trigger> → Oido (operation=invoke, agentId=…, input={{...}}, wait=true)
```

---

## Minimal `n8n_create_workflow` JSON (pattern 2)

```json
{
  "name": "Run Oido agent",
  "nodes": [
    { "name": "When clicking Test", "type": "n8n-nodes-base.manualTrigger",
      "typeVersion": 1, "position": [0, 0], "parameters": {} },
    { "name": "Oido", "type": "n8n-nodes-oido.oido", "typeVersion": 1,
      "position": [260, 0],
      "parameters": { "operation": "invoke", "agentId": "AGENT_ID_HERE",
        "input": "={{ $json.question }}", "wait": true },
      "credentials": { "oidoApi": { "id": "1", "name": "Oido API" } } }
  ],
  "connections": {
    "When clicking Test": { "main": [[{ "node": "Oido", "type": "main", "index": 0 }]] }
  }
}
```

Swap `agentId` for a real id (the dropdown resolves names → ids from
`GET /v1/agents`; via MCP just supply the id). Always attach the `oidoApi`
credential to both Oido nodes.
