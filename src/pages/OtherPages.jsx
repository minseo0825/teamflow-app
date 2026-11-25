import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '../context/AppContext';
import Modal from '../components/Modal';
import ProjectVisibilityField, { buildVisibilityFields, projectInvitees, VisibilityBadge } from '../components/ProjectVisibilityField';
import { InviteStatusBadge, RejectedInvites } from '../components/MemberPicker';
import { MyInviteBar, LeaveButton, ReinviteButton } from '../components/InviteActions';
import { requestReviewFromBackend, reviewErrorMessage } from '../lib/aiReview';
import { saveCodeReview, subscribeMyCodeReviews, deleteCodeReview, toReview } from '../lib/reviewHistory';

const sL = s => ({ todo: '대기', progress: '진행중', review: '리뷰중', done: '완료' }[s] || s);
const pL = p => ({ critical: '긴급', high: '높음', medium: '보통', low: '낮음' }[p] || p);

// ─── PROJECT DETAIL ─────────────────────────────────────────────────────────
export function ProjectDetail({ projectId, setPage, setProjectId, onUserClick }) {
  const { projects, issues, updateProject, deleteProject, createIssue, updateIssue, deleteIssue, toast, user } = useApp();
  const [editMode, setEditMode] = useState(false);
  const [newIssueOpen, setNewIssueOpen] = useState(false);
  const [detailIssue, setDetailIssue] = useState(null);
  const [editForm, setEditForm] = useState({});

  const project = projects.find(p => p.id === projectId);
  const projectIssues = issues.filter(i => i.pid === projectId);
  const totalIssues = projectIssues.length;
  const doneIssues = projectIssues.filter(i => i.status === 'done').length;
  const inProgressIssues = projectIssues.filter(i => i.status !== 'done').length;
  const progress = totalIssues > 0 ? Math.round((doneIssues / totalIssues) * 100) : 0;

  if (!project) {
    return (
      <div className="card" style={{ textAlign: 'center', padding: '40px 20px' }}>
        <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 8 }}>프로젝트를 찾을 수 없습니다</div>
        <button className="btn btn-primary btn-sm" style={{ marginTop: 12 }} onClick={() => setPage('projects')}>프로젝트 목록으로</button>
      </div>
    );
  }

  // 기존 프로젝트(createdBy만 있음) 포함, 생성자만 수정/삭제 가능
  const isOwner = project.createdBy === user?.uid;

  const startEdit = () => {
    setEditForm({ name: project.name, desc: project.desc });
    setEditMode(true);
  };

  const saveEdit = async () => {
    if (!editForm.name?.trim()) { toast('프로젝트 이름을 입력하세요', 'e'); return; }
    await updateProject(project.id, editForm);
    setEditMode(false);
  };

  const handleDelete = async () => {
    if (!window.confirm(`"${project.name}" 프로젝트를 삭제할까요?\n소속된 이슈는 삭제되지 않습니다.`)) return;
    await deleteProject(project.id);
    setPage('projects');
  };

  const handleNewIssue = async (data) => {
    await createIssue({ ...data, pid: project.id });
    setNewIssueOpen(false);
    toast('이슈가 등록되었습니다', 's');
  };

  return (
    <div>
      {/* 뒤로가기 버튼 */}
      <div style={{ marginBottom: 16 }}>
        <button className="btn btn-ghost btn-sm" onClick={() => { setProjectId(null); setPage('projects'); }}>
          ← 프로젝트 목록
        </button>
      </div>

      {/* 프로젝트 정보 카드 */}
      <div className="card mb16">
        {editMode ? (
          <>
            <div className="fg">
              <label className="fl">프로젝트 이름</label>
              <input className="fi" value={editForm.name} onChange={e => setEditForm(p => ({ ...p, name: e.target.value }))} />
            </div>
            <div className="fg">
              <label className="fl">설명</label>
              <textarea rows={2} value={editForm.desc} onChange={e => setEditForm(p => ({ ...p, desc: e.target.value }))} style={{ resize: 'none' }} />
            </div>

            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button className="btn btn-outline btn-sm" onClick={() => setEditMode(false)}>취소</button>
              <button className="btn btn-primary btn-sm" onClick={saveEdit}>저장</button>
            </div>
          </>
        ) : (
          <>
            <MyInviteBar type="project" item={project} onRejected={() => { setProjectId(null); setPage('projects'); }} />
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 12, height: 12, borderRadius: '50%', background: project.color, flexShrink: 0 }} />
                <div>
                  <div style={{ fontSize: 20, fontWeight: 700, letterSpacing: '-.5px', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 8 }}>
                    {project.name}
                    <VisibilityBadge visibility={project.visibility} />
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--text2)' }}>{project.desc}</div>
                  {project.visibility === 'team' && (project.memberUids || []).length > 0 && (
                    <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 4 }}>
                      참여 팀원:{' '}
                      {project.memberUids.map((uid, idx) => {
                        const st = project.inviteStatus?.[uid];
                        return (
                          <span key={uid} style={{ marginRight: 8, whiteSpace: 'nowrap' }}>
                            {st?.name || project.members?.[idx] || ''}
                            <InviteStatusBadge status={st?.status} />
                          </span>
                        );
                      })}
                      <RejectedInvites inviteStatus={project.inviteStatus} />
                      <ReinviteButton type="project" item={project} />
                    </div>
                  )}
                </div>
              </div>
              {isOwner ? (
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="btn btn-outline btn-sm" onClick={startEdit}>수정</button>
                  <button className="btn btn-danger btn-sm" onClick={handleDelete}>삭제</button>
                </div>
              ) : (
                <LeaveButton type="project" item={project} onLeft={() => { setProjectId(null); setPage('projects'); }} />
              )}
            </div>

            <div className="g4 mb16">
              <div style={{ background: 'var(--bg)', padding: '12px 14px', borderRadius: 'var(--r-sm)', border: '1px solid var(--border)' }}>
                <div style={{ fontSize: 11.5, color: 'var(--text3)', fontWeight: 500, marginBottom: 4 }}>전체 이슈</div>
                <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--text)' }}>{totalIssues}</div>
              </div>
              <div style={{ background: 'var(--blue-bg)', padding: '12px 14px', borderRadius: 'var(--r-sm)', border: '1px solid var(--blue-b)' }}>
                <div style={{ fontSize: 11.5, color: 'var(--blue)', fontWeight: 500, marginBottom: 4 }}>진행 중</div>
                <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--blue)' }}>{inProgressIssues}</div>
              </div>
              <div style={{ background: 'var(--green-bg)', padding: '12px 14px', borderRadius: 'var(--r-sm)', border: '1px solid var(--green-b)' }}>
                <div style={{ fontSize: 11.5, color: 'var(--green)', fontWeight: 500, marginBottom: 4 }}>완료</div>
                <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--green)' }}>{doneIssues}</div>
              </div>
              <div style={{ background: 'var(--accent-light)', padding: '12px 14px', borderRadius: 'var(--r-sm)', border: '1px solid var(--blue-b)' }}>
                <div style={{ fontSize: 11.5, color: 'var(--accent)', fontWeight: 500, marginBottom: 4 }}>진행률</div>
                <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--accent)' }}>{progress}%</div>
              </div>
            </div>

            <div style={{ marginBottom: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 7 }}>
                <span style={{ fontSize: 12, color: 'var(--text3)' }}>프로젝트 진행률</span>
                <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text2)' }}>{doneIssues}/{totalIssues} 완료</span>
              </div>
              <div className="prog">
                <div className="prog-f" style={{ width: `${progress}%`, background: project.color }} />
              </div>
            </div>
          </>
        )}
      </div>

      {/* 이슈 목록 */}
      <div className="card">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <span style={{ fontSize: 14, fontWeight: 600 }}>프로젝트 이슈 ({projectIssues.length})</span>
          <button className="btn btn-primary btn-sm" onClick={() => setNewIssueOpen(true)}>+ 새 이슈</button>
        </div>

        {projectIssues.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '30px 20px', color: 'var(--text3)', fontSize: 13 }}>
            아직 이슈가 없습니다. 첫 이슈를 등록해보세요!
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {projectIssues.map(i => (
              <div key={i.id} className="issue-row" style={{ cursor: 'pointer' }} onClick={() => setDetailIssue(i)}>
                <div className={`pdot p-${i.priority}`} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="ir-title">
                    {i.title}
                    {i.dueDate && new Date(i.dueDate) < new Date() && i.status !== 'done' && (
                      <span style={{ marginLeft: 8, padding: '2px 7px', background: 'var(--red-bg)', color: 'var(--red)', borderRadius: '3px', fontSize: '11px', fontWeight: 500 }}>기한 초과</span>
                    )}
                  </div>
                  <div className="ir-meta">
                    <span className={`badge b-${i.status}`}>{sL(i.status)}</span>
                    <span className={`badge b-${i.priority}`}>{pL(i.priority)}</span>
                    <span>{i.assignee} · {i.created}</span>
                    {i.dueDate && <span>마감: {i.dueDate}</span>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 새 이슈 모달 */}
      <Modal open={newIssueOpen} onClose={() => setNewIssueOpen(false)}>
        <NewIssueModalInner onClose={() => setNewIssueOpen(false)} onCreate={handleNewIssue} />
      </Modal>

      {/* 이슈 상세 모달 */}
      <Modal open={!!detailIssue} onClose={() => setDetailIssue(null)}>
        {detailIssue && <IssueDetailModalInner issue={detailIssue} onClose={() => setDetailIssue(null)} updateIssue={updateIssue} deleteIssue={deleteIssue} toast={toast} />}
      </Modal>
    </div>
  );
}

function NewIssueModalInner({ onClose, onCreate }) {
  const { user, toast } = useApp();
  const [f, setF] = useState({
    title: '', desc: '', priority: 'medium', status: 'todo',
    assignee: user?.name || '', tags: '', startDate: '', dueDate: ''
  });
  const set = (k, v) => setF(p => ({ ...p, [k]: v }));

  const submit = async () => {
    if (!f.title.trim()) { toast('이슈 제목을 입력하세요', 'e'); return; }
    if (f.startDate && f.dueDate && f.startDate > f.dueDate) {
      toast('시작일은 마감일보다 늦을 수 없습니다', 'e');
      return;
    }
    await onCreate({
      ...f,
      tags: f.tags.split(',').map(t => t.trim()).filter(Boolean),
      comments: [],
      participantUids: [user.uid], // 생성자를 기본 참여자로 추가
    });
  };

  return (
    <>
      <div className="modal-title">새 이슈</div>
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
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 11, marginBottom: 14 }}>
        <div>
          <label className="fl">시작일</label>
          <input className="fi" type="date" value={f.startDate} onChange={e => set('startDate', e.target.value)} />
        </div>
        <div>
          <label className="fl">마감일</label>
          <input className="fi" type="date" value={f.dueDate} onChange={e => set('dueDate', e.target.value)} />
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

function IssueDetailModalInner({ issue, onClose, updateIssue, deleteIssue, toast }) {
  const { user, issues } = useApp();
  const [comment, setComment] = useState('');
  const [localIssue, setLocalIssue] = useState(issue);
  const liveIssue = issues.find(i => i.id === issue.id) || localIssue; // 초대 응답/나가기 상태는 실시간 기준

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
      <MyInviteBar type="issue" item={liveIssue} onRejected={onClose} />
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
        {localIssue.participantUids && localIssue.participantUids.length > 0 && (
          <div><div className="dl">참여자</div><div className="dv">👥 {localIssue.participantUids.length}명</div></div>
        )}
      </div>
      <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', marginBottom: 16 }}>
        <div>
          <div className="dl">시작일</div>
          <input type="date" value={localIssue.startDate || ''} onChange={e => handleUpdate('startDate', e.target.value)} style={{ width: 150, padding: '6px 10px', border: '1px solid var(--border)', borderRadius: 'var(--r-sm)', fontSize: '13px' }} />
        </div>
        <div>
          <div className="dl">마감일</div>
          <input type="date" value={localIssue.dueDate || ''} onChange={e => handleUpdate('dueDate', e.target.value)} style={{ width: 150, padding: '6px 10px', border: '1px solid var(--border)', borderRadius: 'var(--r-sm)', fontSize: '13px' }} />
        </div>
        {localIssue.dueDate && new Date(localIssue.dueDate) < new Date() && localIssue.status !== 'done' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 10px', background: 'var(--red-bg)', color: 'var(--red)', borderRadius: 'var(--r-sm)', fontSize: '12px', fontWeight: 500 }}>
            ⚠️ 기한 초과
          </div>
        )}
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
        {liveIssue.createdBy === user?.uid && (
          <button className="btn btn-danger btn-sm" onClick={async () => { await deleteIssue(issue.id); onClose(); }}>이슈 삭제</button>
        )}
        <LeaveButton type="issue" item={liveIssue} onLeft={onClose} />
        <button className="btn btn-outline" onClick={onClose}>닫기</button>
      </div>
    </>
  );
}

