import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import Modal from '../components/Modal';

const sL = s => ({ todo: '대기', progress: '진행중', review: '리뷰중', done: '완료' }[s] || s);
const pL = p => ({ critical: '긴급', high: '높음', medium: '보통', low: '낮음' }[p] || p);

function IssueDetailModal({ issue, onClose }) {
  const { user, toast, updateIssue, deleteIssue } = useApp();
  const [comment, setComment] = useState('');
  const [localIssue, setLocalIssue] = useState(issue);

  const handleUpdate = async (field, val) => {
    await updateIssue(issue.id, field, val);
    setLocalIssue(prev => ({ ...prev, [field]: val }));
  };

  const addComment = async () => {
    if (!comment.trim()) { toast('코멘트를 입력하세요', 'e'); return; }
    const newComments = [...(localIssue.comments || []), {
      author: user.name, time: '방금', txt: comment.trim()
    }];
    await updateIssue(issue.id, 'comments', newComments);
    setLocalIssue(prev => ({ ...prev, comments: newComments }));
    setComment('');
    toast('코멘트가 등록되었습니다', 's');
  };

  return (
    <>
      <div style={{ fontSize: 11.5, color: 'var(--text3)', fontWeight: 500, marginBottom: 5 }}>#{localIssue.id?.slice(-6)}</div>
      <div className="modal-title">{localIssue.title}</div>
      <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', marginBottom: 16 }}>
        <div>
          <div className="dl">상태</div>
          <select value={localIssue.status} onChange={e => handleUpdate('status', e.target.value)} style={{ width: 105 }}>
            <option value="todo">대기</option>
            <option value="progress">진행중</option>
            <option value="review">리뷰중</option>
            <option value="done">완료</option>
          </select>
        </div>
        <div>
          <div className="dl">우선순위</div>
          <select value={localIssue.priority} onChange={e => handleUpdate('priority', e.target.value)} style={{ width: 105 }}>
            <option value="critical">긴급</option>
            <option value="high">높음</option>
            <option value="medium">보통</option>
            <option value="low">낮음</option>
          </select>
        </div>
        <div><div className="dl">담당자</div><div className="dv">{localIssue.assignee}</div></div>
        <div><div className="dl">등록일</div><div className="dv">{localIssue.created}</div></div>
      </div>
      <div style={{ fontSize: 13.5, color: 'var(--text2)', lineHeight: 1.7, background: 'var(--bg)', padding: '13px 15px', borderRadius: 'var(--r-sm)', border: '1px solid var(--border)', marginBottom: 12 }}>
        {localIssue.desc}
      </div>
      {localIssue.tags?.length > 0 && (
        <div style={{ marginBottom: 14 }}>
          {localIssue.tags.map(t => <span key={t} className="dtag">{t}</span>)}
        </div>
      )}
      <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 11 }}>코멘트 ({localIssue.comments?.length || 0})</div>
      {(localIssue.comments || []).map((c, i) => (
        <div key={i} className="cmt">
          <div className="av av-sm">{c.author[0]}</div>
          <div className="cmt-bub">
            <span className="cmt-author">{c.author}</span>
            <span className="cmt-time">{c.time}</span>
            <div className="cmt-txt">{c.txt}</div>
          </div>
        </div>
      ))}
      <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
        <textarea rows={2} value={comment} onChange={e => setComment(e.target.value)} placeholder="코멘트를 입력하세요..." />
        <button className="btn btn-primary btn-sm" style={{ alignSelf: 'flex-end' }} onClick={addComment}>등록</button>
      </div>
      <div className="modal-ft">
        <button className="btn btn-danger btn-sm" onClick={async () => { await deleteIssue(issue.id); onClose(); }}>이슈 삭제</button>
        <button className="btn btn-outline" onClick={onClose}>닫기</button>
      </div>
    </>
  );
}

