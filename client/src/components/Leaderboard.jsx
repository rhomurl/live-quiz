export default function Leaderboard({ leaderboard, own }) {
  return <section className="leaderboard-view screen-enter" aria-labelledby="leaderboard-title"><h2 id="leaderboard-title">Leaderboard</h2><ol className="standing-list">{leaderboard?.top?.map((entry) => <li className="leaderboard-row" key={`${entry.rank}-${entry.nickname}`}><span>{entry.rank}. {entry.nickname}</span><strong>{entry.score} points{entry.delta ? ` (+${entry.delta})` : ''}</strong></li>)}</ol>{own && <p className="own-standing">Your rank: {own.rank}. Your score: {own.score} points.</p>}</section>;
}
