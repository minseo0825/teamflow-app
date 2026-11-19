import React, { useState } from 'react';
import { useApp } from '../context/AppContext';

export default function InviteNotification() {
  const { invites = [], acceptInvite, rejectInvite } = useApp();
  const [dismissed, setDismissed] = useState([]);

  const visible = (invites || []).filter(i => !dismissed.includes(i.id));
  if (!visible.length) return null;

  return (
    <div style={{
      position: 'fixed', top: 16, right: 16, zIndex: 9999,
      display: 'flex', flexDirection: 'column', gap: 10, maxWidth: 360,
    }}>
      {visible.map(invite => (
        <div key={invite.id} style={{
          background: 'var(--white)', border: '1px solid var(--border)',
          borderRadius: 12, padding: '14px 16px',
          boxShadow: '0 4px 24px rgba(0,0,0,.12)',
          animation: 'slideIn .25s ease',
        }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 12 }}>
            <div style={{
              width: 36, height: 36, borderRadius: '50%',
              background: 'var(--accent-light)', color: 'var(--accent)',
              display: 'grid', placeItems: 'center',
              fontSize: 15, fontWeight: 700, flexShrink: 0,
            }}>
              {invite.fromName?.[0]}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13.5, fontWeight: 600, marginBottom: 2 }}>채팅 초대장 도착 🔔</div>
              <div style={{ fontSize: 12.5, color: 'var(--text2)', lineHeight: 1.5 }}>
                <strong>{invite.fromName}</strong>님이 <strong>#{invite.roomName}</strong> 채널에 초대했습니다
              </div>
              <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 3 }}>{invite.fromEmail}</div>
            </div>
            <button onClick={() => setDismissed(p => [...p, invite.id])}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)', fontSize: 16, padding: 0 }}>×</button>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-outline btn-sm" style={{ flex: 1 }}
              onClick={async () => { await rejectInvite(invite.id); setDismissed(p => [...p, invite.id]); }}>
              거절
            </button>
            <button className="btn btn-primary btn-sm" style={{ flex: 2 }}
              onClick={async () => { await acceptInvite(invite); setDismissed(p => [...p, invite.id]); }}>
              ✓ 수락하기
            </button>
          </div>
        </div>
      ))}
      <style>{`
        @keyframes slideIn { from { opacity:0; transform:translateX(20px); } to { opacity:1; transform:translateX(0); } }
      `}</style>
    </div>
  );
}