function NewIssueModal({ onClose, projects, defaultStatus = 'todo' }) {
  const { user, createIssue } = useApp();
  const [f, setF] = useState({
    pid: projects[0]?.id || '', title: '', desc: '',
    priority: 'medium', status: defaultStatus,
    assignee: user?.name || '', tags: ''
  });
  const { toast } = useApp();
  const set = (k, v) => setF(p => ({ ...p, [k]: v }));

  const submit = async () => {
    if (!f.title.trim()) { toast('이슈 제목을 입력하세요', 'e'); return; }
    await createIssue({
      ...f,
      tags: f.tags.split(',').map(t => t.trim()).filter(Boolean),
      comments: [],
    });
    onClose();
  };

  return (
    <>
      <div className="modal-title">새 이슈</div>
      <div className="fg">
        <label className="fl">프로젝트</label>
        <select value={f.pid} onChange={e => set('pid', e.target.value)}>
          {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </div>
      <div className="fg">
        <label className="fl">제목</label>
        <input className="fi" value={f.title} onChange={e => set('title', e.target.value)} placeholder="이슈를 명확하게 설명하세요" />
      </div>
      <div className="fg">
        <label className="fl">설명</label>
        <textarea rows={3} value={f.desc} onChange={e => set('desc', e.target.value)} placeholder="재현 방법, 기대 동작 등을 작성하세요" />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 11, marginBottom: 14 }}>
        <div>
          <label className="fl">우선순위</label>
          <select value={f.priority} onChange={e => set('priority', e.target.value)}>
            <option value="critical">긴급</option>
            <option value="high">높음</option>
            <option value="medium">보통</option>
            <option value="low">낮음</option>
          </select>
        </div>
        <div>
          <label className="fl">상태</label>
          <select value={f.status} onChange={e => set('status', e.target.value)}>
            <option value="todo">대기</option>
            <option value="progress">진행중</option>
            <option value="review">리뷰중</option>
          </select>
        </div>
        <div>
          <label className="fl">담당자</label>
          <input className="fi" value={f.assignee} onChange={e => set('assignee', e.target.value)} />
        </div>
      </div>
      <div className="fg">
        <label className="fl">태그 (쉼표 구분)</label>
        <input className="fi" value={f.tags} onChange={e => set('tags', e.target.value)} placeholder="bug, frontend, urgent" />
      </div>
      <div className="modal-ft">
        <button className="btn btn-outline" onClick={onClose}>취소</button>
        <button className="btn btn-primary" onClick={submit}>등록</button>
      </div>
    </>
  );
}

