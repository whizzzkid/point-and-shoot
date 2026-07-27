import React from 'react';
export function Toast({tone='neutral',children,onClose}){
const colors={neutral:'var(--border-default)',success:'var(--success)',danger:'var(--danger)'};
return React.createElement('div',{style:{display:'flex',alignItems:'center',gap:'10px',background:'var(--bg-elevated)',border:'1px solid '+colors[tone],borderRadius:'var(--radius-md)',padding:'10px 14px',boxShadow:'var(--shadow-lg)',fontSize:'13px',color:'var(--text-primary)',fontFamily:'var(--font-body)'}},
React.createElement('span',{style:{width:6,height:6,borderRadius:'50%',background:colors[tone],flexShrink:0}}),
React.createElement('span',{style:{flex:1}},children),
onClose&&React.createElement('span',{onClick:onClose,style:{cursor:'pointer',color:'var(--text-tertiary)'}},'×'));
}
