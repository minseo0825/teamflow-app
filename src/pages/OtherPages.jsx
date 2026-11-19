import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import Modal from '../components/Modal';

const sL = s => ({ todo: '대기', progress: '진행중', review: '리뷰중', done: '완료' }[s] || s);

// ─── PROJECTS ───────────────────────────────────────────────────────────────
export function Projects() {
  const { projects, issues, toast, user, createProject, deleteProject } = useApp();
  const [modal, setModal] = useState(false);
  const [f, setF] = useState({ name: '', desc: '', invite: '' });
  const set = (k, v) => setF(p => ({ ...p, [k]: v }));

  const create = async () => {
    if (!f.name.trim()) { toast('프로젝트 이름을 입력하세요', 'e'); return; }
    const colors = ['#1e4fd8', '#1a7f4e', '#6b3fc4', '#d97706', '#d93025', '#0891b2'];
    await createProject({
      name: f.name,
      desc: f.desc || '새 프로젝트',
      color: colors[projects.length % colors.length],
      progress: 0,
      members: [user.name],
    });
    setModal(false);
    setF({ name: '', desc: '', invite: '' });
  };

  return (
    <div>
      <div className="g3">
        {projects.map(p => (
          <div key={p.id} className="pcard">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <div style={{ width: 9, height: 9, borderRadius: '50%', background: p.color }} />
              <div className="pcard-name" style={{ flex: 1 }}>{p.name}</div>
              <button className="btn btn-danger btn-xs" onClick={e => { e.stopPropagation(); if(window.confirm(`"${p.name}" 프로젝트를 삭제할까요?`)) deleteProject(p.id); }}>삭제</button>
            </div>
            <div className="pcard-desc">{p.desc}</div>
            <div className="prog mb16"><div className="prog-f" style={{ width: `${p.progress}%`, background: p.color }} /></div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--text3)', marginBottom: 12 }}>
              <span>진행률</span><span style={{ fontWeight: 500 }}>{p.progress}%</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div className="av-stack">{(p.members || []).slice(0, 4).map(m => <div key={m} className="av av-sm">{m[0]}</div>)}</div>
              <span style={{ fontSize: 12, color: 'var(--text3)' }}>이슈 {issues.filter(i => i.pid === p.id).length}개</span>
            </div>
          </div>
        ))}
        <div className="pcard" style={{ borderStyle: 'dashed', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, minHeight: 200, background: 'transparent', boxShadow: 'none' }} onClick={() => setModal(true)}>
          <div style={{ width: 34, height: 34, border: '1.5px dashed var(--border2)', borderRadius: '50%', display: 'grid', placeItems: 'center', fontSize: 20, color: 'var(--text3)' }}>+</div>
          <div style={{ fontSize: 13, color: 'var(--text3)', fontWeight: 500 }}>새 프로젝트 추가</div>
        </div>
      </div>
      <Modal open={modal} onClose={() => setModal(false)}>
        <div className="modal-title">새 프로젝트</div>
        <div className="fg"><label className="fl">프로젝트 이름</label><input className="fi" value={f.name} onChange={e => set('name', e.target.value)} placeholder="예: 서비스 리뉴얼" /></div>
        <div className="fg"><label className="fl">설명</label><textarea rows={2} value={f.desc} onChange={e => set('desc', e.target.value)} placeholder="프로젝트 목적을 간략히 입력하세요" style={{ resize: 'none' }} /></div>
        <div className="fg"><label className="fl">팀원 초대 이메일</label><input className="fi" value={f.invite} onChange={e => set('invite', e.target.value)} placeholder="colleague@company.com" /></div>
        <div className="modal-ft">
          <button className="btn btn-outline" onClick={() => setModal(false)}>취소</button>
          <button className="btn btn-primary" onClick={create}>생성</button>
        </div>
      </Modal>
    </div>
  );
}

