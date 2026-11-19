import React from 'react';
import { useApp } from '../context/AppContext';

const NavIcon = ({ d, viewBox = "0 0 16 16" }) => (
  <svg className="nav-icon" viewBox={viewBox} style={{ width: 15, height: 15, stroke: 'currentColor', fill: 'none', strokeWidth: 1.7, strokeLinecap: 'round', strokeLinejoin: 'round', flexShrink: 0, opacity: .75 }}>
    {d}
  </svg>
);

const NAV = [
  { id: 'dashboard', label: '대시보드', group: '메인', icon: <><rect x="1" y="1" width="6" height="6" rx="1"/><rect x="9" y="1" width="6" height="6" rx="1"/><rect x="1" y="9" width="6" height="6" rx="1"/><rect x="9" y="9" width="6" height="6" rx="1"/></> },
  { id: 'projects', label: '프로젝트', group: '메인', icon: <><path d="M2 4h12M2 8h8M2 12h10"/></> },
  { id: 'issues', label: '이슈 관리', group: '협업', badge: true, icon: <><circle cx="8" cy="8" r="6"/><path d="M8 5v3.5M8 11h.01"/></> },
  { id: 'meetings', label: '회의록', group: '협업', icon: <><rect x="1" y="3" width="14" height="11" rx="1.5"/><path d="M5 3V1M11 3V1M1 7h14"/></> },
  { id: 'codereview', label: 'AI 코드 리뷰', group: '협업', icon: <><path d="M5 6l-3 2 3 2M11 6l3 2-3 2M9 4l-2 8"/></> },
  { id: 'chat', label: '팀 채팅', group: '협업', icon: <><path d="M14 10c0 1-1 2-2 2H4l-3 3V4c0-1 1-2 2-2h9c1 0 2 1 2 2v6z"/></> },
  { id: 'github', label: 'GitHub', group: '분석', icon: <><circle cx="8" cy="8" r="7"/><path d="M5 11c0-2 1-3 3-3s3 1 3 3"/><path d="M8 5v3"/></> },
  { id: 'stats', label: '통계', group: '분석', icon: <><path d="M1 12l4-4 3 3 4-5 3 2"/></> },
];

export default function Sidebar({ page, setPage, onProfile }) {
  const { user, logout, openIssueCount } = useApp();
  const groups = [...new Set(NAV.map(n => n.group))];

  return (
    <aside style={{ width: 228, minWidth: 228, background: 'var(--navy)', display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
      <div style={{ padding: '20px 18px 16px', display: 'flex', alignItems: 'center', gap: 10, borderBottom: '1px solid rgba(255,255,255,.07)' }}>
        <div style={{ width: 28, height: 28, background: 'var(--accent)', borderRadius: 6, display: 'grid', placeItems: 'center', flexShrink: 0 }}>
          <svg width="14" height="14" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" viewBox="0 0 16 16"><rect x="1" y="1" width="6" height="6" rx="1"/><rect x="9" y="1" width="6" height="6" rx="1"/><rect x="1" y="9" width="6" height="6" rx="1"/><circle cx="12" cy="12" r="2.5"/></svg>
        </div>
        <span style={{ fontSize: 15, fontWeight: 700, color: '#fff', letterSpacing: '-.3px' }}>TeamFlow</span>
      </div>

      <div style={{ padding: '14px 10px 0', flex: 1 }}>
        {groups.map(group => (
          <div key={group}>
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,.25)', fontWeight: 600, letterSpacing: '.08em', textTransform: 'uppercase', padding: '0 8px', marginBottom: 3, marginTop: 14 }}>{group}</div>
            {NAV.filter(n => n.group === group).map(n => (
              <div
                key={n.id}
                onClick={() => setPage(n.id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 9, padding: '8px 10px', borderRadius: 6,
                  cursor: 'pointer', color: page === n.id ? '#fff' : 'rgba(255,255,255,.48)',
                  fontSize: 13, fontWeight: page === n.id ? 500 : 400, transition: 'all .14s',
                  marginBottom: 1, background: page === n.id ? 'rgba(255,255,255,.11)' : 'transparent',
                  userSelect: 'none',
                }}
                onMouseEnter={e => { if (page !== n.id) e.currentTarget.style.background = 'rgba(255,255,255,.07)'; }}
                onMouseLeave={e => { if (page !== n.id) e.currentTarget.style.background = 'transparent'; }}
              >
                <svg style={{ width: 15, height: 15, stroke: 'currentColor', fill: 'none', strokeWidth: 1.7, strokeLinecap: 'round', strokeLinejoin: 'round', flexShrink: 0, opacity: page === n.id ? 1 : .75 }} viewBox="0 0 16 16">{n.icon}</svg>
                {n.label}
                {n.badge && openIssueCount > 0 && (
                  <span style={{ marginLeft: 'auto', background: 'var(--accent)', color: '#fff', fontSize: 10, fontWeight: 600, padding: '1px 6px', borderRadius: 10 }}>{openIssueCount}</span>
                )}
              </div>
            ))}
          </div>
        ))}
      </div>

      <div style={{ borderTop: '1px solid rgba(255,255,255,.07)', padding: '12px 10px' }}>
        <div onClick={onProfile} style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '8px 10px', borderRadius: 6, cursor: 'pointer', transition: 'background .14s' }}
          onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,.07)'}
          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
          <div className="av av-navy" style={{ width: 28, height: 28, fontSize: 11.5 }}>{user?.name?.[0]}</div>
          <div>
            <div style={{ fontSize: 12.5, fontWeight: 500, color: '#fff' }}>{user?.name}</div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,.32)', marginTop: 1 }}>{user?.role || user?.email}</div>
          </div>
        </div>
        <button onClick={logout} style={{ marginTop: 5, width: '100%', background: 'transparent', border: '1px solid rgba(255,255,255,.1)', color: 'rgba(255,255,255,.38)', borderRadius: 5, padding: 7, fontSize: 12, cursor: 'pointer', fontFamily: 'var(--font)', transition: 'all .14s' }}
          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,.06)'; e.currentTarget.style.color = 'rgba(255,255,255,.6)'; }}
          onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'rgba(255,255,255,.38)'; }}>
          로그아웃
        </button>
      </div>
    </aside>
  );
}
