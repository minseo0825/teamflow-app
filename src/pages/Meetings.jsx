import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import Modal from '../components/Modal';
import { InviteMembersField, InviteStatusBadge, RejectedInvites } from '../components/MemberPicker';
import { MyInviteBar, LeaveButton, ReinviteButton } from '../components/InviteActions';

function NewMeetingModal({ onClose, projects }) {
  const { user, createMeeting, toast } = useApp();
  const [f, setF] = useState({
    pid: projects[0]?.id || '',
    title: '',
    date: new Date().toISOString().split('T')[0],
    attendees: user?.name || '',
    content: '',
    summary: '',
  });
  const [invitees, setInvitees] = useState([]);
  const set = (k, v) => setF(p => ({ ...p, [k]: v }));

  const submit = async () => {
    if (!f.title.trim()) { toast('회의 제목을 입력하세요', 'e'); return; }
    if (!f.content.trim()) { toast('회의 내용을 입력하세요', 'e'); return; }
    await createMeeting({
      ...f,
      attendees: f.attendees.split(',').map(a => a.trim()).filter(Boolean),
    }, invitees);
    onClose();
  };

  return (
    <>
      <div className="modal-title">새 회의록</div>
      <div className="fg">
        <label className="fl">프로젝트</label>
        <select value={f.pid} onChange={e => set('pid', e.target.value)}>
          {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </div>
      <div className="fg">
        <label className="fl">회의 제목</label>
        <input className="fi" value={f.title} onChange={e => set('title', e.target.value)} placeholder="회의 제목을 입력하세요" />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div className="fg">
          <label className="fl">날짜</label>
          <input className="fi" type="date" value={f.date} onChange={e => set('date', e.target.value)} />
        </div>
        <div className="fg">
          <label className="fl">참석자 (쉼표 구분)</label>
          <input className="fi" value={f.attendees} onChange={e => set('attendees', e.target.value)} placeholder="김지수, 이민호" />
        </div>
      </div>
      <div className="fg">
        <label className="fl">회의 내용</label>
        <textarea rows={5} value={f.content} onChange={e => set('content', e.target.value)} placeholder="회의에서 논의된 내용을 입력하세요" />
      </div>
      <div className="fg">
        <label className="fl">요약 (선택)</label>
        <textarea rows={2} value={f.summary} onChange={e => set('summary', e.target.value)} placeholder="회의 요약을 입력하세요" />
      </div>
      <InviteMembersField selected={invitees} onChange={setInvitees} />
      <div className="modal-ft">
        <button className="btn btn-outline" onClick={onClose}>취소</button>
        <button className="btn btn-primary" onClick={submit}>등록</button>
      </div>
    </>
  );
}

function MeetingDetailModal({ meeting, onClose, projects }) {
  const { updateMeeting, deleteMeeting, toast, user, meetings } = useApp();
  const [editing, setEditing] = useState(false);
  // 초대 수락/거절 상태는 실시간 데이터 기준으로 표시
  const live = meetings.find(m => m.id === meeting.id) || meeting;
  const invitedList = (live.attendeeUids || [])
    .filter(uid => live.inviteStatus?.[uid])
    .map(uid => ({ uid, ...live.inviteStatus[uid] }));
  // 기존 회의록(createdBy만 있음) 포함, 생성자만 수정/삭제
  const isOwner = meeting.createdBy === user?.uid;
  const [form, setForm] = useState({ ...meeting, attendees: meeting.attendees?.join(', ') || '' });
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const proj = projects.find(p => p.id === meeting.pid);

  const save = async () => {
    await updateMeeting(meeting.id, {
      ...form,
      attendees: form.attendees.split(',').map(a => a.trim()).filter(Boolean),
    });
    setEditing(false);
  };

  return (
    <>
      <div style={{ fontSize: 11.5, color: 'var(--text3)', fontWeight: 500, marginBottom: 5 }}>
        {proj?.name} · {meeting.date}
      </div>
      {editing ? (
        <>
          <div className="fg">
            <label className="fl">제목</label>
            <input className="fi" value={form.title} onChange={e => set('title', e.target.value)} />
          </div>
          <div className="fg">
            <label className="fl">참석자</label>
            <input className="fi" value={form.attendees} onChange={e => set('attendees', e.target.value)} />
          </div>
          <div className="fg">
            <label className="fl">내용</label>
            <textarea rows={6} value={form.content} onChange={e => set('content', e.target.value)} />
          </div>
          <div className="fg">
            <label className="fl">요약</label>
            <textarea rows={3} value={form.summary} onChange={e => set('summary', e.target.value)} />
          </div>
          <div className="modal-ft">
            <button className="btn btn-outline" onClick={() => setEditing(false)}>취소</button>
            <button className="btn btn-primary" onClick={save}>저장</button>
          </div>
        </>
      ) : (
        <>
          <MyInviteBar type="meeting" item={live} onRejected={onClose} />
          <div className="modal-title">{meeting.title}</div>
          <div style={{ display: 'flex', gap: 16, marginBottom: 16, flexWrap: 'wrap' }}>
            <div>
              <div className="dl">참석자</div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 4 }}>
                {meeting.attendees?.map(a => (
                  <div key={a} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                    <div className="av av-sm">{a[0]}</div>
                    <span style={{ fontSize: 12 }}>{a}</span>
                  </div>
                ))}
              </div>
            </div>
            {invitedList.length > 0 && (
              <div>
                <div className="dl">초대된 참여자</div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 4 }}>
                  {invitedList.map(p => (
                    <div key={p.uid} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                      <div className="av av-sm">{p.name?.[0]}</div>
                      <span style={{ fontSize: 12 }}>{p.name}</span>
                      <InviteStatusBadge status={p.status} />
                    </div>
                  ))}
                </div>
                <RejectedInvites inviteStatus={live.inviteStatus} />
              </div>
            )}
            {isOwner && (
              <div>
                {invitedList.length === 0 && <div className="dl">초대된 참여자</div>}
                <ReinviteButton type="meeting" item={live} />
                {invitedList.length === 0 && <RejectedInvites inviteStatus={live.inviteStatus} />}
              </div>
            )}
          </div>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>회의 내용</div>
          <div style={{ fontSize: 13.5, color: 'var(--text2)', lineHeight: 1.8, background: 'var(--bg)', padding: '13px 15px', borderRadius: 'var(--r-sm)', border: '1px solid var(--border)', marginBottom: 12, whiteSpace: 'pre-wrap' }}>
            {meeting.content}
          </div>
          {meeting.summary && (
            <>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>요약</div>
              <div style={{ fontSize: 13.5, color: 'var(--text2)', lineHeight: 1.8, background: 'var(--accent-light)', padding: '13px 15px', borderRadius: 'var(--r-sm)', border: '1px solid var(--accent-border)', marginBottom: 12 }}>
                {meeting.summary}
              </div>
            </>
          )}
          <div className="modal-ft">
            {isOwner && <button className="btn btn-danger btn-sm" onClick={async () => { await deleteMeeting(meeting.id); onClose(); }}>삭제</button>}
            {isOwner && <button className="btn btn-outline" onClick={() => setEditing(true)}>수정</button>}
            <LeaveButton type="meeting" item={live} onLeft={onClose} />
            <button className="btn btn-outline" onClick={onClose}>닫기</button>
          </div>
        </>
      )}
    </>
  );
}

