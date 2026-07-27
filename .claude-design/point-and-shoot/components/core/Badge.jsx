import React from 'react';
export function Badge({children,tone='neutral'}){
const tones={
neutral:{background:'var(--bg-elevated)',color:'var(--text-secondary)',border:'1px solid var(--border-default)'},
accent:{background:'var(--accent-subtle)',color:'var(--accent-text)',border:'1px solid transparent'},
success:{background:'rgba(61,220,151,.12)',color:'var(--success)',border:'1px solid transparent'},
warning:{background:'rgba(245,181,68,.12)',color:'var(--warning)',border:'1px solid transparent'},
danger:{background:'rgba(255,92,92,.12)',color:'var(--danger)',border:'1px solid transparent'},
};
return React.createElement('span',{style:{...tones[tone],fontFamily:'var(--font-mono)',fontSize:'11px',fontWeight:500,padding:'2px 8px',borderRadius:'var(--radius-full)',display:'inline-flex',alignItems:'center',gap:'4px',letterSpacing:'var(--tracking-wide)'}},children);
}
export function Tag({children,onRemove}){
return React.createElement('span',{style:{background:'var(--bg-elevated)',border:'1px solid var(--border-default)',color:'var(--text-primary)',fontSize:'12px',padding:'3px 6px 3px 9px',borderRadius:'var(--radius-sm)',display:'inline-flex',alignItems:'center',gap:'6px'}},children,onRemove&&React.createElement('span',{onClick:onRemove,style:{cursor:'pointer',color:'var(--text-tertiary)'}},'×'));
}
