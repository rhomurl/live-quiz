# Task 08 — Blockchain Quiz Content

Depends on: 01. **Owns:** `server/quizzes/blockchain-101.json`, `server/quizzes/sample-test.json`, `scripts/validate-quiz.js`, and `docs/quiz-authoring.md`.

## Required content

- Create a 15–20 question `blockchain-101` quiz for fourth-year college students: three warm-ups, approximately ten core questions, and three to five harder questions.
- Cover hashing, blocks/chaining, consensus, public/private keys, wallets, transactions, smart contracts, gas, L1/L2, and common scams. Avoid price and trading questions.
- Every question has one defensible answer, no trick wording, no “all of the above,” an appropriate 15–30 second time limit, and a concise optional `explanation` for reveal discussion. Use 1,000 points unless a clearly announced pedagogical reason supports another value.
- Identify a chain/context whenever a claim depends on it. Do not ask students to connect a wallet, enter a seed phrase, purchase anything, or transact on-chain.
- Create a three-question, five-second `sample-test` quiz for smoke tests and dry runs so the real questions are not spoiled.
- Authoring guidance includes the schema, copyable template, validation command, text/timing guidance, and checklist to fact-check technical claims against primary sources at authoring time.

## Review and acceptance

- `node scripts/validate-quiz.js server/quizzes/blockchain-101.json` and the sample command succeed.
- A reviewer who did not write the quiz checks each question for ambiguity, technical accuracy, and accessible wording; record the review date and fixes in the authoring guide.
- Read questions aloud. Shorten text that cannot be read in five seconds. Use the explanation during REVEAL or in speaker notes, not a new state.
