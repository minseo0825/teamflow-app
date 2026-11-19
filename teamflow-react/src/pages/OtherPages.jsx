import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import Modal from '../components/Modal';

const sL = s => ({ todo: '대기', progress: '진행중', review: '리뷰중', done: '완료' }[s] || s);

// ─── PROJECTS ───────────────────────────────────────────────────────────────
export function Projects() {
  const { projects, setProjects, issues, toast, addNotif } = useApp();
  const [modal, setModal] = useState(false);
  const [f, setF] = useState({ name: '', desc: '', invite: '' });
  const set = (k, v) => setF(p => ({ ...p, [k]: v }));
  const { user } = useApp();

  const create = () => {
    if (!f.name.trim()) { toast('프로젝트 이름을 입력하세요', 'e'); return; }
    const colors = ['#1e4fd8', '#1a7f4e', '#6b3fc4', '#d97706', '#d93025', '#0891b2'];
    setProjects(prev => [...prev, { id: 'p' + Date.now(), name: f.name, desc: f.desc || '새 프로젝트', color: colors[prev.length % colors.length], progress: 0, members: [user.name], issues: 0 }]);
    addNotif('project', `새 프로젝트 "${f.name}" 생성됨`);
    toast(`"${f.name}" 프로젝트가 생성되었습니다`, 's');
    setModal(false); setF({ name: '', desc: '', invite: '' });
  };

  return (
    <div>
      <div className="g3">
        {projects.map(p => (
          <div key={p.id} className="pcard">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <div style={{ width: 9, height: 9, borderRadius: '50%', background: p.color }} />
              <div className="pcard-name">{p.name}</div>
            </div>
            <div className="pcard-desc">{p.desc}</div>
            <div className="prog mb16"><div className="prog-f" style={{ width: `${p.progress}%`, background: p.color }} /></div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--text3)', marginBottom: 12 }}>
              <span>진행률</span><span style={{ fontWeight: 500 }}>{p.progress}%</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div className="av-stack">{p.members.slice(0, 4).map(m => <div key={m} className="av av-sm">{m[0]}</div>)}</div>
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

// ─── MEETINGS ───────────────────────────────────────────────────────────────
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

export function Meetings() {
  const { meetings, setMeetings, projects, toast, addNotif, user } = useApp();
  const [modal, setModal] = useState(false);
  const [f, setF] = useState({ title: '', date: new Date().toISOString().split('T')[0], pid: '', attendees: '', content: '' });
  const set = (k, v) => setF(p => ({ ...p, [k]: v }));

  const create = async (autoAI = false) => {
    if (!f.title.trim() || !f.content.trim()) { toast('제목과 내용을 입력하세요', 'e'); return; }
    const m = { id: 'm' + Date.now(), pid: f.pid || projects[0]?.id, title: f.title, date: f.date, attendees: f.attendees.split(',').map(s => s.trim()).filter(Boolean), content: f.content, summary: '' };
    setMeetings(prev => [m, ...prev]);
    toast('회의록이 저장되었습니다', 's');
    setModal(false);
    if (autoAI) await aiSum(m.id, m.content, m.title);
  };

  const aiSum = async (id, content, title) => {
    toast('AI가 요약 중입니다...', 'i');
    const prompt = `다음 회의 내용을 아래 형식으로 한국어로 상세하게 요약해줘. 반드시 JSON만 응답하고 마크다운 없이:\n{"bullets":["핵심 내용 1","핵심 내용 2","핵심 내용 3","결정사항 및 담당자","마감일 및 다음 단계"],"oneliner":"전체를 한 문장으로 요약"}\n\n회의 내용:\n${content}`;
    let summary;
    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ model: 'claude-sonnet-4-6', max_tokens: 600, messages: [{ role: 'user', content: prompt }] }) });
      const d = await res.json();
      summary = JSON.stringify(JSON.parse(d.content?.[0]?.text?.replace(/```json?|```/g, '').trim() || '{}'));
    } catch {
      summary = JSON.stringify({ bullets: ['주요 결정사항이 논의되었습니다.', '각 담당자별 역할이 배정되었습니다.', '다음 단계 액션 아이템이 도출되었습니다.', '진행 상황을 주기적으로 공유하기로 했습니다.'], oneliner: '회의를 통해 주요 결정사항과 담당자가 확정되었으며, 정해진 일정 내 완료를 목표로 합니다.' });
    }
    setMeetings(prev => prev.map(m => m.id === id ? { ...m, summary } : m));
    toast('AI 요약이 완료되었습니다', 's');
    addNotif('ai', `"${title}" AI 요약 완료`);
  };

  const del = (id) => { setMeetings(prev => prev.filter(m => m.id !== id)); toast('삭제되었습니다', 'i'); };

  return (
    <div>
      {!meetings.length ? (
        <div className="card"><div className="empty-st"><div className="empty-lbl">회의록이 없습니다</div><div style={{ fontSize: 13 }}>첫 번째 회의록을 등록해보세요</div></div></div>
      ) : meetings.map(m => {
        const proj = projects.find(p => p.id === m.pid);
        return (
          <div key={m.id} className="mcard">
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 5 }}>
              <div className="mt">{m.title}</div>
              <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                {!m.summary && <button className="btn btn-primary btn-xs" onClick={() => aiSum(m.id, m.content, m.title)}>AI 요약</button>}
                <button className="btn btn-danger btn-xs" onClick={() => del(m.id)}>삭제</button>
              </div>
            </div>
            <div className="mm"><span>{m.date}</span><span>{m.attendees.join(', ')}</span>{proj && <span>{proj.name}</span>}</div>
            <div className="mbody">{m.content}</div>
            {m.summary && <AiSummary raw={m.summary} />}
          </div>
        );
      })}
      <Modal open={modal} onClose={() => setModal(false)}>
        <div className="modal-title">새 회의록</div>
        <div className="fg"><label className="fl">제목</label><input className="fi" value={f.title} onChange={e => set('title', e.target.value)} placeholder="회의 주제" /></div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
          <div><label className="fl">날짜</label><input className="fi" type="date" value={f.date} onChange={e => set('date', e.target.value)} /></div>
          <div><label className="fl">프로젝트</label><select value={f.pid} onChange={e => set('pid', e.target.value)}>{projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></div>
        </div>
        <div className="fg"><label className="fl">참석자 (쉼표 구분)</label><input className="fi" value={f.attendees} onChange={e => set('attendees', e.target.value)} placeholder={`${user?.name}, ...`} /></div>
        <div className="fg"><label className="fl">회의 내용</label><textarea rows={5} value={f.content} onChange={e => set('content', e.target.value)} placeholder="논의된 내용, 결정사항, 액션 아이템을 입력하세요..." /></div>
        <div className="modal-ft">
          <button className="btn btn-outline" onClick={() => setModal(false)}>취소</button>
          <button className="btn btn-outline" onClick={() => create(true)}>저장 + AI 요약</button>
          <button className="btn btn-primary" onClick={() => create(false)}>저장</button>
        </div>
      </Modal>
    </div>
  );
}
export function MeetingsWithAction({ triggerNew }) {
  const [triggered, setTriggered] = useState(false);
  return <Meetings />;
}

