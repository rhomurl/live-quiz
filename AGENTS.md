# Contributor Guide

Read [README.md](README.md), [quiz-tasks/00-README.md](quiz-tasks/00-README.md), [quiz-tasks/01-contracts.md](quiz-tasks/01-contracts.md), and [quiz-tasks/11-gaps-and-constraints.md](quiz-tasks/11-gaps-and-constraints.md) before implementation.

## Ownership and integration

- Complete Task 01 and its acceptance checks before starting feature work.
- One contributor owns each source file. Follow the ownership table in `quiz-tasks/00-README.md`; request a handoff instead of editing another lane's file.
- `shared/contracts.js` and its fixtures are the integration boundary. Update the contract, fixtures, runtime validators, and affected tests together when changing an event or view.
- `stateVersion` protects host transitions. `revision` orders every emitted view. Do not use one in place of the other.
- Client views are explicit server data. Never serialize an internal game object, quiz object, Map, socket, secret, token, or recovery code.

## Security and event behavior

- Do not commit `.env`, host secrets, result exports, resume tokens, recovery codes, or generated download tokens.
- Initial join, resume, recovery, and retry must follow Task 01. Nickname alone must never identify or restore a player.
- The server decides deadlines, eligibility, scoring, correctness, and transitions. Do not add client authority or pre-reveal answer data.
- Preserve the 50-player target, single process, in-memory live state, and Docker Compose primary deployment until a documented decision changes them.

## Verification

- Run the checks named in the task you changed. Do not claim a task is complete from static review alone.
- Before merging an integration change, run the available build, test, and smoke commands and record any limitation in the relevant task evidence document.
- Keep feature work inside the seminar scope and freeze after the September 23 dry run except for reproduced blockers with fresh verification.
