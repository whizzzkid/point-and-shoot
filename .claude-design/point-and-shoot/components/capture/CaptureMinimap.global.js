/* Plain-script twin of components/capture/CaptureMinimap.jsx, for pages that
   load _ds_bundle.js before a freshly-added component has been compiled into it.
   Kits use: const CaptureMinimap = DS.CaptureMinimap || window.PSCaptureMinimap; */
window.PSCaptureMinimap = function CaptureMinimap({width=72,height=54,region={x:.42,y:.3,w:.34,h:.16},label,onClick}){
const wrap={position:'relative',width,height,background:'var(--bg-inset)',border:'1px solid var(--border-default)',borderRadius:'var(--radius-md)',overflow:'hidden',flexShrink:0,cursor:onClick?'pointer':'default'};
const rows=[{t:.12,l:.08,w:.5,h:.07},{t:.3,l:.08,w:.28,h:.05},{t:.44,l:.08,w:.72,h:.05},{t:.58,l:.08,w:.6,h:.05},{t:.74,l:.08,w:.44,h:.05}];
return React.createElement('div',{style:wrap,onClick,title:label,'aria-label':label||'Captured region'},
rows.map((r,i)=>React.createElement('div',{key:i,style:{position:'absolute',top:r.t*100+'%',left:r.l*100+'%',width:r.w*100+'%',height:r.h*100+'%',background:'var(--border-default)',borderRadius:1,opacity:.75}})),
React.createElement('div',{style:{position:'absolute',left:region.x*100+'%',top:region.y*100+'%',width:region.w*100+'%',height:region.h*100+'%',border:'1.5px solid var(--accent)',background:'var(--accent-subtle)',borderRadius:2,boxShadow:'0 0 0 1px rgba(0,0,0,.25)'}})
);
};
