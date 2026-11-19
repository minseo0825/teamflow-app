import React from 'react';
import { useApp } from '../context/AppContext';

const icons = {
  s: <svg width="14" height="14" fill="none" stroke="var(--green)" strokeWidth="2.2" strokeLinecap="round" viewBox="0 0 14 14"><path d="M2 7l3 3 7-6"/></svg>,
  e: <svg width="14" height="14" fill="none" stroke="var(--red)" strokeWidth="2.2" strokeLinecap="round" viewBox="0 0 14 14"><path d="M3 3l8 8M11 3l-8 8"/></svg>,
  i: <svg width="14" height="14" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" viewBox="0 0 14 14"><circle cx="7" cy="7" r="5"/><path d="M7 5v4M7 4h.01"/></svg>,
};

export default function Toast() {
  const { toasts } = useApp();
  if (!toasts.length) return null;
  return (
    <div className="toast-wrap">
      {toasts.map(t => (
        <div key={t.id} className={`toast t${t.type}`}>
          {icons[t.type]}
          <span>{t.msg}</span>
        </div>
      ))}
    </div>
  );
}
