import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import Modal from '../components/Modal';
import { InviteStatusBadge, RejectedInvites } from '../components/MemberPicker';
import { MyInviteBar, LeaveButton } from '../components/InviteActions';
import { DndContext, closestCorners, PointerSensor, useSensor, useSensors, useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

const sL = s => ({ todo: '대기', progress: '진행중', review: '리뷰중', done: '완료' }[s] || s);
const pL = p => ({ critical: '긴급', high: '높음', medium: '보통', low: '낮음' }[p] || p);

function KanbanCard({ issue, onClick }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: issue.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners} className="kcard" onClick={onClick}>
      <div className="kct2">
        {issue.title}
        {issue.dueDate && new Date(issue.dueDate) < new Date() && issue.status !== 'done' && (
          <span style={{ marginLeft: 6, padding: '2px 6px', background: 'var(--red-bg)', color: 'var(--red)', borderRadius: '3px', fontSize: '10px', fontWeight: 500 }}>기한초과</span>
        )}
      </div>
      {issue.dueDate && (
        <div style={{ fontSize: '11px', color: 'var(--text3)', marginTop: 4 }}>📅 {issue.dueDate}</div>
      )}
      <div className="kfoot">
        <span className={`badge b-${issue.priority}`}>{pL(issue.priority)}</span>
        <div className="av av-sm">{issue.assignee?.[0]}</div>
      </div>
    </div>
  );
}

function DroppableColumn({ id, children }) {
  const { setNodeRef } = useDroppable({ id });
  return (
    <div ref={setNodeRef} className="kbody" style={{ minHeight: '100px' }}>
      {children}
    </div>
  );
}

