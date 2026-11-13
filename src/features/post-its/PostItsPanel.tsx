import { useState, type FormEvent } from 'react';
import { Check, Sparkles, StickyNote } from 'lucide-react';
import { useRoomStore } from '../study-room/roomStore';
import './postIts.css';

export function PostItsPanel() {
  const todos = useRoomStore(state => state.todos);
  const completeTodo = useRoomStore(state => state.completeTodo);
  const [todo, setTodo] = useState('');

  function finishTodo(event: FormEvent) {
    event.preventDefault();
    if (!todo.trim()) return;
    completeTodo(todo);
    setTodo('');
  }

  return <section id="notes" className="done-section paper-panel">
    <div className="panel-heading">
      <div>
        <span className="panel-index">04 / LITTLE WINS</span>
        <h2>오늘의 작은 성취 <span className="count-tag">{todos.length}</span></h2>
      </div>
      <Sparkles size={19} strokeWidth={1.6} />
    </div>
    <p className="section-description">작은 일도 좋아요. 해낸 일을 적으면 카페 벽에 붙어요.</p>
    <form onSubmit={finishTodo}>
      <label className="sr-only" htmlFor="done-input">완료한 일</label>
      <input
        id="done-input"
        value={todo}
        onChange={event => setTodo(event.target.value)}
        placeholder="방금 해낸 일은 무엇인가요?"
        maxLength={70}
        required
      />
      <button className="complete-button" type="submit"><Check size={16} /><span>완료하고 붙이기</span></button>
    </form>
    <div className="sticky-list">{todos.slice(-3).reverse().map((item, index) => <article
      key={item.id} className={'sticky sticky-' + index % 3}
    >
      <span className="note-check"><Check size={13} /></span>
      <p>{item.text}</p>
      <span className="note-author">— {item.authorName}</span>
    </article>)}</div>
    {todos.length === 0 && <div className="empty-notes">
      <StickyNote size={24} /><span>아직은 빈 페이지.<br />첫 번째 성취를 남겨보세요.</span>
    </div>}
    <span className="notes-caption handwritten">little by little, a little becomes a lot.</span>
  </section>;
}
