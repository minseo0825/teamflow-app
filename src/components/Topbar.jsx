import React, { useState } from 'react';
import { useApp } from '../context/AppContext';

const PAGE_META = {
  dashboard: { title: '대시보드', sub: '개요', action: '+ 새 이슈' },
  projects: { title: '프로젝트', sub: '전체 프로젝트', action: '+ 새 프로젝트' },
  issues: { title: '이슈 관리', sub: '이슈 목록', action: '+ 새 이슈' },
  meetings: { title: '회의록', sub: '전체 회의록', action: '+ 새 회의록' },
  codereview: { title: 'AI 코드 리뷰', sub: '코드 분석', action: '' },
  chat: { title: '팀 채팅', sub: '채널', action: '+ 채널 추가' },
  github: { title: 'GitHub', sub: '연동 현황', action: '' },
  stats: { title: '통계', sub: '분석 리포트', action: '' },
};

export default function Topbar({ page, onAction, onSearch }) {
  const { notifs, setNotifs, toast } = useApp();
  const [showNotif, setShowNotif] = useState(false);
  const meta = PAGE_META[page] || { title: page, sub: '', action: '' };
  const unread = notifs.filter(n => !n.read).length;

  const markAll = () => {
    setNotifs(prev => prev.map(n => ({ ...n, read: true })));
    setShowNotif(false);
    toast('모든 알림을 읽음 처리했습니다', 'i');
  };

  const markOne = (id) => {
    setNotifs(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
  };

  const npIco = { issue: { bg: 'var(--blue-bg)', c: 'var(--blue)' }, pr: { bg: 'var(--purple-bg)', c: 'var(--purple)' }, meeting: { bg: 'var(--orange-bg)', c: 'var(--orange)' }, invite: { bg: 'var(--green-bg)', c: 'var(--green)' }, ai: { bg: 'var(--accent-light)', c: 'var(--accent)' }, project: { bg: 'var(--blue-bg)', c: 'var(--blue)' } };

  return (
    <div style={{ height: 52, background: 'var(--white)', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', padding: '0 24px', gap: 14, flexShrink: 0 }}>
      <span style={{ fontSize: 14.5, fontWeight: 600, color: 'var(--text)', letterSpacing: '-.2px' }}>{meta.title}</span>
      <div style={{ width: 1, height: 16, background: 'var(--border)' }} />
      <span style={{ fontSize: 12.5, color: 'var(--text3)' }}>{meta.sub}</span>
      <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--r-sm)', padding: '0 11px', height: 32 }}>
          <svg style={{ width: 13, height: 13, stroke: 'var(--text3)', flexShrink: 0, strokeWidth: 1.8, fill: 'none' }} viewBox="0 0 16 16"><circle cx="6.5" cy="6.5" r="4.5"/><path d="M10 10l3 3"/></svg>
          <input onChange={e => onSearch(e.target.value)} placeholder="이슈 검색..." style={{ background: 'none', border: 'none', outline: 'none', color: 'var(--text)', fontSize: 13, width: 170, fontFamily: 'var(--font)' }} />
        </div>
        <div style={{ position: 'relative' }}>
          <button onClick={() => setShowNotif(v => !v)} style={{ width: 32, height: 32, border: '1px solid var(--border)', borderRadius: 'var(--r-sm)', background: 'var(--white)', cursor: 'pointer', display: 'grid', placeItems: 'center', transition: 'all .14s' }}>
            <svg style={{ width: 14, height: 14, stroke: 'var(--text2)', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round', fill: 'none' }} viewBox="0 0 16 16"><path d="M8 1a5 5 0 0 1 5 5v2.5l1.5 2H1.5L3 8.5V6a5 5 0 0 1 5-5z"/><path d="M6 13a2 2 0 0 0 4 0"/></svg>
            {unread > 0 && <span style={{ position: 'absolute', top: 5, right: 5, width: 7, height: 7, background: 'var(--red)', borderRadius: '50%', border: '2px solid var(--white)' }} />}
          </button>
          {showNotif && (
            <div className="np">
              <div className="np-head">
                알림
                <button className="btn btn-ghost btn-xs" onClick={markAll}>모두 읽음</button>
              </div>
              {notifs.slice(0, 8).map(n => {
                const ic = npIco[n.type] || { bg: 'var(--bg)', c: 'var(--text3)' };
                return (
                  <div key={n.id} className="np-item" style={{ opacity: n.read ? .6 : 1 }} onClick={() => markOne(n.id)}>
                    <div className="np-ico" style={{ background: ic.bg }}>
                      <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke={ic.c} strokeWidth="1.8" strokeLinecap="round"><circle cx="6" cy="6" r="4"/></svg>
                    </div>
                    <div style={{ flex: 1 }}>
                      <div className="np-txt">{n.txt}</div>
                      <div className="np-time">{n.time}</div>
                    </div>
                    {!n.read && <div className="np-unread" />}
                  </div>
                );
              })}
            </div>
          )}
        </div>
        {meta.action && (
          <button className="btn btn-primary btn-sm" onClick={onAction}>{meta.action}</button>
        )}
      </div>
    </div>
  );
}
