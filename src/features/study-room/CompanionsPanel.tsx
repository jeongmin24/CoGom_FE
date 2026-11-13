import { ArrowRight, Bell, Users } from 'lucide-react';
import { BearMark } from '../../shared/BearMark';
import { useRoomStore, WAKE_DISTANCE } from './roomStore';

export function CompanionsPanel({ onJoin }: { onJoin: () => void }) {
  const players = useRoomStore(state => state.players);
  const myId = useRoomStore(state => state.myId);
  const connection = useRoomStore(state => state.connection);
  const wakePlayer = useRoomStore(state => state.wakePlayer);
  const me = players.find(player => player.id === myId);

  return <section id="friends" className="companions paper-panel">
    <div className="panel-heading">
      <div>
        <span className="panel-index">03 / STUDY BUDDIES</span>
        <h2>함께 있는 곰돌이 <span className="count-tag">{players.length}</span></h2>
      </div>
      <Users size={18} />
    </div>
    <ul>{players.map((player, index) => {
      const isMe = player.id === myId;
      const studying = player.status === 'studying';
      const distance = me ? Math.hypot(me.position[0] - player.position[0], me.position[1] - player.position[1]) : Infinity;
      const wakeHint = studying ? '집중하고 있어요' : distance > WAKE_DISTANCE ? '곰돌이 가까이 다가가세요' : '깨우기';
      return <li key={player.id}>
        <span className={'friend-avatar avatar-' + index % 3}><BearMark /></span>
        <div className="friend-info">
          <strong>{player.name}{isMe && <small>나</small>}</strong>
          <span className={studying ? 'studying' : ''}><i />{studying ? '집중 중' : '휴식 중'}</span>
        </div>
        {isMe ? <span className="my-seat">내 자리</span> : <button
          className="wake-button"
          aria-label={player.name + ' 깨우기'}
          title={wakeHint}
          onClick={() => wakePlayer(player.id)}
          disabled={studying}
        ><Bell size={15} /></button>}
      </li>;
    })}</ul>
    <div className="companions-footer">
      <span><i />{connection === 'online' ? '같은 공간, 각자의 몰입' : '다른 창의 친구도 초대해 보세요'}</span>
      <button onClick={onJoin} aria-label="친구와 실시간 입장"><ArrowRight size={16} /></button>
    </div>
  </section>;
}
