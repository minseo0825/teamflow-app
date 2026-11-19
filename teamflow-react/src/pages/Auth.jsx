import React, { useState } from 'react';
import { useApp } from '../context/AppContext';

export default function Auth() {
  const { login, toast } = useApp();
  const [tab, setTab] = useState('login');
  const [form, setForm] = useState({ email: 'demo@teamflow.io', pw: 'demo1234', name: '', role: '', team: '' });

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const doLogin = () => {
    if (!form.email || !form.pw) { toast('이메일과 비밀번호를 입력하세요', 'e'); return; }
    const users = JSON.parse(localStorage.getItem('tf_react_users') || '[]');
    let u = users.find(x => x.email === form.email);
    if (!u && form.email === 'demo@teamflow.io') u = { name: '김지수', email: 'demo@teamflow.io', team: 'TeamFlow Inc.', role: '프론트엔드 개발자' };
    if (!u) { toast('계정이 없습니다. 회원가입을 먼저 해주세요.', 'e'); return; }
    login(u);
  };

  const doRegister = () => {
    if (!form.name || !form.email || !form.pw) { toast('필수 항목을 모두 입력하세요', 'e'); return; }
    const users = JSON.parse(localStorage.getItem('tf_react_users') || '[]');
    if (users.find(x => x.email === form.email)) { toast('이미 가입된 이메일입니다', 'e'); return; }
    const u = { name: form.name, email: form.email, role: form.role || '멤버', team: form.team || '내 팀' };
    users.push(u);
    localStorage.setItem('tf_react_users', JSON.stringify(users));
    toast(form.name + '님, 환영합니다!', 's');
    login(u);
  };

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      {/* Left panel */}
      <div style={{ width: 400, minWidth: 400, background: 'var(--navy)', display: 'flex', flexDirection: 'column', padding: '48px 44px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
          <div style={{ width: 34, height: 34, background: 'var(--accent)', borderRadius: 7, display: 'grid', placeItems: 'center' }}>
            <svg width="16" height="16" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" viewBox="0 0 16 16"><rect x="1" y="1" width="6" height="6" rx="1"/><rect x="9" y="1" width="6" height="6" rx="1"/><rect x="1" y="9" width="6" height="6" rx="1"/><circle cx="12" cy="12" r="2.5"/></svg>
          </div>
          <span style={{ fontSize: 19, fontWeight: 700, color: '#fff', letterSpacing: '-.3px' }}>TeamFlow</span>
        </div>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '40px 0' }}>
          <div style={{ fontSize: 28, fontWeight: 700, color: '#fff', lineHeight: 1.3, letterSpacing: '-.5px', marginBottom: 12 }}>팀의 모든 작업을<br />한 곳에서</div>
          <div style={{ fontSize: 13, color: 'rgba(255,255,255,.45)', lineHeight: 1.7 }}>중소기업을 위한 통합 협업 플랫폼</div>
        </div>
        <div style={{ fontSize: 11, color: 'rgba(255,255,255,.18)' }}>© 2025 TeamFlow Inc.</div>
      </div>

      {/* Right panel */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 32, background: 'var(--bg)' }}>
        <div style={{ width: '100%', maxWidth: 390 }}>
          <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', marginBottom: 26 }}>
            {['login', 'register'].map(t => (
              <div key={t} onClick={() => setTab(t)} style={{ padding: '10px 18px 11px', cursor: 'pointer', color: tab === t ? 'var(--accent)' : 'var(--text3)', borderBottom: `2px solid ${tab === t ? 'var(--accent)' : 'transparent'}`, marginBottom: -1, fontSize: 13.5, fontWeight: 500, transition: 'all .18s' }}>
                {t === 'login' ? '로그인' : '회원가입'}
              </div>
            ))}
          </div>

          {tab === 'login' ? (
            <>
              <div className="fg"><label className="fl">이메일</label><input className="fi" type="email" value={form.email} onChange={e => set('email', e.target.value)} placeholder="you@company.com" /></div>
              <div className="fg"><label className="fl">비밀번호</label><input className="fi" type="password" value={form.pw} onChange={e => set('pw', e.target.value)} placeholder="••••••••" onKeyDown={e => e.key === 'Enter' && doLogin()} /></div>
              <button className="btn btn-primary btn-full" onClick={doLogin}>로그인</button>
              <div style={{ fontSize: 12, color: 'var(--text3)', textAlign: 'center', marginTop: 14 }}>데모 계정으로 바로 시작할 수 있습니다</div>
            </>
          ) : (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div className="fg"><label className="fl">이름</label><input className="fi" value={form.name} onChange={e => set('name', e.target.value)} placeholder="홍길동" /></div>
                <div className="fg"><label className="fl">직책</label><input className="fi" value={form.role} onChange={e => set('role', e.target.value)} placeholder="개발자" /></div>
              </div>
              <div className="fg"><label className="fl">이메일</label><input className="fi" type="email" value={form.email} onChange={e => set('email', e.target.value)} placeholder="you@company.com" /></div>
              <div className="fg"><label className="fl">회사/팀명</label><input className="fi" value={form.team} onChange={e => set('team', e.target.value)} placeholder="TeamFlow Inc." /></div>
              <div className="fg"><label className="fl">비밀번호</label><input className="fi" type="password" value={form.pw} onChange={e => set('pw', e.target.value)} placeholder="8자 이상" /></div>
              <button className="btn btn-primary btn-full" onClick={doRegister}>계정 만들기</button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
