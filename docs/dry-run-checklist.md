# Live Quiz dry-run checklist

Complete this on the dated rehearsal. Leave a failed row unchecked and record the issue in `docs/known-issues.md`.

## Run details

| Field | Record |
| --- | --- |
| Date and local time | |
| Facilitator | |
| Release tag / commit | |
| VPS URL and build identity | |
| Local fallback host and build identity | |
| Sample quiz / real quiz | |
| Five participants | |
| Total elapsed time | |

## Device and network matrix

| Device | Browser | Network | Full game | Resume / recovery | Notes |
| --- | --- | --- | --- | --- | --- |
| Android mid-range | Chrome | | ☐ | ☐ | |
| iPhone | Safari | | ☐ | ☐ | |
| In-app browser | | | ☐ | ☐ | |
| Host laptop | Chrome | | ☐ | ☐ | |
| Local fallback phone | | No internet | ☐ | ☐ | |

## Resilience and integrity checks

- [ ] Duplicate nickname on a fresh device cannot impersonate the existing player.
- [ ] Valid recovery code replaces the old session and a repeated recovery acknowledgement retry remains usable.
- [ ] Invalid recovery attempts show the configured throttle behavior.
- [ ] A join acknowledgement retry returns a usable original credential outcome.
- [ ] An answer acknowledgement loss reconciles from a fresh snapshot without a duplicate answer.
- [ ] Lock/background, unlock, and refresh preserve the player’s score, locked answer, and server-timed countdown.
- [ ] Host refresh during QUESTION and LEADERBOARD resumes current controls without a duplicate transition.
- [ ] Revision-ordered updates preserve same-state progress and private player results.
- [ ] Late joiners observe the current question but cannot answer it.
- [ ] Results download works; export failure messaging and retry behavior were exercised if feasible.
- [ ] Restarting during a game gives the controlled no-recovery experience.
- [ ] VPS and local fallback were both checked; switching origins was explained as a new game.

## Sign-off

| Role | Name | Date / time | Result |
| --- | --- | --- | --- |
| Host | | | |
| QA observer | | | |