function IssueDetailModal({ issue, onClose, onUserClick }) {
  const { user, toast, updateIssue, deleteIssue, getAllUsers, inviteToItem, issues } = useApp();
  const [participantDetails, setParticipantDetails] = React.useState([]);
  const [showAddParticipant, setShowAddParticipant] = React.useState(false);
  const [allUsers, setAllUsers] = React.useState([]);
  const [searchTerm, setSearchTerm] = React.useState('');
  const [comment, setComment] = useState('');
  const [localIssue, setLocalIssue] = useState(issue);

  React.useEffect(() => {
    if (localIssue.participantUids) {
      getAllUsers().then(users => {
        const details = localIssue.participantUids.map(uid => users.find(u => u.uid === uid)).filter(Boolean);
        setParticipantDetails(details);
        if (allUsers.length === 0) {
          setAllUsers(users);
        }
      });
    }
  }, [localIssue.participantUids, getAllUsers, allUsers.length]);

  // 참여자 추가 → 바로 등록 + 초대장 발송 (상대가 거절하면 제외됨)
  const addParticipant = async (member) => {
    if (localIssue.participantUids?.includes(member.uid)) return;
    const ok = await inviteToItem('issue', issue.id, localIssue.title, member);
    if (!ok) return;
    setLocalIssue(prev => ({
      ...prev,
      participantUids: [...(prev.participantUids || []), member.uid],
      inviteStatus: { ...(prev.inviteStatus || {}), [member.uid]: { status: 'pending', name: member.name } },
    }));
  };

  // 상대방의 수락/거절을 실시간으로 반영
  React.useEffect(() => {
    const live = issues.find(i => i.id === issue.id);
    if (live) setLocalIssue(prev => ({ ...prev, participantUids: live.participantUids, inviteStatus: live.inviteStatus }));
  }, [issues, issue.id]);

  const removeParticipant = async (uid) => {
    if (!window.confirm('이 참여자를 제거하시겠습니까?')) return;
    const newUids = localIssue.participantUids?.filter(id => id !== uid) || [];
    await updateIssue(issue.id, 'participantUids', newUids);
    setLocalIssue(prev => ({ ...prev, participantUids: newUids }));
    toast('참여자를 제거했습니다', 's');
  };

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
      <MyInviteBar type="issue" item={localIssue} onRejected={onClose} />
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

      {/* 참여자 관리 */}
      <div style={{ marginBottom: 16, padding: '12px', background: 'var(--bg)', borderRadius: 'var(--r-sm)', border: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <div style={{ fontSize: 13, fontWeight: 600 }}>참여자 ({participantDetails.length}명)</div>
          <button
            className="btn btn-outline btn-xs"
            onClick={() => setShowAddParticipant(!showAddParticipant)}
          >
            + 추가
          </button>
        </div>

        {/* 참여자 목록 */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: showAddParticipant ? 8 : 0 }}>
          {participantDetails.map((p) => (
            <div
              key={p.uid}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '4px 8px',
                background: 'var(--accent-light)',
                borderRadius: 'var(--r-sm)',
                fontSize: 13
              }}
            >
              {p.photoURL ? (
                <img
                  src={p.photoURL}
                  alt={p.name}
                  style={{ width: 20, height: 20, borderRadius: '50%', objectFit: 'cover', cursor: 'pointer' }}
                  onClick={() => onUserClick && onUserClick(p.uid)}
                />
              ) : (
                <div
                  style={{ width: 20, height: 20, borderRadius: '50%', background: 'var(--accent)', color: '#fff', display: 'grid', placeItems: 'center', fontSize: 10, fontWeight: 600, cursor: 'pointer' }}
                  onClick={() => onUserClick && onUserClick(p.uid)}
                >
                  {p.name[0]}
                </div>
              )}
              <span style={{ cursor: 'pointer' }} onClick={() => onUserClick && onUserClick(p.uid)}>{p.name}</span>
              <InviteStatusBadge status={localIssue.inviteStatus?.[p.uid]?.status} />
              <button
                type="button"
                onClick={() => removeParticipant(p.uid)}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: 0,
                  marginLeft: 2,
                  color: 'var(--text3)',
                  fontSize: 14,
                  lineHeight: 1
                }}
              >
                ×
              </button>
            </div>
          ))}
        </div>

        <RejectedInvites inviteStatus={localIssue.inviteStatus} />

        {/* 참여자 추가 모달 */}
        {showAddParticipant && (
          <div style={{
            border: '1px solid var(--border)',
            borderRadius: 'var(--r-sm)',
            padding: 12,
            background: 'var(--white)',
            maxHeight: 250,
            overflowY: 'auto'
          }}>
            <input
              type="text"
              className="fi"
              placeholder="이름, 이메일, 부서로 검색..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              style={{ marginBottom: 8, width: '100%' }}
            />
            {allUsers
              .filter(u =>
                !localIssue.participantUids?.includes(u.uid) &&
                (u.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                u.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                u.department?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                u.team?.toLowerCase().includes(searchTerm.toLowerCase()))
              )
              .map(member => (
                <div
                  key={member.uid}
                  onClick={() => { addParticipant(member); setShowAddParticipant(false); }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '8px 12px',
                    cursor: 'pointer',
                    borderRadius: 'var(--r-sm)',
                    background: 'transparent',
                    marginBottom: 4
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--accent-light)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  {member.photoURL ? (
                    <img src={member.photoURL} alt={member.name} style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover' }} />
                  ) : (
                    <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--accent)', color: '#fff', display: 'grid', placeItems: 'center', fontSize: 12, fontWeight: 600 }}>
                      {member.name?.[0]}
                    </div>
                  )}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 500 }}>{member.name}</div>
                    <div style={{ fontSize: 11, color: 'var(--text3)' }}>
                      {member.department || member.team || member.role} · {member.email}
                    </div>
                  </div>
                </div>
              ))}
            {allUsers.filter(u => !localIssue.participantUids?.includes(u.uid)).length === 0 && (
              <div style={{ fontSize: 13, color: 'var(--text3)', textAlign: 'center', padding: '16px 0' }}>
                추가할 수 있는 사용자가 없습니다
              </div>
            )}
          </div>
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
        {localIssue.createdBy === user?.uid && (
          <button className="btn btn-danger btn-sm" onClick={async () => { await deleteIssue(issue.id); onClose(); }}>이슈 삭제</button>
        )}
        <LeaveButton type="issue" item={localIssue} onLeft={onClose} />
        <button className="btn btn-outline" onClick={onClose}>닫기</button>
      </div>
    </>
  );
}

