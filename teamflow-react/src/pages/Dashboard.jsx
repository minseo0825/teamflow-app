import React from 'react';
import { useApp } from '../context/AppContext';

const sL = s => ({ todo: '대기', progress: '진행중', review: '리뷰중', done: '완료' }[s] || s);

export default function Dashboard({ setPage, setIssueFilter }) {
  const { issues, projects, meetings } = useApp();
  const open = issues.filter(i => i.status !== 'done').length;
  const done = issues.filter(i => i.status === 'done').length;
  const crit = issues.filter(i => i.priority === 'critical' && i.status !== 'done').length;

  const goIssues = (filter) => { setIssueFilter(filter); setPage('issues'); };

  return (
    <div>
      {/* Stat cards */}
      <div className="g4 mb20">
        <div className="sc" onClick={() => goIssues({ status: 'all', priority: 'all' })}>
          <div className="sc-label">진행 중 이슈</div>
          <div className="sc-val c-acc">{open}</div>
          <div className="sc-sub c-txt2">클릭하여 전체 보기</div>
        </div>
        <div className="sc" onClick={() => goIssues({ status: 'all', priority: 'critical' })}>
          <div className="sc-label">긴급 이슈</div>
          <div className="sc-val c-red">{crit}</div>
          <div className="sc-sub c-red">클릭하여 긴급 보기</div>
        </div>
        <div className="sc" onClick={() => goIssues({ status: 'done', priority: 'all' })}>
          <div className="sc-label">완료 이슈</div>
          <div className="sc-val c-grn">{done}</div>
          <div className="sc-sub" style={{ color: 'var(--green)' }}>클릭하여 완료 보기</div>
        </div>
        <div className="sc" onClick={() => setPage('projects')}>
          <div className="sc-label">활성 프로젝트</div>
          <div className="sc-val">{projects.length}</div>
          <div className="sc-sub c-txt2">클릭하여 보기</div>
        </div>
      </div>

      <div className="g2 mb16">
        {/* Urgent issues */}
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <span style={{ fontSize: 13.5, fontWeight: 600 }}>긴급 이슈</span>
            <button className="btn btn-ghost btn-xs" onClick={() => setPage('issues')}>전체 보기</button>
          </div>
          {issues.filter(i => i.priority === 'critical' || i.priority === 'high').slice(0, 4).map(i => (
            <div key={i.id} className="issue-row" onClick={() => goIssues({ status: 'all', priority: 'all' })}>
              <div className={`pdot p-${i.priority}`} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="ir-title">{i.title}</div>
                <div className="ir-meta">
                  <span className={`badge b-${i.status}`}>{sL(i.status)}</span>
                  <span>{i.assignee}</span>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Project progress */}
        <div className="card">
          <div style={{ marginBottom: 16 }}><span style={{ fontSize: 13.5, fontWeight: 600 }}>프로젝트 진행률</span></div>
          {projects.map(p => (
            <div key={p.id} style={{ marginBottom: 18 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 7 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: p.color }} />
                  <span style={{ fontSize: 13, fontWeight: 500 }}>{p.name}</span>
                </div>
                <span style={{ fontSize: 12, color: 'var(--text3)', fontWeight: 500 }}>{p.progress}%</span>
              </div>
              <div className="prog"><div className="prog-f" style={{ width: `${p.progress}%`, background: p.color }} /></div>
            </div>
          ))}
        </div>
      </div>

      <div className="g2">
        {/* Recent activity */}
        <div className="card">
          <div style={{ marginBottom: 16 }}><span style={{ fontSize: 13.5, fontWeight: 600 }}>최근 활동</span></div>
          {[
            { ico: '🔵', bg: 'var(--blue-bg)', c: 'var(--blue)', txt: <><strong>이민호</strong>님이 이슈 #i1에 코멘트 추가</>, time: '5분 전' },
            { ico: '✅', bg: 'var(--green-bg)', c: 'var(--green)', txt: <><strong>최준혁</strong>님이 이슈 #i5 완료 처리</>, time: '1시간 전' },
            { ico: '📋', bg: 'var(--purple-bg)', c: 'var(--purple)', txt: <><strong>박서연</strong>님이 회의록 등록</>, time: '3시간 전' },
            { ico: '🔀', bg: 'var(--orange-bg)', c: 'var(--orange)', txt: <><strong>김지수</strong>님이 PR #42 머지</>, time: '5시간 전' },
          ].map((a, i) => (
            <div key={i} className="act">
              <div className="act-ico" style={{ background: a.bg, color: a.c }}>
                <svg viewBox="0 0 14 14" style={{ width: 13, height: 13, stroke: a.c, fill: 'none', strokeWidth: 1.8, strokeLinecap: 'round' }}><circle cx="7" cy="7" r="5" /></svg>
              </div>
              <div>
                <div className="act-txt">{a.txt}</div>
                <div className="act-time">{a.time}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Recent meetings */}
        <div className="card">
          <div style={{ marginBottom: 16 }}><span style={{ fontSize: 13.5, fontWeight: 600 }}>최근 회의록</span></div>
          {meetings.slice(0, 3).map(m => (
            <div key={m.id} className="act" style={{ cursor: 'pointer' }} onClick={() => setPage('meetings')}>
              <div className="act-ico" style={{ background: 'var(--purple-bg)', color: 'var(--purple)' }}>
                <svg viewBox="0 0 14 14" style={{ width: 13, height: 13, stroke: 'var(--purple)', fill: 'none', strokeWidth: 1.8, strokeLinecap: 'round' }}><rect x="1" y="2" width="12" height="10" rx="1.5" /><path d="M1 6h12" /></svg>
              </div>
              <div>
                <div className="act-txt" style={{ fontWeight: 500 }}>{m.title}</div>
                <div className="act-time">{m.date} · {m.attendees.length}명</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