export default function Meetings() {
  const { meetings, projects } = useApp();
  const [modal, setModal] = useState(null);
  const [search, setSearch] = useState('');

  const filtered = meetings.filter(m =>
    !search || m.title?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, gap: 9 }}>
        <input
          className="fi" style={{ maxWidth: 260 }}
          placeholder="회의록 검색..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <button className="btn btn-primary btn-sm" onClick={() => setModal({ type: 'new' })}>+ 새 회의록</button>
      </div>

      {!filtered.length ? (
        <div className="card">
          <div className="empty-st">
            <div className="empty-lbl">회의록이 없습니다</div>
            <div style={{ fontSize: 13 }}>새 회의록을 등록해보세요</div>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {filtered.map(m => {
            const proj = projects.find(p => p.id === m.pid);
            return (
              <div key={m.id} className="card" style={{ cursor: 'pointer', transition: 'box-shadow .15s' }}
                onClick={() => setModal({ type: 'detail', data: m })}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 5 }}>{m.title}</div>
                    <div style={{ fontSize: 12, color: 'var(--text3)', display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                      {proj && <span style={{ color: 'var(--accent)', fontWeight: 500 }}>{proj.name}</span>}
                      <span>📅 {m.date}</span>
                      <span>👥 {Array.isArray(m.attendees) ? m.attendees.join(', ') : m.attendees}</span>
                    </div>
                    {m.content && (
                      <div style={{ fontSize: 13, color: 'var(--text2)', marginTop: 8, lineHeight: 1.6,
                        overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                        {m.content}
                      </div>
                    )}
                  </div>
                  {m.summary && (
                    <div style={{ fontSize: 11, background: 'var(--accent-light)', color: 'var(--accent)', padding: '3px 8px', borderRadius: 4, flexShrink: 0 }}>
                      요약 있음
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Modal open={!!modal} onClose={() => setModal(null)}>
        {modal?.type === 'new' && (
          <NewMeetingModal onClose={() => setModal(null)} projects={projects} />
        )}
        {modal?.type === 'detail' && (
          <MeetingDetailModal meeting={modal.data} onClose={() => setModal(null)} projects={projects} />
        )}
      </Modal>
    </div>
  );
}
