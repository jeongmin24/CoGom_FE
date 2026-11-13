import { useEffect, useRef, type FormEvent } from 'react';
import { ArrowRight, Coffee, X } from 'lucide-react';

interface JoinDialogProps {
  nickname: string;
  onNicknameChange: (value: string) => void;
  onClose: () => void;
  onSubmit: (event: FormEvent) => void;
}

export function JoinDialog({ nickname, onNicknameChange, onClose, onSubmit }: JoinDialogProps) {
  const dialog = useRef<HTMLElement>(null);
  const nicknameInput = useRef<HTMLInputElement>(null);
  const close = useRef(onClose);
  close.current = onClose;

  useEffect(() => {
    const previousFocus = document.activeElement;
    const panel = dialog.current;
    if (!panel) return;
    nicknameInput.current?.focus({ preventScroll: true });

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        close.current();
        return;
      }
      if (event.key !== 'Tab') return;

      const controls = panel!.querySelectorAll<HTMLElement>(
        'button:not([disabled]), input:not([disabled]), a[href], select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );
      const first = controls[0];
      const last = controls[controls.length - 1];
      if (!first || !last) return;
      const active = document.activeElement;
      if (event.shiftKey && (active === first || !panel!.contains(active))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (active === last || !panel!.contains(active))) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener('keydown', handleKeyDown, true);
    return () => {
      document.removeEventListener('keydown', handleKeyDown, true);
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected) {
        previousFocus.focus({ preventScroll: true });
      }
    };
  }, []);

  return <div className="modal-backdrop" onClick={event => {
    if (event.target === event.currentTarget) onClose();
  }}>
    <section ref={dialog} className="join-dialog" role="dialog" aria-modal="true" aria-labelledby="join-title" aria-describedby="join-description">
      <button type="button" className="dialog-close icon-button" aria-label="입장창 닫기" onClick={onClose}><X size={20} /></button>
      <span className="dialog-cup" aria-hidden="true"><Coffee size={28} /></span>
      <h2 id="join-title">같은 공간에서 만나요</h2>
      <p id="join-description">닉네임을 정하고 카페에 들어오세요.<br />다른 브라우저 창에서도 함께할 수 있어요.</p>
      <form onSubmit={onSubmit}>
        <label htmlFor="nickname">닉네임</label>
        <input ref={nicknameInput} id="nickname" value={nickname} onChange={event => onNicknameChange(event.target.value)} maxLength={16} required autoComplete="nickname" placeholder="예: 코딩하는 곰" />
        <button className="complete-button" type="submit">카페 들어가기 <ArrowRight size={16} /></button>
      </form>
    </section>
  </div>;
}
