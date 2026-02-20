# Kylas-wapiy-backend

**Integration backend between Kylas CRM and WhatsApp APIs.**

## Problem
CRM teams lose efficiency when lead communication and WhatsApp conversations are disconnected from core CRM workflows.

## Solution
This backend bridges Kylas CRM with WhatsApp APIs to automate messaging workflows and keep communication context aligned with CRM activity.

## Architecture
**Current stack signals:** Node.js, Express, MongoDB

- Webhook/event ingestion layer
- CRM ↔ WhatsApp transformation services
- Message orchestration pipeline
- Integration auth/secrets handling

## Scale
Supports growing conversation volumes and multi-workflow automation across sales/support pipelines.

## Monetization
Integration SaaS model (subscription tiers based on message volume/workflow complexity).

## Roadmap
- Template governance and approvals
- Conversation analytics
- Retry/dead-letter handling
- Multi-tenant org support

## Quick start
```bash
npm install
npm run start  # adjust based on package scripts
```

## Useful scripts
- `npm run test` — echo "Error: no test specified" && exit 1
