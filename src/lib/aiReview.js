// AI 코드 리뷰 — 프롬프트 생성 / AI 응답 검증 / 백엔드 호출 / 오류 메시지
// 프롬프트·검증 로직은 백엔드(server/index.mjs)와 프론트엔드가 이 파일을 함께 사용한다.
// 실제 API 응답이 올바른 형식일 때만 결과를 반환하고, 그 외에는 모두 예외를 던진다.
// (mock 데이터, 기본 점수, 임시 응답, 가짜 결과 fallback 없음)

const FOCUS_TEXT = {
  all: '보안 취약점, 성능, 코드 품질(가독성·유지보수성·버그 가능성)을 모두',
  security: '보안 취약점(인젝션, 인증/인가, 민감정보 노출, 입력 검증 등)을 중점적으로',
  performance: '성능(시간/공간 복잡도, 불필요한 연산·렌더링, 메모리 누수 등)을 중점적으로',
  quality: '코드 품질(가독성, 네이밍, 구조, 중복, 에러 처리, 잠재적 버그 등)을 중점적으로',
};

export function buildReviewPrompt(lang, focus, code) {
  const numbered = code.split('\n').map((l, i) => `${i + 1}: ${l}`).join('\n');
  return `당신은 시니어 ${lang} 개발자입니다. 아래 코드를 ${FOCUS_TEXT[focus] || FOCUS_TEXT.all} 리뷰하세요.
모든 설명은 한국어로 작성하세요. 코드 앞의 "번호: "는 줄 번호이며 실제 코드가 아닙니다.

반드시 아래 형식의 JSON 객체 하나만 응답하세요.
{
  "score": 0~100 사이 정수 (코드 전체 품질 점수),
  "summary": "전반적인 평가 1~2문장",
  "issues": [
    { "severity": "critical" | "warning" | "info", "line": 문제가 있는 줄 번호(정수), "title": "짧은 제목", "desc": "문제 설명", "fix": "구체적인 수정 방법 또는 수정 코드" }
  ]
}
문제가 없으면 "issues"는 빈 배열로 두세요.

코드:
${numbered}`;
}

export class ReviewResponseError extends Error {
  constructor(reason) { super(`invalid-review-response: ${reason}`); this.code = 'invalid-review-response'; }
}

// AI 응답 텍스트 → 리뷰 객체. 필수 값이 없거나 형식이 틀리면 예외 (임의 값으로 채우지 않음)
export function parseReview(text) {
  if (typeof text !== 'string' || !text.trim()) throw new ReviewResponseError('empty response');
  let raw;
  try { raw = JSON.parse(text.replace(/```json?|```/g, '').trim()); }
  catch { throw new ReviewResponseError('not JSON'); }
  if (!raw || typeof raw !== 'object') throw new ReviewResponseError('not an object');

  const score = typeof raw.score === 'string' && raw.score.trim() !== '' ? Number(raw.score) : raw.score;
  if (typeof score !== 'number' || !Number.isFinite(score) || score < 0 || score > 100) throw new ReviewResponseError('invalid score');
  if (typeof raw.summary !== 'string' || !raw.summary.trim()) throw new ReviewResponseError('missing summary');
  if (!Array.isArray(raw.issues)) throw new ReviewResponseError('issues is not an array');

  const issues = raw.issues.map((i, idx) => {
    if (!i || typeof i !== 'object') throw new ReviewResponseError(`issue ${idx} is not an object`);
    if (!['critical', 'warning', 'info'].includes(i.severity)) throw new ReviewResponseError(`issue ${idx} invalid severity`);
    if (typeof i.title !== 'string' || !i.title.trim()) throw new ReviewResponseError(`issue ${idx} missing title`);
    return {
      severity: i.severity,
      line: Number.isInteger(Number(i.line)) && i.line !== null && i.line !== '' ? Number(i.line) : null,
      title: i.title,
      desc: typeof i.desc === 'string' ? i.desc : '',
      fix: typeof i.fix === 'string' ? i.fix : '',
    };
  });

  return { score: Math.round(score), summary: raw.summary, issues };
}


