# MintGrow Reconstruction Roadmap

## Game loop
- Keep the recognizable 2048 merge architecture, but remove forced blocker/bomb spawns that could create deterministic dead loops.
- Use weighted random tile spawns that unlock 8 and 16 tiles only after score/move milestones.
- Randomize token rewards per scoring move with base rate, streak bonuses, and small jackpot chances.

## Supabase platform
- `players` is the player identity and wallet table.
- `game_sessions` records score, moves, max tile, token output, and board snapshots for audits.
- `ad_events` tracks Monetag placements and reward outcomes.
- `withdrawals` is the payout operations queue for the admin panel.
- `referrals` stores direct referral relationships for the multi-level income engine.

## Monetization notes
Monetag and similar ad networks often do not serve rewarded inventory in Vercel previews, localhost, unsupported browsers, or unapproved domains. Production registration should therefore:
1. attempt the real SDK on approved production domains;
2. log failed placements to `ad_events`;
3. allow a non-production fallback reward only outside production;
4. never block already-registered users behind a failed preview ad.

## Implemented in this pass
- Added a Play-Store-style arena shell, in-app brand mark, and block-puzzle board frame.
- Added backend withdrawal RPCs so request creation and token movements can be centralized in Supabase.
- Added admin search and an operations cockpit visual layer for Vercel deployments.

## Next phases
1. Move all token credits and admin approval state transitions into service-role-only Supabase RPC functions.
2. Replace anonymous public policies with Telegram init-data verification or Supabase Auth session binding.
3. Add admin roles and service-role-only payout approvals.
4. Add Playwright/E2E coverage for registration, game-over recovery, ads, and withdrawals.
