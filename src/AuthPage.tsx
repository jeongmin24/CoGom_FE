import { useRef, useState, type FormEvent } from 'react';
import { ArrowRight, CircleAlert, Coffee, Eye, EyeOff, LockKeyhole, Mail, UserRound } from 'lucide-react';
import { apiUrl } from './apiBase';
import { BearMark } from './BearMark';
import { authJsonRequest, readLoginResponse, readSignupResponse, type AuthSession } from './authApi';
import './auth.css';

type AuthPageProps = {
  notice?: string;
  onLogin: (session: AuthSession) => void;
  onDemo: () => void;
};

export function AuthPage({ notice, onLogin, onDemo }: AuthPageProps) {
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [status, setStatus] = useState(notice ?? '');
  const emailRef = useRef<HTMLInputElement>(null);
  const signingUp = mode === 'signup';

  function changeMode(nextMode: typeof mode) {
    setMode(nextMode);
    setPasswordVisible(false);
    setError('');
    setStatus('');
    emailRef.current?.focus();
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const fields = new FormData(event.currentTarget);
    const email = String(fields.get('email') ?? '').trim().toLowerCase();
    const password = String(fields.get('password') ?? '');
    const nickname = String(fields.get('nickname') ?? '').trim();
    setStatus('');
    setError('');

    if (signingUp) {
      if (nickname.length < 1 || nickname.length > 16) {
        setError('닉네임을 1~16자로 입력해 주세요.');
        return;
      }
      const passwordLength = Array.from(password).length;
      if (passwordLength < 15 || passwordLength > 128) {
        setError('비밀번호를 15~128자로 입력해 주세요.');
        return;
      }
    }

    setPending(true);
    try {
      if (signingUp) {
        const request = fetch(apiUrl('/api/v1/auth/signup'), {
          ...authJsonRequest({ email, password, nickname }),
          method: 'POST',
        });
        await readSignupResponse(request);
        changeMode('login');
        setStatus('가입이 완료됐어요. 이제 로그인해 주세요.');
      } else {
        const request = fetch(apiUrl('/api/v1/auth/login'), {
          ...authJsonRequest({ email, password }),
          method: 'POST',
        });
        onLogin(await readLoginResponse(request));
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '잠시 후 다시 시도해 주세요.');
    } finally {
      setPending(false);
    }
  }

  return <main className="auth-page">
    <div className="auth-layout">
      <section className="auth-intro" aria-label="CoGom 스터디 카페">
        <div className="auth-brand"><BearMark /><span>co.gom</span></div>
        <div className="auth-intro-copy">
          <p className="auth-intro-title">혼자여도,<br /><span className="highlight-word">함께 집중해요.</span></p>
          <p>곰돌이 친구들과 함께하는 3D 스터디 카페</p>
        </div>
        <figure className="auth-room-preview">
          <img src="/images/cafe-preview.webp" alt="곰돌이들이 각자의 책상에서 공부하는 CoGom 스터디 카페" width="800" height="500" />
          <figcaption><Coffee size={15} aria-hidden="true" /> 창가의 오후</figcaption>
        </figure>
      </section>

      <section className="auth-panel" aria-labelledby="auth-heading">
        <header className="auth-heading">
          <span className="auth-heading-icon"><LockKeyhole size={22} strokeWidth={1.7} aria-hidden="true" /></span>
          <h1 id="auth-heading">{signingUp ? '회원가입' : '로그인'}</h1>
          <p>{signingUp ? '카페에서 사용할 계정을 만들어 보세요.' : '이메일로 로그인하고 카페에 들어오세요.'}</p>
        </header>
        {status && <p className="auth-status" role="status">{status}</p>}
        <form className="auth-form" onSubmit={submit} aria-busy={pending}>
          <div className="auth-field">
            <label htmlFor="auth-email">이메일</label>
            <div className="auth-input">
              <Mail size={18} aria-hidden="true" />
              <input ref={emailRef} id="auth-email" name="email" type="email" autoComplete="username" placeholder="bear@example.com" readOnly={pending} required />
            </div>
          </div>
          {signingUp && <div className="auth-field">
            <label htmlFor="auth-nickname">닉네임</label>
            <div className="auth-input">
              <UserRound size={18} aria-hidden="true" />
              <input id="auth-nickname" name="nickname" autoComplete="nickname" placeholder="코딩곰" readOnly={pending} required />
            </div>
          </div>}
          <div className="auth-field">
            <label htmlFor="auth-password">비밀번호</label>
            <div className="auth-input">
              <LockKeyhole size={18} aria-hidden="true" />
              <input key={mode} id="auth-password" name="password" type={passwordVisible ? 'text' : 'password'}
                autoComplete={signingUp ? 'new-password' : 'current-password'} placeholder="비밀번호 입력"
                aria-describedby={signingUp ? 'auth-password-hint' : undefined} readOnly={pending} required />
              <button className="auth-password-toggle" type="button" disabled={pending} onClick={() => setPasswordVisible(!passwordVisible)}
                aria-label={passwordVisible ? '비밀번호 숨기기' : '비밀번호 보기'} aria-controls="auth-password">
                {passwordVisible ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}
              </button>
            </div>
            {signingUp && <p id="auth-password-hint" className="auth-hint">비밀번호는 15~128자로 입력해 주세요.</p>}
          </div>
          {error && <p className="auth-error" role="alert"><CircleAlert size={17} aria-hidden="true" />{error}</p>}
          <button className="auth-submit" type="submit" disabled={pending}>
            {pending ? '처리 중…' : signingUp ? '계정 만들기' : '로그인'}<ArrowRight size={18} aria-hidden="true" />
          </button>
        </form>
        <div className="auth-panel-footer">
          <p>{signingUp ? '이미 계정이 있나요?' : '처음 방문하셨나요?'} <button type="button" className="auth-text-button" disabled={pending} onClick={() => changeMode(signingUp ? 'login' : 'signup')}>{signingUp ? '로그인' : '회원가입'}</button></p>
          <button type="button" className="auth-demo" disabled={pending} onClick={onDemo}>둘러보기 <ArrowRight size={15} aria-hidden="true" /></button>
        </div>
      </section>
    </div>
  </main>;
}
