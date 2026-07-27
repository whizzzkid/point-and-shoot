import React from 'react';
export function Card({children,padding='16px',raised,style}){
return React.createElement('div',{style:{background:raised?'var(--bg-surface-raised)':'var(--bg-surface)',border:'1px solid var(--border-subtle)',borderRadius:'var(--radius-lg)',padding,boxShadow:raised?'var(--shadow-md)':'none',...style}},children);
}
