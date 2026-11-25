import React, { useState } from 'react';
import { useApp, ITEM_INVITE } from '../context/AppContext';
import MemberPicker from './MemberPicker';

// ① 상세 화면에서 초대 응답: 내 상태가 '대기'일 때만 표시
export function MyInviteBar({ type, item, onRejected }) {
  const { user, respondToItemInvite } = useApp();
  const [busy, setBusy] = useState(false);
  const mine = item?.inviteStatus?.[user?.uid];
  if (!item || item.createdBy === user?.uid || mine?.status !== 'pending') return null;

  const respond = async (accept) => {
    setBusy(true);
    await respondToItemInvite(type, item, accept);
    setBusy(false);
    if (!accept) onRejected?.();
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', marginBottom: 14, background: 'var(--accent-light)', border: '1px solid var(--blue-b)', borderRadius: 'var(--r-sm)' }}>
      <div style={{ flex: 1, fontSize: 13, color: 'var(--text2)' }}>
        🔔 이 {ITEM_INVITE[type].label}에 초대되었습니다. 참여 여부를 선택해 주세요.
      </div>
      <button className="btn btn-outline btn-sm" disabled={busy} onClick={() => respond(false)}>거절</button>
      <button className="btn btn-primary btn-sm" disabled={busy} onClick={() => respond(true)}>✓ 수락</button>
    </div>
  );
}

// ② 나가기: 생성자가 아닌 참여자에게만 표시
export function LeaveButton({ type, item, onLeft, size = 'btn-sm' }) {
  const { user, leaveItem } = useApp();
  const uids = item?.[ITEM_INVITE[type].uidsField] || [];
  if (!item || item.createdBy === user?.uid || !uids.includes(user?.uid)) return null;

  const leave = async () => {
    const label = ITEM_INVITE[type].label;
    if (!window.confirm(`이 ${label}에서 나갈까요?\n나가면 목록에서 사라지며, 다시 참여하려면 초대를 받아야 합니다.`)) return;
    const ok = await leaveItem(type, item);
    if (ok) onLeft?.();
  };

  return (
    <button className={`btn ${size}`} onClick={leave}
      style={{ background: 'var(--red-bg, #fff0f0)', color: 'var(--red)', border: '1px solid var(--red)' }}>
      나가기
    </button>
  );
}

// ③ 다시 초대 / 추가 초대: 생성자에게만 표시
export function ReinviteButton({ type, item }) {
  const { user, inviteToItem } = useApp();
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState([]);
  const [busy, setBusy] = useState(false);
  if (!item || item.createdBy !== user?.uid) return null;

  const current = item[ITEM_INVITE[type].uidsField] || [];

  const send = async () => {
    if (!selected.length) return;
    setBusy(true);
    for (const m of selected) {
      // eslint-disable-next-line no-await-in-loop
      await inviteToItem(type, item.id, item.name || item.title || '', m);
    }
    setBusy(false);
    setSelected([]);
    setOpen(false);
  };

  return (
    <div style={{ marginTop: 8 }}>
      <button type="button" className="btn btn-outline btn-xs" onClick={() => setOpen(o => !o)}>+ 초대</button>
      {open && (
        <div style={{ marginTop: 8 }}>
          <MemberPicker selected={selected} onChange={setSelected} excludeUids={current} />
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
            <button className="btn btn-outline btn-sm" onClick={() => { setOpen(false); setSelected([]); }}>취소</button>
            <button className="btn btn-primary btn-sm" disabled={busy || !selected.length} onClick={send}>
              초대 보내기 ({selected.length})
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
