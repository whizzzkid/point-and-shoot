import React from 'react';
export function Tabs({tabs,active,onChange}){
return React.createElement('div',{style:{display:'flex',gap:'2px',borderBottom:'1px solid var(--border-subtle)'}},
tabs.map(t=>React.createElement('button',{key:t,onClick:()=>onChange&&onChange(t),style:{background:'none',border:'none',padding:'8px 12px',fontSize:'13px',fontFamily:'var(--font-body)',color:t===active?'var(--text-primary)':'var(--text-tertiary)',borderBottom:'2px solid '+(t===active?'var(--accent)':'transparent'),cursor:'pointer',marginBottom:'-1px'}},t)));
}