// ─── AI SUMMARY ─────────────────────────────────────────────────────────────
function AiSummary({ raw }) {
  let bullets = [], oneliner = '';
  try { const p = JSON.parse(raw); bullets = p.bullets || []; oneliner = p.oneliner || ''; }
  catch { oneliner = raw; }
  return (
    <div className="ai-sum">
      <div className="ai-tag">✦ AI 요약</div>
      {bullets.length > 0 && <ul className="ai-sum-bullets">{bullets.map((b, i) => <li key={i}>{b}</li>)}</ul>}
      {oneliner && <div className="ai-oneliner"><span className="ai-oneliner-label">한 줄 요약</span>{oneliner}</div>}
    </div>
  );
}

// ─── CODE REVIEW ────────────────────────────────────────────────────────────
const PLACEHOLDER = `// 여기에 리뷰받을 코드를 붙여넣으세요`;

function fbReview() {
  return { score: 42, summary: '심각한 보안 취약점과 런타임 에러가 발견되었습니다.', issues: [{ severity: 'critical', line: 2, title: 'SQL 인젝션 취약점', desc: '문자열 연결로 쿼리를 구성하면 SQL 인젝션에 취약합니다.', fix: 'db.query("SELECT * FROM users WHERE id = ?", [userId]) 사용' }] };
}

