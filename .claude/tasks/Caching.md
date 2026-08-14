# Caching Implementation Task

## Status: Complete

## Plan
3-layer caching strategy:
- **Layer 1**: In-memory TTL cache + optimistic signal updates
- **Layer 2**: IndexedDB offline persistence  
- **Layer 3**: Reconciliation + cache invalidation

## Completed
- [x] Created `cache.service.ts` — generic TTL cache
- [x] Created `local-db.service.ts` — IndexedDB wrapper (items, boards, devices, signed_urls, metadata)
- [x] Added signed URL caching (in-memory + IndexedDB, 50min TTL)
- [x] Added `optimisticUpdate()` / `optimisticRemove()` helpers
- [x] Replaced ALL 25+ `refresh()` calls with optimistic updates in mutation methods
- [x] Added load-from-cache on startup for items, boards, devices
- [x] Upgraded `refresh()` to persist to IndexedDB + rebuild fingerprints
- [x] Expanded items limit from 100 to 500 for richer offline
- [x] Added duplicate fingerprint infrastructure (textFingerprints, linkFingerprints maps)
- [x] Realtime write-through to IndexedDB (INSERT/UPDATE/DELETE)
- [x] Added boards Realtime subscription  
- [x] Foreground reconciliation (visibilitychange → full sync)
- [x] Cache clearing on sign-out (IndexedDB + in-memory)

## Files Changed
- `src/app/services/cache.service.ts` [NEW]
- `src/app/services/local-db.service.ts` [NEW]
- `src/app/services/items.service.ts` [MODIFIED] — major changes
- `src/app/services/boards.service.ts` [MODIFIED]
- `src/app/services/devices.service.ts` [MODIFIED]
- `src/app/services/realtime.service.ts` [MODIFIED]
- `src/app/app.component.ts` [MODIFIED]

## Pending
- [x] Verify build compiles cleanly ✅
- [ ] Manual testing
