# Active implementation plans

This directory holds temporary plans for active proposed work. Completed plans are retired after
their current contracts move to [`../specs/`](../specs/README.md) and their lasting architectural
decisions move to [`../adr/`](../adr/README.md). Pull requests and issues retain delivery history.

| Initiative                  | Plan                                  | Status                                  |
| --------------------------- | ------------------------------------- | --------------------------------------- |
| Agent2Agent protocol client | [`A2A-client/`](A2A-client/README.md) | Phase 0 stack ready for combined review |
| Browser store publication   | [`publish/`](publish/README.md)       | PR 1 complete; PR 2 pending             |

## A2A plan-owned decisions

Phase 0 settled these values with executable browser and fixture evidence. Later A2A items must
consume them instead of choosing independent limits. Existing product budgets remain normative in
the [runtime-limits specification](../specs/runtime-limits.md).

| Decision                       | Current or provisional value                  | Owner |
| ------------------------------ | --------------------------------------------- | ----- |
| A2A protocol contract          | `v1.0.0`; derived from pinned normative proto | P0.1  |
| JavaScript SDK runtime         | `@a2a-js/sdk@1.0.1` rejected; uses `Buffer`   | P0.1  |
| Portable client boundary       | `src/shared/a2a/client/mod.ts`                | P0.1  |
| Chrome minimum                 | `116`; unchanged by the current proposal      | P0.2  |
| Firefox minimum                | `115`; required for `storage.session`         | P0.2  |
| Agent Card byte limit          | 64 KiB                                        | P0.3  |
| OIDC metadata byte limit       | 64 KiB                                        | P0.3  |
| JSON Web Key Set byte limit    | 64 KiB                                        | P0.3  |
| JSON response byte limit       | 2 MiB                                         | P0.3  |
| Server-Sent Events frame limit | 256 KiB                                       | P0.3  |
| Request timeout                | 10 seconds                                    | P0.3  |
| First-byte timeout             | 5 seconds                                     | P0.3  |
| Stream-idle timeout            | 30 seconds                                    | P0.3  |

These remote safety limits never cap local prompt copy or downloads. The
[A2A client specification](../specs/a2a-client.md) defines their enforcement boundary.
