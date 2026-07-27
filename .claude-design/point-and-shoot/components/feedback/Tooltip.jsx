import React from 'react';
export function Tooltip({label,children}){
const [show,setShow]=React.useState(false);
return React.createElement('span',{style:{position:'relative',display:'inline-flex'},onMouseEnter:()=>setShow(true),onMouseLeave:()=>setShow(false)},
children,
show&&React.createElement('span',{style:{position:'absolute',bottom:'calc(100% + 6px)',left:'50%',transform:'translateX(-50%)',background:'var(--bg-elevated)',border:'1px solid var(--border-default)',color:'var(--text-primary)',fontSize:'11px',fontFamily:'var(--font-mono)',padding:'4px 8px',borderRadius:'var(--radius-sm)',whiteSpace:'nowrap',boxShadow:'var(--shadow-md)',zIndex:10}},label));
}
