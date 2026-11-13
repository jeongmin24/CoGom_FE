// 백엔드가 다른 출처에 있을 때(예: 프런트엔드는 Vercel, 백엔드는 별도 서버)
// VITE_API_BASE_URL 에 백엔드 주소를 지정한다. 예) https://api.example.com
// 비워 두면 현재 페이지와 같은 출처를 쓴다(Vite 개발 프록시, 동일 출처 배포).
const base = (import.meta.env?.VITE_API_BASE_URL ?? '').trim().replace(/\/+$/, '');

export function apiUrl(path: string): string {
  return base + path;
}

export function wsUrl(path: string): string {
  // http → ws, https → wss
  return (base || location.origin).replace(/^http/, 'ws') + path;
}
