import assert from 'node:assert/strict';
import test from 'node:test';
import { spawn } from 'node:child_process';

test('server responds to /healthz with game counts', async (t) => {
  const port = 3101;
  const child = spawn(process.execPath, ['server/index.js'], {
    cwd: process.cwd(),
    env: { ...process.env, PORT: String(port) },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let output = '';
  child.stderr.on('data', (chunk) => { output += chunk; });
  t.after(() => child.kill());

  const deadline = Date.now() + 3_000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/healthz`);
      assert.equal(response.status, 200, output);
      assert.deepEqual(await response.json(), { ok: true, activeGames: 0, retainedGames: 0 });
      return;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
  }
  assert.fail(`Server did not become healthy: ${output}`);
});
