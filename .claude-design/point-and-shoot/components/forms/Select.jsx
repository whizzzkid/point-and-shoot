import React from 'react';
export function Select({options,value,onChange}){
const style={width:'100%',boxSizing:'border-box',background:'var(--bg-inset)',border:'1px solid var(--border-default)',borderRadius:'var(--radius-lg)',padding:'9px 32px 9px 12px',color:'var(--text-primary)',fontFamily:'var(--font-body)',fontSize:'13px',lineHeight:1.5,outline:'none',appearance:'none',backgroundImage:'linear-gradient(45deg,transparent 50%,var(--text-tertiary) 50%),linear-gradient(135deg,var(--text-tertiary) 50%,transparent 50%)',backgroundPosition:'calc(100% - 17px) 51%,calc(100% - 12px) 51%',backgroundSize:'5px 5px,5px 5px',backgroundRepeat:'no-repeat'};
return React.createElement('select',{style,value,onChange:e=>onChange&&onChange(e.target.value)},options.map(o=>React.createElement('option',{key:o.value||o,value:o.value||o},o.label||o)));
}
