# Quiz authoring guide

Quiz files are JSON documents loaded by the server. The quiz `id` must match its filename, such as `blockchain-101.json`. Use four text options and exactly one defensible answer. The server, rather than the browser, decides correctness and scoring.

Hosts can also select **Create a new quiz** on `/host` and enter the title, questions, four options, correct option, time limit, points, and an optional explanation. The editor sends the same validated schema as a JSON file, so invalid drafts are rejected before they can become a game. Editor-created quizzes are available to the running server immediately and are lost on restart; save the final JSON under `server/quizzes/` when it should be reusable after redeploys.

## Schema

The JSON Schema contract is:

```json
{
  "id": "lowercase-id",
  "title": "Quiz title",
  "questions": [
    {
      "text": "Question text (1-200 characters)",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correct": 0,
      "timeLimitSeconds": 20,
      "points": 1000,
      "explanation": "Optional reveal explanation (1-200 characters)."
    }
  ]
}
```

`questions` contains 1–50 items. Each option is 1–80 characters; `correct` is an index from 0 to 3; `timeLimitSeconds` is 5–120; and `points` is 100–2,000. `explanation` is optional. Seminar questions should normally use 15–30 seconds and 1,000 points.

Validate one or more files before loading them:

```bash
node scripts/validate-quiz.js server/quizzes/blockchain-101.json
node scripts/validate-quiz.js server/quizzes/sample-test.json
```

## Writing checklist

- Read each question aloud; shorten it if it cannot be read in about five seconds.
- Use direct wording with one defensible answer. Avoid tricks and “all of the above.”
- Name the chain or context when a claim depends on it, especially for consensus, fees, finality, and Layer 2 behavior.
- Keep the answer and explanation suitable for a reveal discussion. Do not put pre-reveal answer data in client views.
- Do not ask participants to connect a wallet, provide a seed phrase, buy anything, or transact on-chain.
- Avoid price and trading questions. Fact-check technical claims against primary sources at authoring time (for example, Bitcoin Developer Reference, Ethereum protocol/developer documentation, and the relevant L2's official documentation).
- Run both validator commands and have a reviewer who did not write the questions check accuracy, ambiguity, timing, and accessible wording.

## Review record

2026-09-15 — authoring review pass completed for `blockchain-101.json` and `sample-test.json`. The pass checked schema fields, one-answer wording, chain context, timing, scam safety, and reveal explanations; wording was shortened in the nonce, Layer 2, Merkle root, and contract approval questions. An independent seminar reviewer must complete the final fact-check against primary sources before the September 23 freeze.
