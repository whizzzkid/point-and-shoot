import React from 'react';
export function Button({variant='primary',size='md',icon,children,disabled,onClick}){
const pad={sm:'6px 10px',md:'9px 14px',lg:'11px 18px'}[size];
const fs={sm:'12px',md:'13px',lg:'14px'}[size];
const base={fontFamily:'var(--font-body)',fontWeight:600,fontSize:fs,padding:pad,borderRadius:'var(--radius-sm)',border:'1px solid transparent',cursor:disabled?'not-allowed':'pointer',display:'inline-flex',alignItems:'center',gap:'6px',lineHeight:1,transition:'background var(--duration-fast) var(--ease-standard),border-color var(--duration-fast)',opacity:disabled?.5:1};
const variants={
primary:{background:'var(--accent)',color:'var(--accent-contrast)'},
secondary:{background:'var(--bg-elevated)',color:'var(--text-primary)',borderColor:'var(--border-default)'},
ghost:{background:'transparent',color:'var(--text-secondary)'},
danger:{background:'var(--danger)',color:'#1f0505'},
};
const hover={
primary:{background:'var(--accent-hover)'},
secondary:{background:'var(--bg-surface-raised)',borderColor:'var(--border-strong)'},
ghost:{background:'var(--bg-elevated)',color:'var(--text-primary)'},
danger:{background:'#ff7a7a'},
};
const [isHover,setHover]=React.useState(false);
const style={...base,...variants[variant],...(isHover&&!disabled?hover[variant]:{})};
return React.createElement('button',{style,disabled,onClick,onMouseEnter:()=>setHover(true),onMouseLeave:()=>setHover(false)},icon,children);
}