// 이슈 관리의 두 '+ 새 이슈' 버튼(상단 헤더 / 목록·칸반 옆)이 공통으로 사용하는 입력 화면
export function NewIssueModal({ onClose, projects: projectsProp, defaultStatus = 'todo' }) {
  const { user, createIssue, getAllUsers, toast, projects: ctxProjects } = useApp();
  const projects = projectsProp || ctxProjects;
  const [f, setF] = useState({
    pid: projects.length > 0 ? projects[0].id : '', title: '', desc: '',
    priority: 'medium', status: defaultStatus,
    assignee: user?.name || '', tags: '',
    startDate: '', dueDate: ''
  });
  const [participants, setParticipants] = useState([user]);
  const [showParticipantSelect, setShowParticipantSelect] = useState(false);
  const [allUsers, setAllUsers] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const set = (k, v) => setF(p => ({ ...p, [k]: v }));

  React.useEffect(() => {
    if (showParticipantSelect && allUsers.length === 0) {
      getAllUsers().then(users => setAllUsers(users));
    }
  }, [showParticipantSelect, allUsers.length, getAllUsers]);

  const toggleParticipant = (member) => {
    if (member.uid === user.uid) return;
    if (participants.find(p => p.uid === member.uid)) {
      setParticipants(participants.filter(p => p.uid !== member.uid));
    } else {
      setParticipants([...participants, member]);
    }
  };

  const removeParticipant = (uid) => {
    if (uid === user.uid) return;
    setParticipants(participants.filter(p => p.uid !== uid));
  };

  const submit = async () => {
    if (!f.title.trim()) { toast('이슈 제목을 입력하세요', 'e'); return; }
    if (f.startDate && f.dueDate && f.startDate > f.dueDate) {
      toast('시작일은 마감일보다 늦을 수 없습니다', 'e');
      return;
    }
    await createIssue({
      ...f,
      tags: f.tags.split(',').map(t => t.trim()).filter(Boolean),
      comments: [],
      participantUids: participants.map(p => p.uid),
    }, participants.filter(p => p.uid !== user.uid)); // 생성자 외 참여자에게 초대장 발송
    onClose();
  };

  return (
    <>
      <div className="modal-title">새 이슈</div>
      <div className="fg">
        <label className="fl">프로젝트</label>
        <select value={f.pid} onChange={e => set('pid', e.target.value)}>
          <option value="">미지정</option>
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

      {/* 참여자 선택 */}
      <div className="fg">
        <label className="fl">참여자 ({participants.length}명)</label>
        <button
          type="button"
          className="btn btn-outline btn-sm"
          onClick={() => setShowParticipantSelect(!showParticipantSelect)}
          style={{ marginBottom: 8 }}
        >
          👥 참여자 추가
        </button>

        {/* 선택된 참여자 목록 */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
          {participants.map(p => (
            <div
              key={p.uid}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '4px 8px',
                background: 'var(--accent-light)',
                borderRadius: 'var(--r-sm)',
                fontSize: 13
              }}
            >
              {p.photoURL ? (
                <img src={p.photoURL} alt={p.name} style={{ width: 20, height: 20, borderRadius: '50%', objectFit: 'cover' }} />
              ) : (
                <div style={{ width: 20, height: 20, borderRadius: '50%', background: 'var(--accent)', color: '#fff', display: 'grid', placeItems: 'center', fontSize: 10, fontWeight: 600 }}>
                  {p.name?.[0]}
                </div>
              )}
              <span>{p.name}</span>
              {p.uid !== user.uid && (
                <button
                  type="button"
                  onClick={() => removeParticipant(p.uid)}
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    padding: 0,
                    marginLeft: 2,
                    color: 'var(--text3)',
                    fontSize: 14,
                    lineHeight: 1
                  }}
                >
                  ×
                </button>
              )}
            </div>
          ))}
        </div>

        {/* 사용자 선택 모달 */}
        {showParticipantSelect && (
          <div style={{
            border: '1px solid var(--border)',
            borderRadius: 'var(--r-sm)',
            padding: 12,
            background: 'var(--bg)',
            maxHeight: 300,
            overflowY: 'auto'
          }}>
            <input
              type="text"
              className="fi"
              placeholder="이름, 이메일, 부서로 검색..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              style={{ marginBottom: 8, width: '100%' }}
            />
            {allUsers
              .filter(u =>
                u.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                u.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                u.department?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                u.team?.toLowerCase().includes(searchTerm.toLowerCase())
              )
              .map(member => {
                const isSelected = participants.find(p => p.uid === member.uid);
                const isCurrentUser = member.uid === user.uid;
                return (
                  <div
                    key={member.uid}
                    onClick={() => !isCurrentUser && toggleParticipant(member)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      padding: '8px 12px',
                      cursor: isCurrentUser ? 'default' : 'pointer',
                      borderRadius: 'var(--r-sm)',
                      background: isSelected ? 'var(--accent-light)' : 'transparent',
                      marginBottom: 4,
                      opacity: isCurrentUser ? 0.6 : 1
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={!!isSelected}
                      disabled={isCurrentUser}
                      onChange={() => {}}
                      style={{ cursor: isCurrentUser ? 'default' : 'pointer' }}
                    />
                    {member.photoURL ? (
                      <img src={member.photoURL} alt={member.name} style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover' }} />
                    ) : (
                      <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--accent)', color: '#fff', display: 'grid', placeItems: 'center', fontSize: 12, fontWeight: 600 }}>
                        {member.name?.[0]}
                      </div>
                    )}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 500 }}>
                        {member.name} {isCurrentUser && '(나)'}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text3)' }}>
                        {member.department || member.team || member.role} · {member.email}
                      </div>
                    </div>
                  </div>
                );
              })}
          </div>
        )}
      </div>

      <div className="modal-ft">
        <button className="btn btn-outline" onClick={onClose}>취소</button>
        <button className="btn btn-primary" onClick={submit}>등록</button>
      </div>
    </>
  );
}