// ─── PROJECTS ───────────────────────────────────────────────────────────────
export function Projects({ onProjectClick }) {
  const { projects, issues, toast, user, createProject, deleteProject } = useApp();
  const [modal, setModal] = useState(false);
  const [f, setF] = useState({ name: '', desc: '' });
  const [visibility, setVisibility] = useState('private');
  const [members, setMembers] = useState([]);
  const set = (k, v) => setF(p => ({ ...p, [k]: v }));

  const create = async () => {
    if (!f.name.trim()) { toast('프로젝트 이름을 입력하세요', 'e'); return; }
    const colors = ['#1e4fd8', '#1a7f4e', '#6b3fc4', '#d97706', '#d93025', '#0891b2'];
    await createProject({
      name: f.name,
      desc: f.desc || '새 프로젝트',
      color: colors[projects.length % colors.length],
      progress: 0,
      ...buildVisibilityFields(user, visibility, members),
    }, projectInvitees(visibility, members));
    setModal(false);
    setF({ name: '', desc: '' });
    setVisibility('private');
    setMembers([]);
  };

  return (
    <div>
      <div className="g3">
        {projects.map(p => {
          const projectIssues = issues.filter(i => i.pid === p.id);
          const totalIssues = projectIssues.length;
          const doneIssues = projectIssues.filter(i => i.status === 'done').length;
          const progress = totalIssues > 0 ? Math.round((doneIssues / totalIssues) * 100) : 0;
          return (
            <div key={p.id} className="pcard" onClick={() => onProjectClick?.(p.id)} style={{ cursor: 'pointer' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <div style={{ width: 9, height: 9, borderRadius: '50%', background: p.color }} />
                <div className="pcard-name" style={{ flex: 1 }}>{p.name}</div>
                <VisibilityBadge visibility={p.visibility} />
                {p.createdBy === user.uid && (
                  <button className="btn btn-danger btn-xs" onClick={e => { e.stopPropagation(); if(window.confirm(`"${p.name}" 프로젝트를 삭제할까요?`)) deleteProject(p.id); }}>삭제</button>
                )}
              </div>
              <div className="pcard-desc">{p.desc}</div>
              <div className="prog mb16"><div className="prog-f" style={{ width: `${progress}%`, background: p.color }} /></div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--text3)', marginBottom: 12 }}>
                <span>진행률</span><span style={{ fontWeight: 500 }}>{progress}%</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div className="av-stack">{(p.members || []).slice(0, 4).map(m => <div key={m} className="av av-sm">{m[0]}</div>)}</div>
                <span style={{ fontSize: 12, color: 'var(--text3)' }}>이슈 {totalIssues}개</span>
              </div>
            </div>
          );
        })}
        <div className="pcard" style={{ borderStyle: 'dashed', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, minHeight: 200, background: 'transparent', boxShadow: 'none' }} onClick={() => setModal(true)}>
          <div style={{ width: 34, height: 34, border: '1.5px dashed var(--border2)', borderRadius: '50%', display: 'grid', placeItems: 'center', fontSize: 20, color: 'var(--text3)' }}>+</div>
          <div style={{ fontSize: 13, color: 'var(--text3)', fontWeight: 500 }}>새 프로젝트 추가</div>
        </div>
      </div>
      <Modal open={modal} onClose={() => setModal(false)}>
        <div className="modal-title">새 프로젝트</div>
        <div className="fg"><label className="fl">프로젝트 이름</label><input className="fi" value={f.name} onChange={e => set('name', e.target.value)} placeholder="예: 서비스 리뉴얼" /></div>
        <div className="fg"><label className="fl">설명</label><textarea rows={2} value={f.desc} onChange={e => set('desc', e.target.value)} placeholder="프로젝트 목적을 간략히 입력하세요" style={{ resize: 'none' }} /></div>
        <ProjectVisibilityField visibility={visibility} onVisibilityChange={setVisibility} members={members} onMembersChange={setMembers} />
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

const LANG_LABEL = { javascript: 'JavaScript', typescript: 'TypeScript', python: 'Python', java: 'Java', go: 'Go' };
const FOCUS_LABEL = { all: '전체', security: '보안 취약점', performance: '성능 최적화', quality: '코드 품질' };
const fmtDate = (ms) => new Date(ms).toLocaleString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
const scoreColor = (s) => (s >= 80 ? 'var(--green)' : s >= 60 ? 'var(--orange)' : 'var(--red)');

export function CodeReview() {
  const { user, toast, addNotif } = useApp();
  const [code, setCode] = useState('');
  const [lang, setLang] = useState('javascript');
  const [focus, setFocus] = useState('all');
  const [review, setReview] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  // ── 리뷰 내역 (Firestore 저장 데이터, Groq 재호출 없음) ──
  const [history, setHistory] = useState([]);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyLang, setHistoryLang] = useState('all');
  const [historySearch, setHistorySearch] = useState('');
  const [viewing, setViewing] = useState(null); // 현재 화면에 표시 중인 저장 리뷰 { id, createdAtMs }
  const restoredRef = useRef(false);

  useEffect(() => {
    if (!user?.uid) return;
    return subscribeMyCodeReviews(user.uid,
      list => { setHistory(list); setHistoryLoaded(true); },
      err => { console.error('리뷰 내역 구독 에러:', err); setHistoryLoaded(true); toast('리뷰 내역을 불러오지 못했습니다', 'e'); });
  }, [user?.uid, toast]);

  // 저장된 리뷰를 화면에 표시 (입력 코드 + 분석 결과)
  const showSaved = (h) => {
    setCode(h.code || '');
    if (LANG_LABEL[h.lang]) setLang(h.lang);
    if (FOCUS_LABEL[h.focus]) setFocus(h.focus);
    setReview(toReview(h));
    setError(null);
    setViewing({ id: h.id, createdAtMs: h.createdAtMs });
  };

  // 페이지 이동/새로고침 후 다시 들어오면 가장 최근 리뷰를 복원 (한 번만)
  useEffect(() => {
    if (restoredRef.current || !historyLoaded) return;
    restoredRef.current = true;
    if (history.length && !review && !loading && !code.trim()) showSaved(history[0]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [historyLoaded, history]);

  const removeHistory = async (h) => {
    if (!window.confirm(`${fmtDate(h.createdAtMs)} 리뷰 내역을 삭제할까요?`)) return;
    try {
      await deleteCodeReview(h.id);
      if (viewing?.id === h.id) setViewing(null);
      toast('리뷰 내역을 삭제했습니다', 'i');
    } catch (e) {
      console.error('리뷰 내역 삭제 실패:', e);
      toast('삭제에 실패했습니다', 'e');
    }
  };

  const filteredHistory = history.filter(h => {
    if (historyLang !== 'all' && h.lang !== historyLang) return false;
    const q = historySearch.trim().toLowerCase();
    if (!q) return true;
    return [h.code, h.summary, ...(h.issues || []).map(i => i.title)].some(t => String(t || '').toLowerCase().includes(q));
  });

  const run = async () => {
    if (!code.trim()) { toast('코드를 입력하세요', 'e'); return; }
    if (loading) return;
    setLoading(true); setReview(null); setError(null); setViewing(null);
    try {
      // 실제 AI(Groq) 호출 + 응답 형식 검증을 모두 통과한 경우에만 결과 표시
      const { review: result, meta } = await requestReviewFromBackend({ lang, focus, code }); // 백엔드 → Groq API
      setReview(result);
      toast('코드 리뷰 완료', 's');
      addNotif('ai', 'AI 코드 리뷰 완료');
      // 분석 성공 시 리뷰 내역에 자동 저장
      try {
        const id = await saveCodeReview(user.uid, { code, lang, focus, review: result, model: meta?.model });
        setViewing({ id, createdAtMs: Date.now() });
      } catch (e) {
        console.error('리뷰 내역 저장 실패:', e);
        toast('리뷰는 완료됐지만 내역 저장에 실패했습니다 (Firestore 보안 규칙 확인)', 'e');
      }
    } catch (e) {
      console.error('AI 코드 리뷰 실패:', e);
      const msg = reviewErrorMessage(e);
      setError({ msg, detail: String(e?.message || '') });
      toast(msg, 'e');
    }
    setLoading(false);
  };

  const sc = review ? scoreColor(review.score) : null;

  return (
    <div>
      {/* 상단: 리뷰 내역 버튼 */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
        <button className="btn btn-outline btn-sm" onClick={() => setHistoryOpen(true)}>
          🕘 리뷰 내역{historyLoaded ? ` (${history.length})` : ''}
        </button>
      </div>
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
        <button className="btn btn-primary btn-full" onClick={run} disabled={loading}>AI 코드 리뷰 시작</button>
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
                  {viewing && (
                    <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 6 }}>
                      💾 저장된 리뷰 · {fmtDate(viewing.createdAtMs)} · {LANG_LABEL[lang]} · {FOCUS_LABEL[focus]}
                    </div>
                  )}
                </div>
              </div>
            </div>
            {(review.issues || []).map((iss, i) => (
              <div key={i} className="ri">
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                  <span className={`sev-${iss.severity === 'critical' ? 'c' : iss.severity === 'warning' ? 'w' : 'i'}`}>{iss.severity === 'critical' ? '긴급' : iss.severity === 'warning' ? '경고' : '정보'}</span>
                  {iss.line != null && <span style={{ fontSize: 11.5, fontFamily: 'var(--mono)', color: 'var(--text3)', background: 'var(--bg)', padding: '1px 7px', borderRadius: 3, border: '1px solid var(--border)' }}>Line {iss.line}</span>}
                  <span style={{ fontSize: 13, fontWeight: 600 }}>{iss.title}</span>
                </div>
                <div style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.6, marginBottom: 5 }}>{iss.desc}</div>
                <div className="ri-fix">{iss.fix}</div>
              </div>
            ))}
          </>
        ) : error ? (
          <div className="card" style={{ minHeight: 280, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', gap: 10 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--red)' }}>AI 리뷰에 실패했습니다</div>
            <div style={{ fontSize: 13, color: 'var(--text2)' }}>{error.msg}</div>
            {error.detail && <div style={{ fontSize: 11, color: 'var(--text3)', maxWidth: 360, wordBreak: 'break-all' }}>{error.detail.slice(0, 200)}</div>}
            <button className="btn btn-outline btn-sm" onClick={run}>다시 시도</button>
          </div>
        ) : (
          <div className="card" style={{ minHeight: 280, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', gap: 10 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text2)' }}>분석 대기 중</div>
            <div style={{ fontSize: 13, color: 'var(--text3)' }}>코드를 입력하고 분석을 시작하세요</div>
          </div>
        )}
      </div>
    </div>

      {/* 리뷰 내역 모달 */}
      <Modal open={historyOpen} onClose={() => setHistoryOpen(false)}>
        <div className="modal-title">리뷰 내역</div>
        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          <select style={{ width: 140 }} value={historyLang} onChange={e => setHistoryLang(e.target.value)}>
            <option value="all">전체 언어</option>
            {Object.entries(LANG_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <input className="fi" style={{ flex: 1 }} placeholder="코드, 요약, 지적 내용 검색..." value={historySearch} onChange={e => setHistorySearch(e.target.value)} />
        </div>
        <div style={{ maxHeight: 420, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {!historyLoaded ? (
            <div style={{ fontSize: 13, color: 'var(--text3)', textAlign: 'center', padding: '24px 0' }}>불러오는 중...</div>
          ) : filteredHistory.length === 0 ? (
            <div style={{ fontSize: 13, color: 'var(--text3)', textAlign: 'center', padding: '24px 0' }}>
              {history.length === 0 ? '저장된 리뷰 내역이 없습니다' : '조건에 맞는 리뷰 내역이 없습니다'}
            </div>
          ) : filteredHistory.map(h => (
            <div key={h.id} className="issue-row" style={{ cursor: 'pointer', margin: 0, background: viewing?.id === h.id ? 'var(--accent-light)' : undefined }}
              onClick={() => { showSaved(h); setHistoryOpen(false); }}>
              <div style={{ fontSize: 20, fontWeight: 800, color: scoreColor(h.score), minWidth: 36, textAlign: 'center' }}>{h.score}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="ir-title" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{h.summary}</div>
                <div className="ir-meta">
                  <span className="badge b-progress">{LANG_LABEL[h.lang] || h.lang}</span>
                  <span>{FOCUS_LABEL[h.focus] || h.focus}</span>
                  <span>지적 {(h.issues || []).length}건</span>
                  <span>{fmtDate(h.createdAtMs)}</span>
                </div>
                <div style={{ fontSize: 11.5, fontFamily: 'var(--mono)', color: 'var(--text3)', marginTop: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {(h.code || '').split('\n').find(l => l.trim()) || ''}
                </div>
              </div>
              <button className="btn btn-danger btn-xs" onClick={e => { e.stopPropagation(); removeHistory(h); }}>삭제</button>
            </div>
          ))}
        </div>
        <div className="modal-ft">
          <button className="btn btn-outline" onClick={() => setHistoryOpen(false)}>닫기</button>
        </div>
      </Modal>
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
            const progress = pi.length > 0 ? Math.round((pd / pi.length) * 100) : 0;
            return (
              <div key={p.id} style={{ marginBottom: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 7 }}>
                  <span style={{ fontSize: 13, fontWeight: 500, display: 'flex', alignItems: 'center', gap: 7 }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: p.color, display: 'inline-block' }} />{p.name}
                  </span>
                  <span style={{ fontSize: 12, color: 'var(--text3)' }}>{pd}/{pi.length} 완료</span>
                </div>
                <div className="prog"><div className="prog-f" style={{ width: `${progress}%`, background: p.color }} /></div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
