import { lazy, Suspense, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { AuthPage } from './AuthPage';
import type { AuthSession } from './authApi';
import './styles.css';

const Cafe = lazy(async () => ({ default: (await import('./App')).App }));

type Entry =
  | { kind: 'auth'; notice?: string }
  | { kind: 'demo' }
  | { kind: 'account'; session: AuthSession; expiresAt: number };

function Root() {
  const [entry, setEntry] = useState<Entry>({ kind: 'auth' });

  useEffect(() => {
    if (entry.kind !== 'account') return;
    const expire = () => setEntry(current => current === entry
      ? { kind: 'auth', notice: '로그인 시간이 만료됐어요. 다시 로그인해 주세요.' }
      : current);
    const checkExpiry = () => { if (Date.now() >= entry.expiresAt) expire(); };
    const timer = window.setTimeout(expire, entry.expiresAt - Date.now());
    document.addEventListener('visibilitychange', checkExpiry);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener('visibilitychange', checkExpiry);
    };
  }, [entry]);

  if (entry.kind === 'auth') {
    return <AuthPage notice={entry.notice}
      onLogin={session => setEntry({ kind: 'account', session, expiresAt: Date.now() + session.expiresIn * 1000 })}
      onDemo={() => setEntry({ kind: 'demo' })} />;
  }

  return <Suspense fallback={<main className="auth-loading" role="status">카페를 여는 중이에요…</main>}>
    <Cafe account={entry.kind === 'account' ? entry.session.user : undefined} onExit={() => setEntry({ kind: 'auth' })} />
  </Suspense>;
}

createRoot(document.getElementById('root')!).render(<Root />);
