import React from 'react';
export function IconButton({icon,label,size=20,active,onClick}){
const [isHover,setHover]=React.useState(false);
const style={width:size+16,height:size+16,padding:0,display:'inline-flex',alignItems:'center',justifyContent:'center',flex:'0 0 auto',boxSizing:'border-box',borderRadius:'var(--radius-sm)',border:'1px solid '+(active?'var(--accent)':'transparent'),background:active?'var(--accent-subtle)':(isHover?'var(--bg-elevated)':'transparent'),color:active?'var(--accent)':'var(--text-secondary)',cursor:'pointer',transition:'background var(--duration-fast)'};
return React.createElement('button',{style,'aria-label':label,title:label,onClick,onMouseEnter:()=>setHover(true),onMouseLeave:()=>setHover(false)},icon);
}
