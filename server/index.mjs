// TeamFlow AI 코드 리뷰 백엔드
// - 브라우저 → POST /api/review → (이 서버) → Groq API (OpenAI 호환 Chat Completions)
// - Groq API 키는 server/.env 에만 저장되며 브라우저로 절대 전달되지 않음
// - 실제 AI 응답이 검증을 통과했을 때만 결과를 반환 (mock / 기본값 / 가짜 결과 없음)
// 실행: npm run server   (Node 20.12+ 필요, 추가 패키지 없음)

import http from 'node:http';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { buildReviewPrompt, parseReview } from '../src/lib/aiReview.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.join(__dirname, '.env');
if (fs.existsSync(envPath)) process.loadEnvFile(envPath);

const GROQ_API_KEY = (process.env.GROQ_API_KEY || '').trim();
const GROQ_MODEL = (process.env.GROQ_MODEL || 'openai/gpt-oss-120b').trim();
// gpt-oss 계열 추론 강도 (low | medium | high). 무료 플랜 토큰 한도를 고려해 기본 medium
const GROQ_REASONING_EFFORT = (process.env.GROQ_REASONING_EFFORT || 'medium').trim();
const AI_TIMEOUT_MS = Number(process.env.AI_TIMEOUT_MS || 90000);
const PORT = Number(process.env.PORT || 5050);
const HOST = process.env.HOST || '127.0.0.1';
const ALLOWED_ORIGINS = [
  ...(process.env.ALLOWED_ORIGINS || 'http://localhost:3000,http://localhost:3001').split(',').map(s => s.trim()).filter(Boolean),
  // 개발 서버(npm start)의 proxy 는 Origin 헤더를 백엔드 자신의 주소로 바꿔서 전달함
  `http://127.0.0.1:${PORT}`, `http://localhost:${PORT}`,
];
const MAX_CODE_CHARS = Number(process.env.MAX_CODE_CHARS || 20000);
const RATE_LIMIT_PER_MIN = Number(process.env.RATE_LIMIT_PER_MIN || 10);

const LANGS = ['javascript', 'typescript', 'python', 'java', 'go'];
const FOCUSES = ['all', 'security', 'performance', 'quality'];

// ── 간단한 IP별 요청 제한 (무료 사용량 보호) ──
const hits = new Map();
const rateLimited = (ip) => {
  const now = Date.now();
  const list = (hits.get(ip) || []).filter(t => now - t < 60_000);
  list.push(now);
  hits.set(ip, list);
  return list.length > RATE_LIMIT_PER_MIN;
};

const send = (res, status, body, origin) => {
  const headers = { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' };
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    headers['Access-Control-Allow-Origin'] = origin;
    headers['Vary'] = 'Origin';
  }
  res.writeHead(status, headers);
  res.end(JSON.stringify(body));
};

const fail = (res, status, code, message, origin, extra = {}) =>
  send(res, status, { error: { code, message, ...extra } }, origin);

