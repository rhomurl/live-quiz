export default function Distribution({ distribution = [] }) {
  const total = Math.max(1, distribution.reduce((sum, value) => sum + value, 0));
  return <section aria-labelledby="distribution-title"><h3 id="distribution-title">Answer distribution</h3><ul className="distribution">{distribution.map((count, index) => <li key={index}><span>Option {String.fromCharCode(65 + index)}: {count} answer{count === 1 ? '' : 's'}</span><div className="distribution-track"><div className="distribution-bar" style={{ width: `${(count / total) * 100}%` }} /></div></li>)}</ul></section>;
}
