import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';

// 가입한 사용자 검색 + 체크 선택 (본인 제외)
// selected: [{ uid, name, email, ... }]
export default function MemberPicker({ selected, onChange, excludeUids = [] }) {
  const { user, getAllUsers } = useApp();
  const [allUsers, setAllUsers] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    getAllUsers().then(users => setAllUsers(users.filter(u => u.uid !== user.uid)));
  }, [getAllUsers, user.uid]);

  const toggle = (m) => {
    if (selected.find(x => x.uid === m.uid)) onChange(selected.filter(x => x.uid !== m.uid));
    else onChange([...selected, m]);
  };

  const q = searchTerm.toLowerCase();
  const filtered = allUsers.filter(u => !excludeUids.includes(u.uid)).filter(u =>
    u.name?.toLowerCase().includes(q) ||
    u.email?.toLowerCase().includes(q) ||
    u.department?.toLowerCase().includes(q) ||
    u.team?.toLowerCase().includes(q)
  );

  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--r-sm)', padding: 12, background: 'var(--bg)', maxHeight: 220, overflowY: 'auto' }}>
      <input type="text" className="fi" placeholder="이름, 이메일, 부서로 검색..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} style={{ marginBottom: 8, width: '100%' }} />
      {filtered.length === 0 ? (
        <div style={{ fontSize: 13, color: 'var(--text3)', textAlign: 'center', padding: '12px 0' }}>추가할 수 있는 사용자가 없습니다</div>
      ) : filtered.map(m => {
        const isSel = !!selected.find(x => x.uid === m.uid);
        return (
          <div key={m.uid} onClick={() => toggle(m)}
            style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', cursor: 'pointer', borderRadius: 'var(--r-sm)', background: isSel ? 'var(--accent-light)' : 'transparent', marginBottom: 4 }}>
            <input type="checkbox" checked={isSel} onChange={() => {}} style={{ cursor: 'pointer' }} />
            {m.photoURL ? (
              <img src={m.photoURL} alt={m.name} style={{ width: 28, height: 28, borderRadius: '50%', objectFit: 'cover' }} />
            ) : (
              <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--accent)', color: '#fff', display: 'grid', placeItems: 'center', fontSize: 12, fontWeight: 600 }}>{m.name?.[0]}</div>
            )}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 500 }}>{m.name}</div>
              <div style={{ fontSize: 11, color: 'var(--text3)' }}>{m.department || m.team || m.role} · {m.email}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// 새 회의록 등에서 쓰는 '👥 참여자 추가' 필드 (이슈 생성 화면과 같은 형태)
export function InviteMembersField({ label = '참여자 초대', selected, onChange }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="fg">
      <label className="fl">{label} ({selected.length}명)</label>
      <button type="button" className="btn btn-outline btn-sm" onClick={() => setOpen(o => !o)} style={{ marginBottom: 8 }}>
        👥 참여자 추가
      </button>
      {selected.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
          {selected.map(p => (
            <div key={p.uid} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 8px', background: 'var(--accent-light)', borderRadius: 'var(--r-sm)', fontSize: 13 }}>
              <div style={{ width: 20, height: 20, borderRadius: '50%', background: 'var(--accent)', color: '#fff', display: 'grid', placeItems: 'center', fontSize: 10, fontWeight: 600 }}>{p.name?.[0]}</div>
              <span>{p.name}</span>
              <button type="button" onClick={() => onChange(selected.filter(x => x.uid !== p.uid))}
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, marginLeft: 2, color: 'var(--text3)', fontSize: 14, lineHeight: 1 }}>×</button>
            </div>
          ))}
        </div>
      )}
      {open && <MemberPicker selected={selected} onChange={onChange} />}
      <div style={{ fontSize: 11.5, color: 'var(--text3)', marginTop: 6 }}>선택한 사용자에게 초대장이 발송되며, 거절하면 참여자에서 제외됩니다</div>
    </div>
  );
}

// 초대 상태 배지 (inviteStatus[uid].status)
const STATUS_STYLE = {
  pending:  { label: '대기', color: 'var(--orange)', bg: 'var(--orange-bg)' },
  accepted: { label: '수락', color: 'var(--green)',  bg: 'var(--green-bg)' },
  rejected: { label: '거절', color: 'var(--red)',    bg: 'var(--red-bg)' },
  left:     { label: '나감', color: 'var(--text3)',  bg: 'var(--bg)' },
};

export function InviteStatusBadge({ status }) {
  const s = STATUS_STYLE[status];
  if (!s) return null;
  return <span style={{ fontSize: 10.5, fontWeight: 600, color: s.color, background: s.bg, padding: '1px 6px', borderRadius: 8, marginLeft: 4 }}>{s.label}</span>;
}

// 거절한 사람 / 나간 사람 목록 (참여자에서 빠졌으므로 inviteStatus에서 별도 표시)
export function RejectedInvites({ inviteStatus }) {
  const list = Object.values(inviteStatus || {});
  const rejected = list.filter(v => v?.status === 'rejected');
  const left = list.filter(v => v?.status === 'left');
  if (!rejected.length && !left.length) return null;
  return (
    <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 6 }}>
      {rejected.length > 0 && <div>초대 거절: {rejected.map(v => v.name).join(', ')}</div>}
      {left.length > 0 && <div>나감: {left.map(v => v.name).join(', ')}</div>}
    </div>
  );
}