export default function Issues({ filter = { status: 'all', priority: 'all', project: 'all', search: '' }, onUserClick }) {
  const { user, issues, projects, updateIssue, deleteIssue } = useApp();
  const [localFilter, setLocalFilter] = useState(filter);
  const [view, setView] = useState('list');
  const [modal, setModal] = useState(null);
  const [newStatus, setNewStatus] = useState('todo');

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  const lf = (k, v) => setLocalFilter(p => ({ ...p, [k]: v }));

  const filtered = issues.filter(i => {
    if (localFilter.project !== 'all') {
      if (localFilter.project === 'none' && i.pid) return false;
      if (localFilter.project !== 'none' && i.pid !== localFilter.project) return false;
    }
    if (localFilter.status !== 'all' && i.status !== localFilter.status) return false;
    if (localFilter.priority !== 'all' && i.priority !== localFilter.priority) return false;
    if (localFilter.search && !i.title.toLowerCase().includes(localFilter.search.toLowerCase())) return false;
    return true;
  });

  const cycleStatus = async (id, currentStatus) => {
    const cycle = { todo: 'progress', progress: 'review', review: 'done', done: 'todo' };
    await updateIssue(id, 'status', cycle[currentStatus]);
  };

  const handleDragEnd = async (event) => {
    const { active, over } = event;
    if (!over) return;

    const issueId = active.id;
    const newStatus = over.id;

    const issue = issues.find(i => i.id === issueId);
    if (issue && issue.status !== newStatus) {
      await updateIssue(issueId, 'status', newStatus);
    }
  };

  return (
    <div>
      {/* Filter bar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 9 }}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <select style={{ width: 140 }} value={localFilter.project} onChange={e => lf('project', e.target.value)}>
            <option value="all">전체 프로젝트</option>
            <option value="none">미지정</option>
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
        <DndContext sensors={sensors} collisionDetection={closestCorners} onDragEnd={handleDragEnd}>
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
                  <SortableContext items={ci.map(i => i.id)} strategy={verticalListSortingStrategy}>
                    <DroppableColumn id={col.k}>
                      {ci.map(i => (
                        <KanbanCard key={i.id} issue={i} onClick={() => setModal({ type: 'detail', data: i })} />
                      ))}
                      <button className="kadd" onClick={() => { setNewStatus(col.k); setModal({ type: 'new' }); }}>+ 이슈 추가</button>
                    </DroppableColumn>
                  </SortableContext>
                </div>
              );
            })}
          </div>
        </DndContext>
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
                  <div className="ir-title">
                    {i.title}
                    {i.dueDate && new Date(i.dueDate) < new Date() && i.status !== 'done' && (
                      <span style={{ marginLeft: 8, padding: '2px 7px', background: 'var(--red-bg)', color: 'var(--red)', borderRadius: '3px', fontSize: '11px', fontWeight: 500 }}>기한 초과</span>
                    )}
                  </div>
                  <div className="ir-meta">
                    <span className={`badge b-${i.status}`}>{sL(i.status)}</span>
                    <span className={`badge b-${i.priority}`}>{pL(i.priority)}</span>
                    {proj && <span>{proj.name}</span>}
                    <span>{i.assignee} · {i.created}</span>
                    {i.dueDate && <span>마감: {i.dueDate}</span>}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 6, flexShrink: 0 }} onClick={e => e.stopPropagation()}>
                  <select
                    value={i.status}
                    onChange={e => updateIssue(i.id, 'status', e.target.value)}
                    style={{
                      padding: '4px 9px',
                      fontSize: '12px',
                      border: '1px solid var(--border)',
                      borderRadius: 'var(--r-sm)',
                      background: 'var(--white)',
                      color: 'var(--text2)',
                      cursor: 'pointer'
                    }}
                  >
                    <option value="todo">대기</option>
                    <option value="progress">진행중</option>
                    <option value="review">리뷰중</option>
                    <option value="done">완료</option>
                  </select>
                  {i.createdBy === user?.uid && (
                    <button className="btn btn-danger btn-xs" onClick={() => deleteIssue(i.id)}>삭제</button>
                  )}
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
            onUserClick={onUserClick}
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