// ── 프론트엔드 → 백엔드(/api/review) 호출 ──
// 개발 중에는 package.json 의 proxy 설정으로 http://127.0.0.1:5050 으로 전달된다.
// 배포 시 백엔드 주소가 다르면 REACT_APP_REVIEW_API_URL 로 지정 (예: https://api.example.com)
export class ReviewApiError extends Error {
  constructor(code, message, extra = {}) { super(message); this.code = code; Object.assign(this, extra); }
}

export async function requestReviewFromBackend({ lang, focus, code }) {
  const base = process.env.REACT_APP_REVIEW_API_URL || ''; // CRA가 빌드 시 값으로 치환
  let res;
  try {
    res = await fetch(`${base}/api/review`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lang, focus, code }),
    });
  } catch {
    throw new ReviewApiError('backend-unreachable', 'backend unreachable');
  }
  const ct = res.headers.get('content-type') || '';
  const data = ct.includes('application/json') ? await res.json().catch(() => null) : null;
  if (!data) throw new ReviewApiError('backend-unreachable', `backend returned non-JSON (HTTP ${res.status})`);
  if (!res.ok || data.error) {
    const err = data.error || {};
    throw new ReviewApiError(err.code || 'backend-error', err.message || `HTTP ${res.status}`, { upstreamStatus: err.upstreamStatus, upstreamCode: err.upstreamCode, retryAfter: err.retryAfter });
  }
  // 백엔드에서 검증했더라도 화면에 표시하기 전에 한 번 더 같은 기준으로 검증
  return { review: parseReview(JSON.stringify(data.review)), meta: data.meta || {} };
}

// 실패 원인 → 사용자 안내 문구
export function reviewErrorMessage(e) {
  const code = e?.code || '';
  const msg = String(e?.message || '');
  const up = e?.upstreamStatus;

  if (code === 'backend-unreachable') return 'AI 리뷰 서버(백엔드)에 연결할 수 없습니다. 터미널에서 npm run server 가 실행 중인지 확인해 주세요.';
  if (code === 'api-key-missing') return '백엔드 server/.env 에 GROQ_API_KEY 가 설정되지 않았습니다.';
  if (code === 'rate-limited') return msg;
  if (code === 'code-too-long' || code === 'bad-request') return msg;
  if (code === 'origin-not-allowed') return '허용되지 않은 주소에서 요청했습니다. server/.env 의 ALLOWED_ORIGINS 를 확인해 주세요.';
  if (code === 'invalid-review-response') return 'AI 응답 형식이 올바르지 않아 결과를 표시하지 않았습니다. 다시 시도해 주세요.';
  if (code === 'empty-response') return 'AI가 응답을 생성하지 못했습니다. 다시 시도해 주세요.';
  if (code === 'timeout') return 'AI 응답 시간이 초과되었습니다. 잠시 후 다시 시도해 주세요.';
  if (code === 'ai-unreachable') return '백엔드에서 Groq API에 연결하지 못했습니다. 네트워크를 확인해 주세요.';
  if (code === 'ai-error') {
    if (up === 401 || /invalid api key|invalid_api_key/i.test(msg)) return 'Groq API 키가 올바르지 않습니다. server/.env 의 GROQ_API_KEY 를 확인해 주세요.';
    if (up === 429 || /rate limit|rate_limit|quota/i.test(msg)) return `Groq 무료 플랜 사용량 한도에 도달했습니다.${e?.retryAfter ? ` 약 ${e.retryAfter}초 후` : ' 잠시 후'} 다시 시도해 주세요.`;
    if (up === 413 || /too large|context length|maximum context/i.test(msg)) return '코드가 너무 길어 무료 플랜 한도를 넘었습니다. 코드를 나눠서 리뷰해 주세요.';
    if (up === 404 || /model_not_found|does not exist|decommissioned/i.test(msg)) return '설정한 Groq 모델을 사용할 수 없습니다. server/.env 의 GROQ_MODEL 을 확인해 주세요.';
    if (up === 403) return 'Groq API 접근이 거부되었습니다. 계정/조직 설정이나 API 키 권한을 확인해 주세요.';
    if (up === 400) return `Groq 요청 오류: ${msg.slice(0, 120)}`;
    if (up >= 500) return 'Groq 서버에 일시적인 문제가 있습니다. 잠시 후 다시 시도해 주세요.';
    return 'Groq API 호출에 실패했습니다.';
  }
  return 'AI 리뷰 요청에 실패했습니다.';
}
