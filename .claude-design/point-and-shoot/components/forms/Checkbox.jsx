import React from 'react';
export function Checkbox({checked,onChange,label}){
const boxStyle={width:16,height:16,borderRadius:'3px',border:'1px solid '+(checked?'var(--accent)':'var(--border-strong)'),background:checked?'var(--accent)':'transparent',display:'inline-flex',alignItems:'center',justifyContent:'center',flexShrink:0};
return React.createElement('label',{style:{display:'inline-flex',alignItems:'center',gap:'8px',cursor:'pointer',fontFamily:'var(--font-body)',fontSize:'13px',color:'var(--text-primary)'}},
React.createElement('span',{style:boxStyle,onClick:()=>onChange&&onChange(!checked)},checked?React.createElement('svg',{width:10,height:8,viewBox:'0 0 10 8',fill:'none'},React.createElement('path',{d:'M1 4L3.5 6.5L9 1',stroke:'#fff',strokeWidth:1.6,strokeLinecap:'round',strokeLinejoin:'round'})):null),
label);
}
