# Security Spec: Polling Platform

## Data Invariants
1. **System State**: The `currentPollNumber` must be an integer between 0 and 10. `isActive` must be a boolean.
2. **Admin Priority**: Only `ahmadabdullah007860@gmail.com` is allowed to update the system state.
3. **Voting Integrity**:
   - A user can only vote for the `pollNumber` that is currently `isActive` in `/system/state`.
   - A user can only vote once per `pollNumber`.
   - The `userId` in the document must match the authenticated user's ID.
   - `choice` must be "bias" or "reality".

## Dirty Dozen Payloads (Rejection Targets)
1. **Junk ID**: Attempt to write to `/system/state` with a 2MB ID string.
2. **Unauthorized State Update**: Non-admin user trying to increment `currentPollNumber`.
3. **Ghost Voting**: User trying to vote on `pollNumber: 5` when `currentPollNumber` is 3.
4. **Identity Spoofing**: User A trying to vote with `userId: "user-B"`.
5. **Inactive Voting**: User trying to vote when `isActive` is `false`.
6. **Multiple Votes**: User trying to submit a second vote for the same `pollNumber`.
7. **Invalid Choice**: User trying to vote with `choice: "maybe"` (only "bias" or "reality" allowed).
8. **Shadow Fields**: User trying to add `isAdmin: true` to their vote document.
9. **Admin State Poisoning**: Admin trying to set `currentPollNumber` to 11.
10. **Global Read Leak**: Non-admin user trying to list all votes from `/votes`.
11. **State Overwrite**: User trying to delete the `/system/state` document.
12. **Timestamp Fraud**: User trying to set `timestamp` to a date in the future (must use server time).