const readJson = (req, limit = MAX_CODE_CHARS * 4 + 2048) => new Promise((resolve, reject) => {
  let size = 0; const chunks = [];
  req.on('data', c => { size += c.length; if (size > limit) { reject(Object.assign(new Error('payload too large'), { status: 413 })); req.destroy(); } else chunks.push(c); });
  req.on('end', () => { try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}')); } catch { reject(Object.assign(new Error('invalid JSON body'), { status: 400 })); } });
  req.on('error', reject);
});

// ── 실제 Groq API 호출 ──
async function callGroq(prompt) {
  const body = {
    model: GROQ_MODEL,
    messages: [
      { role: 'system', content: '당신은 숙련된 코드 리뷰어입니다. 모든 설명은 한국어로 작성하고, 요청한 JSON 객체 하나만 출력합니다.' },
      { role: 'user', content: prompt },
    ],
    temperature: 0.2,
    response_format: { type: 'json_object' },
  };
  if (/gpt-oss/i.test(GROQ_MODEL)) body.reasoning_effort = GROQ_REASONING_EFFORT;

  const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${GROQ_API_KEY}` },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(AI_TIMEOUT_MS),
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) {
    const err = new Error(data?.error?.message || `Groq API HTTP ${r.status}`);
    err.upstreamStatus = r.status;
    err.upstreamCode = data?.error?.code || data?.error?.type;
    err.retryAfter = r.headers.get('retry-after');
    throw err;
  }
  const choice = data.choices?.[0];
  const text = choice?.message?.content || '';
  if (!text) {
    const err = new Error(`AI가 응답을 생성하지 않았습니다 (finish_reason: ${choice?.finish_reason || 'unknown'})`);
    err.code = 'empty-response';
    throw err;
  }
  return { text, model: data.model || GROQ_MODEL, responseId: data.id, usage: data.usage };
}

const server = http.createServer(async (req, res) => {
  const origin = req.headers.origin;
  const ip = req.socket.remoteAddress || 'unknown';

  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      ...(origin && ALLOWED_ORIGINS.includes(origin) ? { 'Access-Control-Allow-Origin': origin, Vary: 'Origin' } : {}),
      'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '600',
    });
    return res.end();
  }

  if (req.method === 'GET' && req.url === '/api/health') {
    // 키 값은 절대 반환하지 않음 (설정 여부만)
    return send(res, 200, { ok: true, provider: 'groq', model: GROQ_MODEL, keyConfigured: !!GROQ_API_KEY }, origin);
  }

  if (req.method === 'POST' && req.url === '/api/review') {
    if (origin && !ALLOWED_ORIGINS.includes(origin)) return fail(res, 403, 'origin-not-allowed', '허용되지 않은 출처의 요청입니다.', origin);
    if (!GROQ_API_KEY) return fail(res, 500, 'api-key-missing', '백엔드 server/.env 에 GROQ_API_KEY 가 설정되지 않았습니다.', origin);
    if (rateLimited(ip)) return fail(res, 429, 'rate-limited', `요청이 너무 많습니다. 1분에 ${RATE_LIMIT_PER_MIN}회까지 가능합니다.`, origin);

    let input;
    try { input = await readJson(req); }
    catch (e) { return fail(res, e.status || 400, 'bad-request', e.message, origin); }

    const { lang, focus, code } = input || {};
    if (!LANGS.includes(lang)) return fail(res, 400, 'bad-request', '지원하지 않는 언어입니다.', origin);
    if (!FOCUSES.includes(focus)) return fail(res, 400, 'bad-request', '지원하지 않는 분석 관점입니다.', origin);
    if (typeof code !== 'string' || !code.trim()) return fail(res, 400, 'bad-request', '코드를 입력하세요.', origin);
    if (code.length > MAX_CODE_CHARS) return fail(res, 413, 'code-too-long', `코드는 ${MAX_CODE_CHARS.toLocaleString()}자까지 리뷰할 수 있습니다.`, origin);

    const started = Date.now();
    try {
      const { text, model, responseId, usage } = await callGroq(buildReviewPrompt(lang, focus, code));
      const review = parseReview(text); // 형식이 틀리면 예외 → 결과 반환 안 함
      console.log(`[review] ok ${lang}/${focus} ${Date.now() - started}ms model=${model} tokens=${usage?.total_tokens ?? '-'}`);
      return send(res, 200, { review, meta: { provider: 'groq', model, responseId, ms: Date.now() - started } }, origin);
    } catch (e) {
      console.error(`[review] fail ${lang}/${focus}:`, e.upstreamStatus || e.code || '', e.message);
      if (e.code === 'invalid-review-response') return fail(res, 502, 'invalid-review-response', 'AI 응답 형식이 올바르지 않아 결과를 표시하지 않았습니다.', origin);
      if (e.code === 'empty-response') return fail(res, 502, 'empty-response', e.message, origin);
      if (e.name === 'TimeoutError') return fail(res, 504, 'timeout', 'AI 응답 시간이 초과되었습니다.', origin);
      if (e.upstreamStatus) return fail(res, 502, 'ai-error', e.message, origin, { upstreamStatus: e.upstreamStatus, upstreamCode: e.upstreamCode, retryAfter: e.retryAfter });
      return fail(res, 502, 'ai-unreachable', 'Groq API에 연결하지 못했습니다.', origin);
    }
  }

  return fail(res, 404, 'not-found', 'Not found', origin);
});

server.listen(PORT, HOST, () => {
  console.log(`TeamFlow AI 리뷰 서버: http://${HOST}:${PORT}  (Groq, model=${GROQ_MODEL}, API 키 ${GROQ_API_KEY ? '설정됨' : '없음 — server/.env 확인'})`);
});
