const LETTERS = ['A', 'B', 'C', 'D'];
export default function AnswerButton({ optionIndex, children, onClick, disabled, selected, result }) {
  const letter = LETTERS[optionIndex];
  const status = result === 'correct' ? 'Correct' : result === 'incorrect' ? 'Incorrect' : '';
  return <button type="button" className={`answer answer-${optionIndex} ${selected ? 'is-selected' : ''} ${result ? `is-${result}` : ''}`} onClick={onClick} disabled={disabled} aria-label={`${letter}: ${children}${status ? ` — ${status}` : ''}`}>
    <span className="answer-letter" aria-hidden="true">{letter}</span><span>{children}</span>{status && <span className="answer-status">{status}</span>}
  </button>;
}
