import React from 'react';
export function Icon({name,size=18,color,strokeWidth=1.75}){
const ref=React.useRef(null);
React.useEffect(()=>{
if(!window.lucide||!ref.current)return;
ref.current.innerHTML='';
const i=document.createElement('i');
i.setAttribute('data-lucide',name);
ref.current.appendChild(i);
window.lucide.createIcons({nameAttr:'data-lucide',icons:window.lucide.icons});
const svg=ref.current.querySelector('svg');
if(svg){svg.setAttribute('width',size);svg.setAttribute('height',size);svg.setAttribute('stroke-width',strokeWidth);svg.style.display='block';}
},[name,size,strokeWidth]);
return React.createElement('span',{ref,style:{width:size,height:size,flex:'0 0 auto',display:'inline-flex',alignItems:'center',justifyContent:'center',lineHeight:0,color:color||'currentColor'}});
}
