export function scoreAnswer({ correct, points, timeLimitSeconds, responseMs }) {
  if (!correct) return 0;
  const durationMs = timeLimitSeconds * 1000;
  const elapsed = Math.max(0, Math.min(Number(responseMs) || 0, durationMs));
  if (elapsed <= 500) return points;
  return Math.round(points * (1 - (elapsed / durationMs) / 2));
}

export function buildLeaderboard(players) {
  return [...players]
    .sort((a, b) => b.score - a.score
      || a.correctResponseMsTotal - b.correctResponseMsTotal
      || a.normalizedNickname.localeCompare(b.normalizedNickname))
    .map((player, index) => ({
      playerId: player.playerId,
      nickname: player.nickname,
      score: player.score,
      delta: player.delta ?? 0,
      rank: index + 1,
    }));
}

export function rankOf(playerId, leaderboard) {
  return leaderboard.find((entry) => entry.playerId === playerId)?.rank ?? 0;
}
