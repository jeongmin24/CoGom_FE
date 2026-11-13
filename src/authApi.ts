export type AuthUser = {
  id: string;
  email: string;
  nickname: string;
};

export type AuthSession = {
  accessToken: string;
  tokenType: 'Bearer';
  expiresIn: number;
  user: AuthUser;
};

type Credentials = { email: string; password: string };
type SignupInput = Credentials & { nickname: string };

const errorMessages: Record<string, string> = {
  VALIDATION_ERROR: '입력한 정보를 다시 확인해 주세요.',
  EMAIL_ALREADY_EXISTS: '이미 가입한 이메일이에요. 로그인해 주세요.',
  INVALID_CREDENTIALS: '이메일 또는 비밀번호가 올바르지 않아요.',
  TOO_MANY_REQUESTS: '로그인 시도가 너무 많아요. 잠시 후 다시 시도해 주세요.',
};

function isAuthUser(value: unknown): value is AuthUser {
  return !!value && typeof value === 'object'
    && 'id' in value && typeof value.id === 'string' && value.id.length > 0
    && 'email' in value && typeof value.email === 'string'
    && 'nickname' in value && typeof value.nickname === 'string';
}

export function authJsonRequest(input: Credentials | SignupInput): RequestInit {
  return {
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(input),
    signal: AbortSignal.timeout(15_000),
  };
}

async function readAuthResponse(request: Promise<Response>, expectedStatus: number): Promise<unknown> {
  let response: Response;
  try {
    response = await request;
  } catch {
    throw new Error('서버에 연결할 수 없어요. 잠시 후 다시 시도해 주세요.');
  }

  const body: unknown = await response.json().catch(() => null);
  if (response.status !== expectedStatus) {
    const code = body && typeof body === 'object' && 'code' in body ? body.code : null;
    const message = typeof code === 'string' && Object.hasOwn(errorMessages, code) ? errorMessages[code] : null;
    throw new Error(message ?? '요청을 처리할 수 없어요. 잠시 후 다시 시도해 주세요.');
  }
  return body;
}

export async function readSignupResponse(request: Promise<Response>): Promise<void> {
  if (!isAuthUser(await readAuthResponse(request, 201))) {
    throw new Error('가입 결과를 확인할 수 없어요. 로그인 화면에서 다시 확인해 주세요.');
  }
}

export async function readLoginResponse(request: Promise<Response>): Promise<AuthSession> {
  const body = await readAuthResponse(request, 200);
  if (body && typeof body === 'object'
    && 'accessToken' in body && typeof body.accessToken === 'string' && body.accessToken.length > 0
    && 'tokenType' in body && body.tokenType === 'Bearer'
    && 'expiresIn' in body && typeof body.expiresIn === 'number' && Number.isInteger(body.expiresIn) && body.expiresIn > 0 && body.expiresIn <= 1800
    && 'user' in body && isAuthUser(body.user)) {
    return { accessToken: body.accessToken, tokenType: body.tokenType, expiresIn: body.expiresIn, user: body.user };
  }
  throw new Error('로그인 정보를 확인할 수 없어요. 잠시 후 다시 시도해 주세요.');
}