export default function Issues({ filter = { status: 'all', priority: 'all', project: 'all', search: '' } }) {
  const { issues, projects, updateIssue, deleteIssue } = useApp();
  const [localFilter, setLocalFilter] = useState(filter);
  const [view, setView] = useState('list');
  const [modal, setModal] = useState(null);
  const [newStatus, setNewStatus] = useState('todo');

  const lf = (k, v) => setLocalFilter(p => ({ ...p, [k]: v }));

  const filtered = issues.filter(i => {
    if (localFilter.project !== 'all' && i.pid !== localFilter.project) return false;
    if (localFilter.status !== 'all' && i.status !== localFilter.status) return false;
    if (localFilter.priority !== 'all' && i.priority !== localFilter.priority) return false;
    if (localFilter.search && !i.title.toLowerCase().includes(localFilter.search.toLowerCase())) return false;
    return true;
  });

  const cycleStatus = async (id, currentStatus) => {
    const cycle = { todo: 'progress', progress: 'review', review: 'done', done: 'todo' };
    await updateIssue(id, 'status', cycle[currentStatus]);
  };

  return (
    <div>
      {/* Filter bar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 9 }}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <select style={{ width: 140 }} value={localFilter.project} onChange={e => lf('project', e.target.value)}>
            <option value="all">전체 프로젝트</option>
            {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <select style={{ width: 110 }} value={localFilter.status} onChange={e => lf('status', e.target.value)}>
            <option value="all">전체 상태</option>
            <option value="todo">대기</option>
            <option value="progress">진행중</option>
            <option value="review">리뷰중</option>
            <option value="done">완료</option>
          </select>
          <select style={{ width: 110 }} value={localFilter.priority} onChange={e => lf('priority', e.target.value)}>
            <option value="all">우선순위</option>
            <option value="critical">긴급</option>
            <option value="high">높음</option>
            <option value="medium">보통</option>
            <option value="low">낮음</option>
          </select>
          <input
            className="fi" style={{ width: 180 }}
            placeholder="이슈 검색..."
            value={localFilter.search || ''}
            onChange={e => lf('search', e.target.value)}
          />
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <div style={{ display: 'flex', border: '1px solid var(--border)', borderRadius: 'var(--r-sm)', overflow: 'hidden' }}>
            <button className="btn btn-sm" style={{ borderRadius: 0, border: 'none', background: view === 'list' ? 'var(--accent-light)' : 'transparent', color: view === 'list' ? 'var(--accent)' : 'var(--text2)' }} onClick={() => setView('list')}>목록</button>
            <button className="btn btn-sm" style={{ borderRadius: 0, border: 'none', borderLeft: '1px solid var(--border)', background: view === 'kanban' ? 'var(--accent-light)' : 'transparent', color: view === 'kanban' ? 'var(--accent)' : 'var(--text2)' }} onClick={() => setView('kanban')}>칸반</button>
          </div>
          <button className="btn btn-primary btn-sm" onClick={() => setModal({ type: 'new' })}>+ 새 이슈</button>
        </div>
      </div>

      {view === 'kanban' ? (
        <div className="kanban">
          {[
            { k: 'todo', l: '대기', c: 'var(--text3)' },
            { k: 'progress', l: '진행중', c: 'var(--blue)' },
            { k: 'review', l: '리뷰중', c: 'var(--purple)' },
            { k: 'done', l: '완료', c: 'var(--green)' }
          ].map(col => {
            const ci = filtered.filter(i => i.status === col.k);
            return (
              <div key={col.k} className="kcol">
                <div className="kch">
                  <div className="kct"><div className="pdot" style={{ background: col.c }} />{col.l}</div>
                  <span className="kcount">{ci.length}</span>
                </div>
                <div className="kbody">
                  {ci.map(i => (
                    <div key={i.id} className="kcard" onClick={() => setModal({ type: 'detail', data: i })}>
                      <div className="kct2">{i.title}</div>
                      <div className="kfoot">
                        <span className={`badge b-${i.priority}`}>{pL(i.priority)}</span>
                        <div className="av av-sm">{i.assignee?.[0]}</div>
                      </div>
                    </div>
                  ))}
                  <button className="kadd" onClick={() => { setNewStatus(col.k); setModal({ type: 'new' }); }}>+ 이슈 추가</button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          {!filtered.length ? (
            <div className="empty-st">
              <div className="empty-lbl">이슈가 없습니다</div>
              <div style={{ fontSize: 13 }}>새 이슈를 등록해보세요</div>
            </div>
          ) : filtered.map(i => {
            const proj = projects.find(p => p.id === i.pid);
            return (
              <div key={i.id} className="issue-row" style={{ border: 'none', borderBottom: '1px solid var(--border)', borderRadius: 0, margin: 0 }}
                onClick={() => setModal({ type: 'detail', data: i })}>
                <div className={`pdot p-${i.priority}`} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="ir-title">{i.title}</div>
                  <div className="ir-meta">
                    <span className={`badge b-${i.status}`}>{sL(i.status)}</span>
                    <span className={`badge b-${i.priority}`}>{pL(i.priority)}</span>
                    {proj && <span>{proj.name}</span>}
                    <span>{i.assignee} · {i.created}</span>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 6, flexShrink: 0 }} onClick={e => e.stopPropagation()}>
                  <button className="btn btn-outline btn-xs" onClick={() => cycleStatus(i.id, i.status)}>상태 변경</button>
                  <button className="btn btn-danger btn-xs" onClick={() => deleteIssue(i.id)}>삭제</button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Modal open={!!modal} onClose={() => setModal(null)}>
        {modal?.type === 'detail' && (
          <IssueDetailModal
            issue={modal.data}
            onClose={() => setModal(null)}
          />
        )}
        {modal?.type === 'new' && (
          <NewIssueModal
            onClose={() => setModal(null)}
            projects={projects}
            defaultStatus={newStatus}
          />
        )}
      </Modal>
    </div>
  );
}