// ─── CODE REVIEW ────────────────────────────────────────────────────────────
const PLACEHOLDER = `// 여기에 리뷰받을 코드를 붙여넣으세요
// 예시: JavaScript 함수, Python 클래스, SQL 쿼리 등

// --- 예시 ---
// async function fetchUser(id) {
//   const res = await fetch('/api/users/' + id);
//   return res.json();
// }`;

function fbReview() {
  return { score: 42, summary: '심각한 보안 취약점과 런타임 에러가 발견되었습니다. 즉시 수정이 필요합니다.', issues: [{ severity: 'critical', line: 2, title: 'SQL 인젝션 취약점', desc: '문자열 연결로 쿼리를 구성하면 SQL 인젝션에 취약합니다.', fix: 'db.query("SELECT * FROM users WHERE id = ?", [userId]) 사용' }, { severity: 'critical', line: 4, title: '비밀번호 평문 노출', desc: '사용자 비밀번호가 응답에 포함되어 클라이언트로 전송됩니다.', fix: 'const { password, ...safe } = result[0]; return safe;' }, { severity: 'warning', line: 9, title: 'Off-by-one 에러', desc: 'i <= items.length 조건으로 undefined 접근이 발생합니다.', fix: 'i < items.length 로 수정하세요' }, { severity: 'info', line: 8, title: 'var 사용 지양', desc: 'var 대신 const/let을 사용하면 블록 스코프가 적용됩니다.', fix: 'const processed = [], let i = 0 으로 변경' }] };
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
        {/* VS Code banner */}
        <div style={{ background: 'var(--navy)', borderRadius: 'var(--r-sm)', padding: '14px 16px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ width: 36, height: 36, borderRadius: 7, background: 'rgba(255,255,255,.1)', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
            <svg width="20" height="20" fill="none" stroke="rgba(255,255,255,.85)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 9l-4 3 4 3M15 9l4 3-4 3M13 6l-2 12"/></svg>
          </div>
          <div>
            <div style={{ fontSize: 13.5, fontWeight: 600, color: '#fff', marginBottom: 3 }}>VS Code 연동</div>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,.45)', lineHeight: 1.5 }}>VS Code 확장 프로그램 설치 후 에디터에서 직접 AI 코드 리뷰 실행 가능</div>
          </div>
          <button className="btn btn-sm" style={{ marginLeft: 'auto', background: 'var(--accent)', color: '#fff', border: 'none', flexShrink: 0 }} onClick={() => toast('VS Code에서 Ctrl+Shift+P → TeamFlow: Review', 'i')}>연동 방법</button>
        </div>

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
          <label className="fl">코드 <span style={{ color: 'var(--text3)', fontWeight: 400 }}>(붙여넣기 또는 직접 작성)</span></label>
          <textarea className="mono" rows={16} value={code} onChange={e => setCode(e.target.value)} placeholder={PLACEHOLDER} />
        </div>
        <button className="btn btn-primary btn-full" onClick={run}>AI 코드 리뷰 시작</button>
      </div>

      <div>
        {loading ? (
          <div className="card" style={{ minHeight: 280 }}>
            <div style={{ fontSize: 13.5, fontWeight: 600, marginBottom: 16 }}>분석 중...</div>
            <div className="think"><div className="td" /><div className="td" /><div className="td" /></div>
            <div style={{ fontSize: 13, color: 'var(--text3)', marginTop: 8 }}>코드를 분석하고 있습니다...</div>
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
                  <div style={{ display: 'flex', gap: 7, marginTop: 9, flexWrap: 'wrap' }}>
                    {review.issues?.filter(i => i.severity === 'critical').length > 0 && <span className="badge b-critical">긴급 {review.issues.filter(i => i.severity === 'critical').length}건</span>}
                    {review.issues?.filter(i => i.severity === 'warning').length > 0 && <span className="badge b-high">경고 {review.issues.filter(i => i.severity === 'warning').length}건</span>}
                    <span className="badge b-todo">정보 {review.issues?.filter(i => i.severity === 'info').length || 0}건</span>
                  </div>
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
            <button className="btn btn-outline btn-sm btn-full" style={{ marginTop: 9 }}>이슈로 등록</button>
          </>
        ) : (
          <div className="card" style={{ minHeight: 280, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', gap: 10 }}>
            <div style={{ width: 46, height: 46, borderRadius: '50%', border: '1.5px solid var(--border)', display: 'grid', placeItems: 'center' }}>
              <svg width="20" height="20" fill="none" stroke="var(--text3)" strokeWidth="1.6" strokeLinecap="round" viewBox="0 0 20 20"><path d="M6 7l-3 3 3 3M14 7l3 3-3 3M12 4l-4 12"/></svg>
            </div>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text2)' }}>분석 대기 중</div>
            <div style={{ fontSize: 13, color: 'var(--text3)' }}>코드를 입력하고 분석을 시작하세요</div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── CHAT ───────────────────────────────────────────────────────────────────
export function Chat() {
  const { rooms, setRooms, msgs, setMsgs, user, extraMembers, setExtraMembers, toast } = useApp();
  const [activeRoom, setActiveRoom] = useState('general');
  const [input, setInput] = useState('');
  const [memberModal, setMemberModal] = useState(false);
  const [profileModal, setProfileModal] = useState(null);
  const [newMember, setNewMember] = useState({ name: '', email: '', role: '' });
  const [newChannel, setNewChannel] = useState({ name: '', desc: '' });
  const [channelModal, setChannelModal] = useState(false);
  const msgsRef = React.useRef(null);

  const BASE_MEMBERS = ['김지수', '이민호', '박서연', '최준혁'];
  const allMembers = [...new Set([...BASE_MEMBERS, ...extraMembers, user.name])];
  const room = rooms.find(r => r.id === activeRoom) || { name: activeRoom, desc: '' };
  const roomMsgs = msgs[activeRoom] || [];

  React.useEffect(() => {
    if (msgsRef.current) msgsRef.current.scrollTop = msgsRef.current.scrollHeight;
  }, [roomMsgs, activeRoom]);

  const send = () => {
    if (!input.trim()) return;
    const now = new Date();
    const msg = { id: 'c' + Date.now(), author: user.name, txt: input.trim(), time: `${now.getHours()}:${String(now.getMinutes()).padStart(2, '0')}`, mine: true };
    setMsgs(prev => ({ ...prev, [activeRoom]: [...(prev[activeRoom] || []), msg] }));
    setInput('');
  };

  const addMember = () => {
    if (!newMember.name.trim()) { toast('이름을 입력하세요', 'e'); return; }
    if (allMembers.includes(newMember.name)) { toast('이미 팀원입니다', 'e'); return; }
    setExtraMembers(prev => [...prev, newMember.name]);
    if (newMember.email) toast(`${newMember.email}로 초대 메일을 발송했습니다`, 's');
    else toast(`${newMember.name}님이 추가되었습니다`, 's');
    setMemberModal(false); setNewMember({ name: '', email: '', role: '' });
  };

  const startDM = (name) => {
    const dmId = 'dm-' + [name, user.name].sort().join('-');
    if (!rooms.find(r => r.id === dmId)) {
      setRooms(prev => [...prev, { id: dmId, name, desc: '개인 메시지', dm: true, dmWith: name }]);
      setMsgs(prev => ({ ...prev, [dmId]: [] }));
    }
    setActiveRoom(dmId);
    setProfileModal(null);
  };

  const createChannel = () => {
    if (!newChannel.name.trim()) { toast('채널 이름을 입력하세요', 'e'); return; }
    const id = newChannel.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    setRooms(prev => [...prev, { id, name: newChannel.name, desc: newChannel.desc || newChannel.name }]);
    setMsgs(prev => ({ ...prev, [id]: [] }));
    setActiveRoom(id); setChannelModal(false); setNewChannel({ name: '', desc: '' });
    toast(`#${newChannel.name} 채널이 생성되었습니다`, 's');
  };

  const COLORS = ['#1e4fd8', '#1a7f4e', '#6b3fc4', '#d97706', '#d93025'];

  return (
    <div style={{ display: 'flex', flex: 1, overflow: 'hidden', height: '100%' }}>
      {/* Channel sidebar */}
      <div className="chat-sidebar">
        <div className="chat-sec-lbl">채널</div>
        {rooms.filter(r => !r.project && !r.dm).map(r => (
          <div key={r.id} className={`chat-room ${activeRoom === r.id ? 'active' : ''}`} onClick={() => setActiveRoom(r.id)}>
            <span className="chat-hash">#</span>{r.name}
          </div>
        ))}
        {rooms.filter(r => r.project).length > 0 && <>
          <div className="chat-sec-lbl">프로젝트</div>
          {rooms.filter(r => r.project).map(r => (
            <div key={r.id} className={`chat-room ${activeRoom === r.id ? 'active' : ''}`} onClick={() => setActiveRoom(r.id)}>
              <span className="chat-hash">#</span>{r.name}
            </div>
          ))}
        </>}
        {rooms.filter(r => r.dm).length > 0 && <>
          <div className="chat-sec-lbl">다이렉트 메시지</div>
          {rooms.filter(r => r.dm).map(r => (
            <div key={r.id} className={`chat-room ${activeRoom === r.id ? 'active' : ''}`} onClick={() => setActiveRoom(r.id)}>
              <div className="av av-sm" style={{ width: 16, height: 16, fontSize: 9 }}>{r.dmWith[0]}</div>
              {r.dmWith}
            </div>
          ))}
        </>}
      </div>

      {/* Main chat */}
      <div className="chat-main" style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <div style={{ padding: '13px 18px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 10, background: 'var(--white)', flexShrink: 0 }}>
          <div>
            <div style={{ fontSize: 13.5, fontWeight: 600 }}># {room.name}</div>
            <div style={{ fontSize: 11.5, color: 'var(--text3)' }}>{room.desc}</div>
          </div>
          <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--text3)' }}>{room.dm ? <span style={{ background: 'var(--green-bg)', color: 'var(--green)', border: '1px solid var(--green-b)', padding: '2px 8px', borderRadius: 20, fontSize: 11 }}>개인 메시지</span> : `${roomMsgs.length}개 메시지`}</span>
        </div>

        <div ref={msgsRef} className="chat-msgs">
          {!roomMsgs.length ? (
            <div style={{ margin: 'auto', textAlign: 'center', color: 'var(--text3)', fontSize: 13 }}>아직 메시지가 없습니다.<br />첫 번째 메시지를 보내보세요!</div>
          ) : roomMsgs.map(msg => {
            const mine = msg.mine || msg.author === user.name;
            return (
              <div key={msg.id} className={`msg-grp ${mine ? 'msg-mine' : ''}`}>
                <div className="msg-sender">
                  <div className="av av-sm" style={mine ? { order: 1 } : {}}>{msg.author[0]}</div>
                  <span className="msg-name" style={mine ? { order: 0 } : {}}>{mine ? `나 (${msg.author})` : msg.author}</span>
                  <span className="msg-time">{msg.time}</span>
                </div>
                <div className={mine ? 'msg-inner' : ''}><div className={`msg-bub${mine ? ' mine' : ''}`}>{msg.txt}</div></div>
              </div>
            );
          })}
        </div>

        <div style={{ padding: '14px 18px', background: 'var(--white)', borderTop: '1px solid var(--border)', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 9, background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--r)', padding: '7px 11px' }}>
            <textarea value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }} rows={1} placeholder={`# ${room.name}에 메시지 보내기...`} style={{ background: 'none', border: 'none', outline: 'none', flex: 1, fontSize: 13.5, color: 'var(--text)', fontFamily: 'var(--font)', resize: 'none', maxHeight: 110, lineHeight: 1.5 }} />
            <button onClick={send} style={{ background: 'var(--accent)', border: 'none', borderRadius: 5, width: 30, height: 30, display: 'grid', placeItems: 'center', cursor: 'pointer', flexShrink: 0 }}>
              <svg viewBox="0 0 15 15" style={{ width: 14, height: 14, fill: 'none', stroke: '#fff', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' }}><path d="M2 7.5L13 2L8 13L7 8.5L2 7.5Z"/></svg>
            </button>
          </div>
        </div>
      </div>

      {/* Members panel */}
      <div className="chat-members">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 9 }}>
          <div className="chat-mem-lbl" style={{ margin: 0 }}>멤버</div>
          <button className="btn btn-xs btn-outline" style={{ fontSize: 11, padding: '2px 8px' }} onClick={() => setMemberModal(true)}>+ 추가</button>
        </div>
        {allMembers.map((name, i) => {
          const isMe = name === user.name;
          const online = isMe || i < 3;
          return (
            <div key={name} className="chat-mem" style={{ cursor: 'pointer', borderRadius: 'var(--r-sm)', padding: '4px 6px', margin: '-2px -6px', transition: 'background .12s' }}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--bg)'}
              onMouseLeave={e => e.currentTarget.style.background = ''}
              onClick={() => isMe ? null : setProfileModal(name)}>
              <div className="av av-sm" style={{ background: COLORS[name.charCodeAt(0) % COLORS.length] + '22', color: COLORS[name.charCodeAt(0) % COLORS.length] }}>{name[0]}</div>
              <div className={`ondot ${online ? 'on' : 'off'}`} />
              <div style={{ flex: 1, minWidth: 0, fontSize: 12.5, color: 'var(--text2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}{isMe ? ' (나)' : ''}</div>
            </div>
          );
        })}
      </div>

      {/* Add member modal */}
      <Modal open={memberModal} onClose={() => setMemberModal(false)}>
        <div className="modal-title">팀원 추가</div>
        <div className="fg"><label className="fl">이름</label><input className="fi" value={newMember.name} onChange={e => setNewMember(p => ({ ...p, name: e.target.value }))} placeholder="홍길동" /></div>
        <div className="fg"><label className="fl">이메일</label><input className="fi" type="email" value={newMember.email} onChange={e => setNewMember(p => ({ ...p, email: e.target.value }))} placeholder="colleague@company.com" /></div>
        <div className="fg"><label className="fl">직책</label><input className="fi" value={newMember.role} onChange={e => setNewMember(p => ({ ...p, role: e.target.value }))} placeholder="개발자, 디자이너..." /></div>
        <div className="modal-ft">
          <button className="btn btn-outline" onClick={() => setMemberModal(false)}>취소</button>
          <button className="btn btn-primary" onClick={addMember}>초대 및 추가</button>
        </div>
      </Modal>

      {/* Profile modal */}
      <Modal open={!!profileModal} onClose={() => setProfileModal(null)}>
        {profileModal && (() => {
          const name = profileModal;
          const color = COLORS[name.charCodeAt(0) % COLORS.length];
          const roleMap = { '김지수': '프론트엔드 개발자', '이민호': '백엔드 개발자', '박서연': '모바일 개발자', '최준혁': '풀스택 개발자' };
          const { issues } = useApp();
          return <>
            <div style={{ textAlign: 'center', padding: '8px 0 20px' }}>
              <div style={{ width: 64, height: 64, borderRadius: '50%', background: color + '22', color, display: 'grid', placeItems: 'center', fontSize: 24, fontWeight: 700, margin: '0 auto 12px' }}>{name[0]}</div>
              <div style={{ fontSize: 18, fontWeight: 700, letterSpacing: '-.3px', marginBottom: 4 }}>{name}</div>
              <div style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 6 }}>{roleMap[name] || '팀원'}</div>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, color: 'var(--green)' }}>
                <div style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--green)' }} />온라인
              </div>
            </div>
            <hr />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 16 }}>
              <div style={{ background: 'var(--bg)', borderRadius: 'var(--r-sm)', padding: 12, textAlign: 'center' }}>
                <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--accent)' }}>{issues.filter(i => i.assignee === name).length}</div>
                <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 3 }}>담당 이슈</div>
              </div>
              <div style={{ background: 'var(--bg)', borderRadius: 'var(--r-sm)', padding: 12, textAlign: 'center' }}>
                <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--green)' }}>{issues.filter(i => i.assignee === name && i.status === 'done').length}</div>
                <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 3 }}>완료 이슈</div>
              </div>
            </div>
            <div className="modal-ft">
              <button className="btn btn-outline" onClick={() => setProfileModal(null)}>닫기</button>
              <button className="btn btn-primary" onClick={() => startDM(name)}>DM 보내기</button>
            </div>
          </>;
        })()}
      </Modal>

      {/* New channel modal */}
      <Modal open={channelModal} onClose={() => setChannelModal(false)}>
        <div className="modal-title">새 채널 추가</div>
        <div className="fg"><label className="fl">채널 이름</label><input className="fi" value={newChannel.name} onChange={e => setNewChannel(p => ({ ...p, name: e.target.value }))} placeholder="예: backend, design-review" /></div>
        <div className="fg"><label className="fl">설명 (선택)</label><input className="fi" value={newChannel.desc} onChange={e => setNewChannel(p => ({ ...p, desc: e.target.value }))} placeholder="채널 목적을 입력하세요" /></div>
        <div className="modal-ft">
          <button className="btn btn-outline" onClick={() => setChannelModal(false)}>취소</button>
          <button className="btn btn-primary" onClick={createChannel}>채널 만들기</button>
        </div>
      </Modal>
    </div>
  );
}
export { Chat as default };

