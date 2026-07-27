import React from 'react';
export function Dialog({open,title,children,onClose,footer}){
if(!open)return null;
return React.createElement('div',{style:{position:'fixed',inset:0,background:'var(--scrim)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:100}},
React.createElement('div',{style:{width:420,background:'var(--bg-surface-raised)',border:'1px solid var(--border-default)',borderRadius:'var(--radius-lg)',boxShadow:'var(--shadow-lg)',padding:'20px'}},
React.createElement('div',{style:{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'14px'}},
React.createElement('h3',{style:{fontSize:'16px',color:'var(--text-primary)'}},title),
React.createElement('span',{onClick:onClose,style:{cursor:'pointer',color:'var(--text-tertiary)',fontSize:'18px'}},'×')),
React.createElement('div',{style:{color:'var(--text-secondary)',fontSize:'13px'}},children),
footer&&React.createElement('div',{style:{display:'flex',justifyContent:'flex-end',gap:'8px',marginTop:'18px'}},footer)));
}
