import { useState } from 'react';

const newQuestion = () => ({ text: '', options: ['', '', '', ''], correct: 0, timeLimitSeconds: 20, points: 1000, explanation: '' });
const slugify = (value) => value.trim().toLocaleLowerCase().replace(/[^a-z0-9]+/gu, '-').replace(/^-|-$/gu, '').slice(0, 64);

export default function QuizEditor({ hostSecret, onCreated }) {
  const [id, setId] = useState(''); const [title, setTitle] = useState(''); const [questions, setQuestions] = useState([newQuestion()]); const [pending, setPending] = useState(false); const [error, setError] = useState('');
  const updateQuestion = (index, changes) => setQuestions((current) => current.map((question, questionIndex) => questionIndex === index ? { ...question, ...changes } : question));
  const updateOption = (questionIndex, optionIndex, value) => setQuestions((current) => current.map((question, index) => index === questionIndex ? { ...question, options: question.options.map((option, index) => index === optionIndex ? value : option) } : question));
  const submit = async (event) => {
    event.preventDefault(); setError('');
    const quiz = { id: slugify(id), title: title.trim(), questions: questions.map((question) => { const { explanation, ...withoutExplanation } = question; return { ...withoutExplanation, text: question.text.trim(), options: question.options.map((option) => option.trim()), timeLimitSeconds: Number(question.timeLimitSeconds), points: Number(question.points), ...(explanation.trim() ? { explanation: explanation.trim() } : {}) }; }) };
    if (!quiz.id || !quiz.title) return setError('Add a quiz ID and title.');
    setPending(true);
    try {
      const response = await fetch('/api/quizzes', { method: 'POST', headers: { 'content-type': 'application/json', 'x-host-secret': hostSecret }, body: JSON.stringify({ quiz }) });
      const result = await response.json();
      if (!response.ok || !result.ok) throw new Error(result.error ?? 'BAD_PAYLOAD');
      onCreated(result.data);
      setId(''); setTitle(''); setQuestions([newQuestion()]);
    } catch (requestError) {
      setError(requestError.message === 'QUIZ_EXISTS' ? 'That quiz ID already exists.' : requestError.message === 'BAD_SECRET' ? 'The host secret is not valid.' : 'Check the quiz fields and try again.');
    } finally { setPending(false); }
  };
  return <section className="panel quiz-editor screen-enter"><h2>Create a new quiz</h2><p className="help">Add a reusable quiz to this running server. It will be available until the server restarts.</p><form onSubmit={submit}>
    <div className="editor-grid"><label>Quiz ID<input value={id} onChange={(event) => setId(event.target.value)} placeholder="blockchain-review" maxLength="64" required /><span className="help">Lowercase letters, numbers, and hyphens.</span></label><label>Quiz title<input value={title} onChange={(event) => setTitle(event.target.value)} maxLength="200" required /></label></div>
    {questions.map((question, questionIndex) => <fieldset className="quiz-editor-question" key={questionIndex}><legend>Question {questionIndex + 1}</legend><label>Question text<input value={question.text} onChange={(event) => updateQuestion(questionIndex, { text: event.target.value })} maxLength="200" required /></label><div className="editor-grid">{question.options.map((option, optionIndex) => <label key={optionIndex}>Option {String.fromCharCode(65 + optionIndex)}<input value={option} onChange={(event) => updateOption(questionIndex, optionIndex, event.target.value)} maxLength="80" required /></label>)}</div><label>Correct answer<select value={question.correct} onChange={(event) => updateQuestion(questionIndex, { correct: Number(event.target.value) })}>{question.options.map((_, optionIndex) => <option key={optionIndex} value={optionIndex}>Option {String.fromCharCode(65 + optionIndex)}</option>)}</select></label><div className="editor-grid"><label>Time limit (seconds)<input type="number" min="5" max="120" value={question.timeLimitSeconds} onChange={(event) => updateQuestion(questionIndex, { timeLimitSeconds: event.target.value })} required /></label><label>Points<input type="number" min="100" max="2000" value={question.points} onChange={(event) => updateQuestion(questionIndex, { points: event.target.value })} required /></label></div><label>Explanation (optional)<input value={question.explanation} onChange={(event) => updateQuestion(questionIndex, { explanation: event.target.value })} maxLength="200" /></label>{questions.length > 1 && <button type="button" className="quiet-button remove-question" onClick={() => setQuestions((current) => current.filter((_, index) => index !== questionIndex))}>Remove question</button>}</fieldset>)}
    {error && <p className="error" role="alert">{error}</p>}<div className="editor-actions"><button type="button" className="quiet-button" onClick={() => setQuestions((current) => [...current, newQuestion()])} disabled={pending || questions.length >= 50}>Add question</button><button className="primary-button" disabled={pending || !hostSecret}>{pending ? 'Saving…' : 'Save quiz'}</button></div>
  </form></section>;
}
