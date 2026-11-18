# Security Specification — Bismillah Enterprise Halkhata

## 1. Data Invariants
1. **Shop Ownership Isolation**: Only the verified user whose `request.auth.uid == shopId` and `request.auth.token.email_verified == true` may read or write `/shops/{shopId}` or any nested subcollection.
2. **Master Gate Parent Integrity**: A `Halkhata` cannot be written unless `/shops/{shopId}` exists and is owned by `request.auth.uid`. A `Customer` or `Transaction` cannot be written unless its parent `Halkhata` exists, is owned by `request.auth.uid`, and has `status == 'active'`.
3. **Terminal State Locking**: Once a `Halkhata` reaches `status == 'closed'`, neither the `Halkhata` document nor any nested `Customer` or `Transaction` inside it can be modified or created.
4. **Strict Key Allowlisting & Type Bounds**: Every create and update enforces exact key allowlists (`hasAll` + `hasOnly` on create; `affectedKeys().hasOnly(...)` on update), bounded string lengths, non-negative numbers for balances, and `request.time` server timestamps.
5. **Immutability**: `ownerId` and `createdAt` are strictly immutable after creation.
6. **PII Protection**: Customer mobile numbers and addresses sit under owner-isolated paths (`/shops/{shopId}/...`); zero blanket `isSignedIn()` reads exist.

## 2. The "Dirty Dozen" Attack Payloads (All Must Return PERMISSION_DENIED)
1. **Unauthenticated Read**: `get(/shops/uidA/halkhatas/h1/customers/c1)` with `auth == null`.
2. **Cross-Tenant PII Read**: `get(/shops/uidA/halkhatas/h1/customers/c1)` signed in as `uidB`.
3. **Unverified Email Write**: `create(/shops/uidA)` with `auth.token.email_verified == false`.
4. **Identity Spoofing on Create**: `create(/shops/uidA)` with `{ ownerId: "uidB", ... }`.
5. **Shadow Field Injection**: `create(/shops/uidA/halkhatas/h1/customers/c1)` including extra field `isAdmin: true`.
6. **ID Poisoning (1.5KB Document ID)**: `create(/shops/uidA/halkhatas/h1/customers/<1500_chars>)`.
7. **Resource Exhaustion String**: `create(/shops/uidA/halkhatas/h1/customers/c1)` with `name` length > 120.
8. **Negative Balance Poisoning**: `update(/shops/uidA/halkhatas/h1/customers/c1)` with `totalDue: -500`.
9. **Client Timestamp Spoofing**: `create(/shops/uidA)` with `createdAt: Timestamp(2020-01-01)` instead of `request.time`.
10. **Immutable Field Tampering**: `update(/shops/uidA/halkhatas/h1)` changing `ownerId` or `createdAt`.
11. **Write After Terminal Lock**: `create(/shops/uidA/halkhatas/closedHalkhata/customers/c2)` when parent `status == 'closed'`.
12. **Orphaned Transaction**: `create(/shops/uidA/halkhatas/h1/transactions/t1)` referencing non-existent `customerId` (when not batched with `exists`/`existsAfter`).
