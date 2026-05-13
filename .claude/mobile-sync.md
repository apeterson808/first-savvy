# Mobile Repo Sync — firstsavvy-mobile

**Repo:** https://github.com/apeterson808/firstsavvy-mobile  
**Last checked:** 2026-05-13  

## Current State (as of last sync)

### Latest commits on `main`

#### Apr 25, 2026
- `f68ffd2` — Align Schedule dropdown with Stars row
- `0db4041` — Align schedule button & dropdown
- `1b69efa` — Updated [id].tsx
- `bb6320e` — Updated [id].tsx
- `ad0d352` — Updated [id].tsx
- `fcb2cf2` — Updated [id].tsx
- `0785ea0` — Redesign sheet headers with icons & titles
- `8141940` — Update Task/Reward icon/title layout
- `3fc1039` — Remove X close buttons from sheets
- `cd69f88` — Add swipe-down to close to modal sheets
- `68da326` — Add reward description field
- `0ddce42` — Update star stepper & compact icon in forms
- `aa2fe5c` — Update reward form icon picker layout
- `3151fae` — Add categorized icons
- `88c0e22` — Added image copy copy.png
- `08e3354` — Fix color picker layout & remove step pills
- `7a98c5e` — Refactor IconColorPicker UI layout
- `32e4a29` — Update icon and color pickers
- `8de800a` — Implement Add Reward flow
- `7fa6b8b` — Update Task Reset UI & Logic
- `f49f18e` — Fix parent task 'Done' status & activity

#### Apr 24, 2026
- `136cccab` — Sync task fields & approval via RPC

#### Apr 23, 2026
- `2ae5d37` — Add task reset modes and UI
- `26c696f` — Add 'Done' state for approved tasks
- `8ff82d4` — Fix daily task reset in edge function
- `2a7ca02` — Updated _layout.tsx
- `0cb5cec` — Enhance Award button with gold glow
- `eb2cef7` — Updated [id].tsx
- `1467ee6` — Update Award button style
- `07f7c36` — Updated home.tsx
- `03f6c98` — Add and display activity note
- `3a2e63f` — Add Task Edit Bottom Sheet
- `13ddb7c` — Refine task sheet input layout
- `1e61431` — Refactor award modal to bottom sheet
- `cc7817c` — Add Award Confirmation Modal

## Key Mobile Changes Synced to Web

| Mobile Change | Web File Updated | Status |
|---|---|---|
| Task reset UI: toggle + Daily/Weekly/Monthly chips | `TaskDialog.jsx` | Done |
| `reset_mode = 'instant'` → `repeatable=true, frequency='always_available'` | `TaskDialog.jsx`, `tasks.js` | Done |
| `reset_mode = 'daily/weekly/monthly'` → `repeatable=false, frequency='once'` | `TaskDialog.jsx`, `tasks.js` | Done |
| Approval uses `stars_balance` not `points_balance` | `tasks.js` `approveTask` | Done |
| Rewards sorted by `star_cost` | `rewards.js` | Done |
| Reward redemption deducts `stars_balance` | `rewards.js` `redeemReward` | Done |
| Remove legacy `points_cost`/`cash_cost` from reward create | `rewards.js` | Done |
| Remove `points_value` from task create | `tasks.js` | Done |
| Remove purple color scheme from child view | `BeginnerProfileView.jsx` | Done |
| Pending stars banner uses amber (not purple) | `BeginnerProfileView.jsx` | Done |
| Rewards section header uses Gift icon + amber | `BeginnerProfileView.jsx` | Done |
| Rewards loaded via `rewardsAPI` (not raw query) | `BeginnerProfileView.jsx` | Done |
| Remove Recent Redemptions section from parent tab | `RewardsTab.jsx` | Done |
| Task feedback box neutral slate (not purple) | `TaskCard.jsx` | Done |
| Schedule display: "Instant reset" or "Daily/Weekly/Monthly" | `TasksTab.jsx` | Done |

## Repo Structure

```
firstsavvy-mobile/
  app/           — Expo Router screens
  context/       — React context providers
  hooks/         — Custom hooks
  lib/           — Supabase client, utilities
  supabase/      — Edge functions, migrations
  assets/images/
```

## Notes for Future Syncs

When new mobile commits appear, check these areas for changes that need porting to the web app:

- `app/(child)/` — Child-facing screens (tasks, rewards, activity)
- `app/(parent)/` — Parent management screens
- `lib/` — API/data layer changes
- `supabase/migrations/` — Database schema changes that web also needs
- `supabase/functions/` — Edge function changes shared between platforms

## Sync Log — 2026-04-25

Latest mobile commit: `f68ffd2e` — Align Schedule dropdown with Stars row (2026-04-25)

**Action required:** Review recent mobile commits at https://github.com/apeterson808/firstsavvy-mobile/commits/main/ and port any relevant changes to the web app.

## Sync Log — 2026-04-30

Latest mobile commit: `829c138b` — Add Bonus Stars & Redemption Approval (2026-04-25)

**Action required:** Review recent mobile commits at https://github.com/apeterson808/firstsavvy-mobile/commits/main/ and port any relevant changes to the web app.
