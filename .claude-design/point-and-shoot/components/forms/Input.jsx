import React from 'react';
export function Input({placeholder,value,onChange,mono,multiline,rows=4}){
const style={width:'100%',boxSizing:'border-box',background:'var(--bg-inset)',border:'1px solid var(--border-default)',borderRadius:'var(--radius-lg)',padding:multiline?'11px 12px':'9px 12px',minHeight:multiline?96:undefined,color:'var(--text-primary)',fontFamily:mono?'var(--font-mono)':'var(--font-body)',fontSize:'13px',lineHeight:1.5,outline:'none',transition:'border-color var(--duration-fast),box-shadow var(--duration-fast)',resize:multiline?'vertical':'none'};
const [focused,setFocused]=React.useState(false);
const merged={...style,...(focused?{borderColor:'var(--accent)',boxShadow:'var(--shadow-focus)'}:{})};
const Tag=multiline?'textarea':'input';
return React.createElement(Tag,{style:merged,placeholder,value,rows:multiline?rows:undefined,onChange:e=>onChange&&onChange(e.target.value),onFocus:()=>setFocused(true),onBlur:()=>setFocused(false)});
}
