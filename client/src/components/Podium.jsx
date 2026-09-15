export default function Podium({ podium, own }) {
  return <section className="podium-view screen-enter" aria-labelledby="podium-title"><h2 id="podium-title">Final podium</h2><ol className="podium-list">{podium?.top3?.map((entry) => <li className="podium-row" key={`${entry.rank}-${entry.nickname}`}><span>{entry.rank}. {entry.nickname}</span><strong>{entry.score} points</strong></li>)}</ol>{own && <p className="own-standing">Your final rank: {own.rank}. Your score: {own.score} points.</p>}</section>;
}