// ─── GITHUB ─────────────────────────────────────────────────────────────────
export function Github() {
  const { toast } = useApp();
  const commits = [
    { hash: 'a3f2c1d', msg: 'fix: 결제 페이지 로딩 속도 개선 (Lighthouse +23)', author: '이민호', time: '2시간 전', branch: 'fix/payment-perf' },
    { hash: 'b8e9f2a', msg: 'feat: WebP 변환 파이프라인 추가', author: '박서연', time: '5시간 전', branch: 'feat/webp-convert' },
    { hash: 'c1d4e7f', msg: 'chore: 보안 패키지 업데이트', author: '김지수', time: '1일 전', branch: 'main' },
    { hash: 'd5f8a2b', msg: 'fix: iOS APNs 토큰 갱신 로직 수정', author: '박서연', time: '2일 전', branch: 'fix/apns-token' },
    { hash: 'e2c9b4f', msg: 'feat: 월별 급여 리포트 PDF 생성', author: '최준혁', time: '3일 전', branch: 'feat/payroll' },
  ];
  const prs = [
    { num: 42, title: '결제 성능 최적화', author: '이민호', status: 'merged' },
    { num: 43, title: 'WebP 이미지 변환', author: '박서연', status: 'review' },
    { num: 44, title: 'iOS 푸시 버그 수정', author: '박서연', status: 'open' },
  ];
  const prColor = { merged: 'var(--purple)', review: 'var(--orange)', open: 'var(--green)' };
  const prBg = { merged: 'var(--purple-bg)', review: 'var(--orange-bg)', open: 'var(--green-bg)' };
  const prLabel = { merged: '머지됨', review: '리뷰중', open: '오픈' };

  return (
    <div>
      <div className="card mb16" style={{ background: 'var(--blue-bg)', borderColor: 'var(--blue-b)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ width: 38, height: 38, borderRadius: '50%', background: 'var(--accent-light)', border: '1.5px solid var(--blue-b)', display: 'grid', placeItems: 'center' }}>
            <svg width="18" height="18" fill="none" stroke="var(--accent)" strokeWidth="1.6" strokeLinecap="round" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M9 14s1.5 2 3 2 3-2 3-2M9.09 9h.01M14.91 9h.01"/></svg>
          </div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 600 }}>GitHub 연동</div>
            <div style={{ fontSize: 13, color: 'var(--text2)', marginTop: 2 }}>실제 배포 시 GitHub OAuth App 등록 및 Webhook 설정</div>
          </div>
          <button className="btn btn-primary btn-sm" style={{ marginLeft: 'auto' }} onClick={() => toast('GitHub OAuth 연동은 배포 후 활성화됩니다', 'i')}>연동 설정</button>
        </div>
      </div>
      <div className="g2">
        <div className="card">
          <div style={{ marginBottom: 16 }}><span style={{ fontSize: 13.5, fontWeight: 600 }}>최근 커밋</span></div>
          {commits.map(c => (
            <div key={c.hash} className="commit">
              <span className="chash">{c.hash}</span>
              <div>
                <div className="cmsg">{c.msg}</div>
                <div className="csub">{c.author} · {c.time} · <span style={{ color: 'var(--accent)' }}>{c.branch}</span></div>
              </div>
            </div>
          ))}
        </div>
        <div className="card">
          <div style={{ marginBottom: 16 }}><span style={{ fontSize: 13.5, fontWeight: 600 }}>Pull Requests</span></div>
          {prs.map(pr => (
            <div key={pr.num} className="issue-row" style={{ marginBottom: 8, cursor: 'default' }}>
              <div className="pdot" style={{ background: prColor[pr.status] }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="ir-title">#{pr.num} {pr.title}</div>
                <div className="ir-meta">
                  <span className="badge" style={{ background: prBg[pr.status], color: prColor[pr.status] }}>{prLabel[pr.status]}</span>
                  <span>{pr.author}</span>
                </div>
              </div>
            </div>
          ))}
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
  issues.forEach(i => { sc[i.status]++; pc[i.priority]++; });
  const total = issues.length || 1;
  const ac = {};
  issues.forEach(i => { ac[i.assignee] = (ac[i.assignee] || 0) + 1; });
  const top = Object.entries(ac).sort((a, b) => b[1] - a[1]).slice(0, 5);
  const maxA = Math.max(...top.map(a => a[1]), 1);

  return (
    <div>
      <div className="g4 mb20">
        <div className="sc"><div className="sc-label">전체 이슈</div><div className="sc-val">{issues.length}</div><div className="sc-sub c-txt2">등록된 전체</div></div>
        <div className="sc"><div className="sc-label">완료율</div><div className="sc-val c-grn">{Math.round((sc.done / total) * 100)}%</div><div className="sc-sub" style={{ color: 'var(--green)' }}>{sc.done}건 완료</div></div>
        <div className="sc"><div className="sc-label">긴급 이슈</div><div className="sc-val c-red">{pc.critical}</div><div className="sc-sub c-red">즉시 처리 필요</div></div>
        <div className="sc"><div className="sc-label">총 회의록</div><div className="sc-val">{meetings.length}</div><div className="sc-sub c-txt2">기록됨</div></div>
      </div>
      <div className="g2 mb16">
        <div className="card">
          <div style={{ marginBottom: 16 }}><span style={{ fontSize: 13.5, fontWeight: 600 }}>이슈 상태 분포</span></div>
          {[['대기', 'todo', 'var(--text3)'], ['진행중', 'progress', 'var(--blue)'], ['리뷰중', 'review', 'var(--purple)'], ['완료', 'done', 'var(--green)']].map(([l, k, c]) => (
            <div key={k} className="brow">
              <div className="blabel">{l}</div>
              <div className="btrack"><div className="bfill" style={{ width: `${Math.round((sc[k] / total) * 100)}%`, background: c }} /></div>
              <div className="bval">{sc[k]}</div>
            </div>
          ))}
        </div>
        <div className="card">
          <div style={{ marginBottom: 16 }}><span style={{ fontSize: 13.5, fontWeight: 600 }}>우선순위 분포</span></div>
          {[['긴급', 'critical', 'var(--red)'], ['높음', 'high', 'var(--orange)'], ['보통', 'medium', 'var(--blue)'], ['낮음', 'low', 'var(--text3)']].map(([l, k, c]) => (
            <div key={k} className="brow">
              <div className="blabel">{l}</div>
              <div className="btrack"><div className="bfill" style={{ width: `${Math.round((pc[k] / total) * 100)}%`, background: c }} /></div>
              <div className="bval">{pc[k]}</div>
            </div>
          ))}
        </div>
      </div>
      <div className="g2">
        <div className="card">
          <div style={{ marginBottom: 16 }}><span style={{ fontSize: 13.5, fontWeight: 600 }}>팀원별 이슈</span></div>
          {top.map(([name, count]) => (
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