export function CodeReview() {
  const { toast, addNotif } = useApp();
  const [code, setCode] = useState('');
  const [lang, setLang] = useState('javascript');
  const [focus, setFocus] = useState('all');
  const [review, setReview] = useState(null);
  const [loading, setLoading] = useState(false);

  const run = async () => {
    if (!code.trim()) { toast('코드를 입력하세요', 'e'); return; }
    setLoading(true); setReview(null);
    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ model: 'claude-sonnet-4-6', max_tokens: 1000, messages: [{ role: 'user', content: `시니어 ${lang} 개발자로서 아래 코드를 리뷰해주세요. 반드시 JSON만 응답하세요(마크다운 없이):\n{"score":85,"summary":"전반적 평가","issues":[{"severity":"critical","line":2,"title":"제목","desc":"설명","fix":"수정방법"}]}\n\n코드:\n\`\`\`${lang}\n${code}\n\`\`\`` }] }) });
      const d = await res.json();
      setReview(JSON.parse(d.content?.[0]?.text?.replace(/```json?|```/g, '').trim() || '{}'));
    } catch { setReview(fbReview()); }
    setLoading(false);
    toast('코드 리뷰 완료', 's');
    addNotif('ai', 'AI 코드 리뷰 완료');
  };

  const sc = review ? (review.score >= 80 ? 'var(--green)' : review.score >= 60 ? 'var(--orange)' : 'var(--red)') : null;

  return (
    <div className="g2" style={{ gap: 20, alignItems: 'start' }}>
      <div className="card">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <span style={{ fontSize: 13.5, fontWeight: 600 }}>코드 입력</span>
          <button className="btn btn-ghost btn-xs" onClick={() => setCode('')}>새로 작성</button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
          <div><label className="fl">언어</label>
            <select value={lang} onChange={e => setLang(e.target.value)}>
              <option value="javascript">JavaScript</option><option value="typescript">TypeScript</option>
              <option value="python">Python</option><option value="java">Java</option><option value="go">Go</option>
            </select>
          </div>
          <div><label className="fl">분석 관점</label>
            <select value={focus} onChange={e => setFocus(e.target.value)}>
              <option value="all">전체 (보안+성능+품질)</option><option value="security">보안 취약점</option>
              <option value="performance">성능 최적화</option><option value="quality">코드 품질</option>
            </select>
          </div>
        </div>
        <div className="fg">
          <label className="fl">코드</label>
          <textarea className="mono" rows={16} value={code} onChange={e => setCode(e.target.value)} placeholder={PLACEHOLDER} />
        </div>
        <button className="btn btn-primary btn-full" onClick={run}>AI 코드 리뷰 시작</button>
      </div>

      <div>
        {loading ? (
          <div className="card" style={{ minHeight: 280 }}>
            <div style={{ fontSize: 13.5, fontWeight: 600, marginBottom: 16 }}>분석 중...</div>
            <div className="think"><div className="td" /><div className="td" /><div className="td" /></div>
          </div>
        ) : review ? (
          <>
            <div className="card mb16">
              <div style={{ display: 'flex', gap: 16, alignItems: 'center', marginBottom: 12 }}>
                <div style={{ textAlign: 'center', flexShrink: 0 }}>
                  <div style={{ fontSize: 36, fontWeight: 800, color: sc, letterSpacing: -2, lineHeight: 1 }}>{review.score}</div>
                  <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>/ 100점</div>
                </div>
                <div>
                  <div className="ai-tag" style={{ marginBottom: 6 }}>✦ AI 분석 결과</div>
                  <div style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.6 }}>{review.summary}</div>
                </div>
              </div>
            </div>
            {(review.issues || []).map((iss, i) => (
              <div key={i} className="ri">
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                  <span className={`sev-${iss.severity === 'critical' ? 'c' : iss.severity === 'warning' ? 'w' : 'i'}`}>{iss.severity === 'critical' ? '긴급' : iss.severity === 'warning' ? '경고' : '정보'}</span>
                  <span style={{ fontSize: 11.5, fontFamily: 'var(--mono)', color: 'var(--text3)', background: 'var(--bg)', padding: '1px 7px', borderRadius: 3, border: '1px solid var(--border)' }}>Line {iss.line}</span>
                  <span style={{ fontSize: 13, fontWeight: 600 }}>{iss.title}</span>
                </div>
                <div style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.6, marginBottom: 5 }}>{iss.desc}</div>
                <div className="ri-fix">{iss.fix}</div>
              </div>
            ))}
          </>
        ) : (
          <div className="card" style={{ minHeight: 280, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', gap: 10 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text2)' }}>분석 대기 중</div>
            <div style={{ fontSize: 13, color: 'var(--text3)' }}>코드를 입력하고 분석을 시작하세요</div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── GITHUB ─────────────────────────────────────────────────────────────────
export function Github() {
  const { toast } = useApp();
  return (
    <div>
      <div className="card mb16" style={{ background: 'var(--blue-bg)', borderColor: 'var(--blue-b)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ width: 38, height: 38, borderRadius: '50%', background: 'var(--accent-light)', border: '1.5px solid var(--blue-b)', display: 'grid', placeItems: 'center' }}>
            <svg width="18" height="18" fill="none" stroke="var(--accent)" strokeWidth="1.6" strokeLinecap="round" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/></svg>
          </div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 600 }}>GitHub 연동</div>
            <div style={{ fontSize: 13, color: 'var(--text2)', marginTop: 2 }}>GitHub OAuth App 등록 및 Webhook 설정 후 커밋/PR이 표시됩니다</div>
          </div>
          <button className="btn btn-primary btn-sm" style={{ marginLeft: 'auto' }} onClick={() => toast('GitHub OAuth 연동은 배포 후 활성화됩니다', 'i')}>연동 설정</button>
        </div>
      </div>
      <div className="g2">
        <div className="card">
          <div style={{ marginBottom: 16 }}><span style={{ fontSize: 13.5, fontWeight: 600 }}>최근 커밋</span></div>
          <div className="empty-st"><div className="empty-lbl">GitHub 미연동</div><div style={{ fontSize: 13 }}>연동 후 커밋이 표시됩니다</div></div>
        </div>
        <div className="card">
          <div style={{ marginBottom: 16 }}><span style={{ fontSize: 13.5, fontWeight: 600 }}>Pull Requests</span></div>
          <div className="empty-st"><div className="empty-lbl">GitHub 미연동</div><div style={{ fontSize: 13 }}>연동 후 PR이 표시됩니다</div></div>
        </div>
      </div>
    </div>
  );
}

// ─── STATS ───────────────────────────────────────────────────────────────────
export function Stats() {
  const { issues, meetings, projects } = useApp();
  const sc = { todo: 0, progress: 0, review: 0, done: 0 };
  const pc = { critical: 0, high: 0, medium: 0, low: 0 };
  issues.forEach(i => { sc[i.status] = (sc[i.status] || 0) + 1; pc[i.priority] = (pc[i.priority] || 0) + 1; });
  const total = issues.length || 1;
  const ac = {};
  issues.forEach(i => { ac[i.assignee] = (ac[i.assignee] || 0) + 1; });
  const top = Object.entries(ac).sort((a, b) => b[1] - a[1]).slice(0, 5);
  const maxA = Math.max(...top.map(a => a[1]), 1);

  return (
    <div>
      <div className="g4 mb20">
        <div className="sc"><div className="sc-label">전체 이슈</div><div className="sc-val">{issues.length}</div><div className="sc-sub c-txt2">등록된 전체</div></div>
        <div className="sc"><div className="sc-label">완료율</div><div className="sc-val c-grn">{Math.round(((sc.done || 0) / total) * 100)}%</div><div className="sc-sub" style={{ color: 'var(--green)' }}>{sc.done || 0}건 완료</div></div>
        <div className="sc"><div className="sc-label">긴급 이슈</div><div className="sc-val c-red">{pc.critical || 0}</div><div className="sc-sub c-red">즉시 처리 필요</div></div>
        <div className="sc"><div className="sc-label">총 회의록</div><div className="sc-val">{meetings.length}</div><div className="sc-sub c-txt2">기록됨</div></div>
      </div>
      <div className="g2 mb16">
        <div className="card">
          <div style={{ marginBottom: 16 }}><span style={{ fontSize: 13.5, fontWeight: 600 }}>이슈 상태 분포</span></div>
          {[['대기', 'todo', 'var(--text3)'], ['진행중', 'progress', 'var(--blue)'], ['리뷰중', 'review', 'var(--purple)'], ['완료', 'done', 'var(--green)']].map(([l, k, c]) => (
            <div key={k} className="brow">
              <div className="blabel">{l}</div>
              <div className="btrack"><div className="bfill" style={{ width: `${Math.round(((sc[k] || 0) / total) * 100)}%`, background: c }} /></div>
              <div className="bval">{sc[k] || 0}</div>
            </div>
          ))}
        </div>
        <div className="card">
          <div style={{ marginBottom: 16 }}><span style={{ fontSize: 13.5, fontWeight: 600 }}>우선순위 분포</span></div>
          {[['긴급', 'critical', 'var(--red)'], ['높음', 'high', 'var(--orange)'], ['보통', 'medium', 'var(--blue)'], ['낮음', 'low', 'var(--text3)']].map(([l, k, c]) => (
            <div key={k} className="brow">
              <div className="blabel">{l}</div>
              <div className="btrack"><div className="bfill" style={{ width: `${Math.round(((pc[k] || 0) / total) * 100)}%`, background: c }} /></div>
              <div className="bval">{pc[k] || 0}</div>
            </div>
          ))}
        </div>
      </div>
      <div className="g2">
        <div className="card">
          <div style={{ marginBottom: 16 }}><span style={{ fontSize: 13.5, fontWeight: 600 }}>팀원별 이슈</span></div>
          {top.length === 0 ? <div style={{ fontSize: 13, color: 'var(--text3)' }}>데이터가 없습니다</div> : top.map(([name, count]) => (
            <div key={name} className="brow">
              <div className="blabel" style={{ minWidth: 62 }}>{name}</div>
              <div className="btrack"><div className="bfill" style={{ width: `${Math.round((count / maxA) * 100)}%`, background: 'var(--accent)' }} /></div>
              <div className="bval">{count}</div>
            </div>
          ))}
        </div>
        <div className="card">
          <div style={{ marginBottom: 16 }}><span style={{ fontSize: 13.5, fontWeight: 600 }}>프로젝트별 현황</span></div>
          {projects.map(p => {
            const pi = issues.filter(i => i.pid === p.id);
            const pd = pi.filter(i => i.status === 'done').length;
            return (
              <div key={p.id} style={{ marginBottom: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 7 }}>
                  <span style={{ fontSize: 13, fontWeight: 500, display: 'flex', alignItems: 'center', gap: 7 }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: p.color, display: 'inline-block' }} />{p.name}
                  </span>
                  <span style={{ fontSize: 12, color: 'var(--text3)' }}>{pd}/{pi.length} 완료</span>
                </div>
                <div className="prog"><div className="prog-f" style={{ width: `${p.progress}%`, background: p.color }} /></div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
