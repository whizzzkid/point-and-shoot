import React from 'react';
export function Switch({checked,onChange}){
return React.createElement('button',{onClick:()=>onChange&&onChange(!checked),style:{width:34,height:20,borderRadius:'var(--radius-full)',border:'1px solid var(--border-default)',background:checked?'var(--accent)':'var(--bg-elevated)',position:'relative',cursor:'pointer',padding:0,transition:'background var(--duration-fast)'}},
React.createElement('span',{style:{position:'absolute',top:1,left:checked?15:1,width:16,height:16,borderRadius:'50%',background:'#fff',transition:'left var(--duration-fast) var(--ease-standard)'}}));
}
