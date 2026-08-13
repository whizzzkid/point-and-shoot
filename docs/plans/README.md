# Active implementation plans

This directory holds temporary plans for active proposed work. Completed plans are retired after
their current contracts move to [`../specs/`](../specs/README.md) and their lasting architectural
decisions move to [`../adr/`](../adr/README.md). Pull requests and issues retain delivery history.

| Initiative                  | Plan                                  | Status                               |
| --------------------------- | ------------------------------------- | ------------------------------------ |
| Agent2Agent protocol client | [`A2A-client/`](A2A-client/README.md) | Phase 0; browser-native client pivot |
| Browser store publication   | [`publish/`](publish/README.md)       | PR 1 complete; PR 2 pending          |

## A2A plan-owned decisions

These values are provisional until the named phase-0 proof records browser evidence. Later A2A items
must consume the recorded values instead of choosing independent limits. Existing product budgets
remain normative in the [runtime-limits specification](../specs/runtime-limits.md).

| Decision                       | Current or provisional value                  | Owner |
| ------------------------------ | --------------------------------------------- | ----- |
| A2A protocol contract          | `v1.0.0`; derived from pinned normative proto | P0.1  |
| JavaScript SDK runtime         | `@a2a-js/sdk@1.0.1` rejected; uses `Buffer`   | P0.1  |
| Portable client boundary       | `src/shared/a2a/client/mod.ts`                | P0.1  |
| Chrome minimum                 | `116`; unchanged by the current proposal      | P0.2  |
| Firefox minimum                | `109` currently; proposed `115` after proof   | P0.2  |
| Agent Card byte limit          | Pending measurement                           | P0.3  |
| OIDC metadata byte limit       | Pending measurement                           | P0.3  |
| JSON Web Key Set byte limit    | Pending measurement                           | P0.3  |
| JSON response byte limit       | Pending measurement                           | P0.3  |
| Server-Sent Events frame limit | Pending measurement                           | P0.3  |
| Request timeout                | Pending measurement                           | P0.3  |
| First-byte timeout             | Pending measurement                           | P0.3  |
| Stream-idle timeout            | Pending measurement                           | P0.3  |

Phase 0 replaces each pending value with measured evidence before phase 1 starts. These remote
safety limits never cap local prompt copy or downloads.
