/* Scroll position is the only animation clock. No autonomous RAF loop, timers,
   inertia or trailing interpolation. Geometry comes from the approved studio. */
(() => {
  const defaults = {thickness:28,lengthMultiplier:12,speedMultiplier:.22,guideOpacity:.4,fullWidthFraction:.6,streakGap:1860};
  const limits = {thickness:[4,60],lengthMultiplier:[2,20],speedMultiplier:[0,2],guideOpacity:[.05,1],fullWidthFraction:[.1,.9],streakGap:[0,4000]};
  const storageKey='chamber-launch-motion-v2';
  const settings={...defaults};
  try {const saved=JSON.parse(localStorage.getItem(storageKey));for(const key in defaults){if(Number.isFinite(saved?.[key]))settings[key]=Math.max(limits[key][0],Math.min(limits[key][1],saved[key]));}} catch {}
  let period = 260 * settings.lengthMultiplier + settings.streakGap;
  let loopPixels = settings.speedMultiplier ? 7200 / settings.speedMultiplier : Infinity;
  let phaseOffset=0;
  const frequencies = [17,19,23,21,19,17];
  const routes = signatureData.routes.map((r,i) => {
    const nums=r.d.match(/-?\d+(?:\.\d+)?/g).map(Number);
    let x=nums[0],y=nums[1],total=0;const points=[{x,y,s:0}];
    for(let k=2;k<nums.length;k+=6){const [ax,ay,bx,by,cx,cy]=nums.slice(k,k+6);
      for(let j=1;j<=160;j++){const t=j/160,u=1-t,px=u*u*u*x+3*u*u*t*ax+3*u*t*t*bx+t*t*t*cx,py=u*u*u*y+3*u*u*t*ay+3*u*t*t*by+t*t*t*cy,prev=points.at(-1);total+=Math.hypot(px-prev.x,py-prev.y);points.push({x:px,y:py,s:total});}x=cx;y=cy;
    }
    // Integer windings give all six paths one exact common scroll period.
    const cycles=Math.round((total+260)*frequencies[i]*40/12/period);
    return {...r,total,points,path:new Path2D(r.d),cycles,phase:i*.173+.35};
  });
  function at(r,s){s=Math.max(0,Math.min(r.total,s));let lo=0,hi=r.points.length-1;while(hi-lo>1){const m=(lo+hi)>>1;if(r.points[m].s<s)lo=m;else hi=m;}const a=r.points[lo],b=r.points[hi],t=(s-a.s)/(b.s-a.s||1);return {x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t};}
  function profile(t){const tail=(1-settings.fullWidthFraction)*.8,head=(1-settings.fullWidthFraction)*.2;return {width:Math.min(1,Math.pow(t/tail,.7),(1-t)/head),alpha:Math.min(1,Math.pow(t/tail,.6),(1-t)/(head*.55))};}
  const fields=Array.from(document.querySelectorAll('canvas.signature')).map(canvas=>({canvas,ctx:canvas.getContext('2d'),layer:document.createElement('canvas'),dark:canvas.dataset.tone==='dark'}));
  const reduced=matchMedia('(prefers-reduced-motion: reduce)');
  let paused=false,queued=false,lastY=scrollY,heldY=scrollY,drawCount=0;
  const photos=Array.from(document.querySelectorAll('[data-parallax]'));
  const button=document.querySelector('.motion-toggle');
  function drawField(field,y){const {canvas,ctx,layer,dark}=field;const rect=canvas.getBoundingClientRect();if(rect.bottom<0||rect.top>innerHeight)return;
    const dpr=Math.min(devicePixelRatio||1,1.5),w=Math.round(rect.width*dpr),h=Math.round(rect.height*dpr);
    if(canvas.width!==w||canvas.height!==h){canvas.width=layer.width=w;canvas.height=layer.height=h;}
    const lc=layer.getContext('2d');
    // Uniform scale preserves circles. Narrow screens show a cropped field,
    // with a deliberately quiet center behind the reading column.
    const scale=Math.max(w/signatureData.width,h/signatureData.height),dx=(w-signatureData.width*scale)/2,dy=(h-signatureData.height*scale)/2;
    ctx.setTransform(1,0,0,1,0,0);ctx.clearRect(0,0,w,h);ctx.setTransform(scale,0,0,scale,dx,dy);
    const trail=260*settings.lengthMultiplier,samples=96*settings.lengthMultiplier;
    for(let i=0;i<routes.length;i++){const r=routes[i],color=dark?'#f0e7d6':r.color;ctx.strokeStyle=color;ctx.lineWidth=Math.max(1.2,dpr/scale);ctx.globalAlpha=dark?.08:settings.guideOpacity;ctx.stroke(r.path);
      lc.setTransform(1,0,0,1,0,0);lc.clearRect(0,0,w,h);lc.setTransform(scale,0,0,scale,dx,dy);lc.strokeStyle=color;lc.lineCap='round';
      const distance=((y*settings.speedMultiplier+phaseOffset)/7200*r.cycles+r.phase)*period,head=((distance%period)+period)%period;
      for(let lap=0;lap<=Math.ceil((r.total+trail)/period);lap++){const start=head+lap*period-trail,first=Math.max(0,Math.floor(-start/trail*samples)),end=Math.min(samples,Math.ceil((r.total-start)/trail*samples));
        for(let j=first;j<end;j++){const t0=j/samples,t1=(j+1)/samples,t=(t0+t1)/2,a=start+t0*trail,b=start+t1*trail,p=at(r,r.direction===1?a:r.total-a),q=at(r,r.direction===1?b:r.total-b),e=profile(t);lc.lineWidth=settings.thickness*e.width;lc.globalAlpha=e.alpha;lc.beginPath();lc.moveTo(p.x,p.y);lc.lineTo(q.x,q.y);lc.stroke();}}
      ctx.save();ctx.setTransform(1,0,0,1,0,0);ctx.globalAlpha=dark?.10:.90;ctx.drawImage(layer,0,0);ctx.restore();
    }
    ctx.globalAlpha=1;for(const n of signatureData.nodes){ctx.fillStyle=dark?'#2D432B':signatureData.background;ctx.beginPath();ctx.arc(n.cx,n.cy,n.outerR,0,Math.PI*2);ctx.fill();ctx.fillStyle=dark?'#42543d':signatureData.gold;ctx.beginPath();ctx.arc(n.cx,n.cy,n.r,0,Math.PI*2);ctx.fill();}
    canvas.dataset.position=y.toFixed(4);canvas.dataset.drawCount=String(++drawCount);
  }
  function paint(){queued=false;const frozen=paused||reduced.matches,y=frozen?heldY:scrollY;fields.forEach(f=>drawField(f,y));photos.forEach(photo=>{const box=photo.parentElement.getBoundingClientRect();const shift=frozen?0:Math.max(-38,Math.min(38,(innerHeight/2-box.top-box.height/2)*Number(photo.dataset.parallax)));photo.style.transform=`translateY(${shift}px)`;});document.documentElement.dataset.motion=frozen?'paused':'scroll';}
  function schedule(){if(!queued){queued=true;requestAnimationFrame(paint);}}
  addEventListener('scroll',()=>{if(scrollY===lastY)return;lastY=scrollY;schedule();},{passive:true});addEventListener('resize',schedule);
  function togglePause(){paused=!paused;if(paused)heldY=scrollY;button.setAttribute('aria-pressed',String(paused));button.innerHTML=paused?'Resume motion <span aria-hidden="true">▷</span>':'Pause motion <span aria-hidden="true">Ⅱ</span>';const control=document.getElementById('panel-pause');if(control){control.textContent=paused?'Resume motion':'Pause motion';control.setAttribute('aria-pressed',String(paused));}schedule();}
  button.addEventListener('click',togglePause);
  function preference(){heldY=0;button.hidden=reduced.matches;schedule();}reduced.addEventListener('change',preference);preference();
  const regions={north:{context:'Selected regional leaders from the Chamber’s public board directory.',rows:[['Los Angeles','Ian Rassman','Regional Chair'],['San Diego','Vanessa Fleur','Regional Chair'],['Canada','Alex Revich','Regional Chair']]},europe:{context:'European leadership and activity listed by the Chamber.',rows:[['Germany','Pasquale Modica-Amore','Regional Chair'],['Greater Europe','October 7, 2026','Virtual chapter call']]},latin:{context:'Regional leadership listed in the Chamber’s public board directory.',rows:[['Latin America','Mariana Larrea','LATAM Regional Chair']]},africa:{context:'A founding chapter event appears in the Chamber’s current calendar.',rows:[['Kampala, Uganda','October 15, 2026','Uganda Chapter Founding Mixer']]}};
  const tabs=Array.from(document.querySelectorAll('[role="tab"]')),panel=document.getElementById('chapter-panel');
  function select(tab){tabs.forEach(t=>{t.setAttribute('aria-selected',String(t===tab));t.tabIndex=t===tab?0:-1;});const region=regions[tab.dataset.region];panel.setAttribute('aria-labelledby',tab.id);panel.querySelector('.chapter-context').textContent=region.context;document.getElementById('chapter-rows').replaceChildren(...region.rows.map(([place,name,role])=>{const row=document.createElement('div');row.className='chapter-row';const h=document.createElement('h3');h.textContent=place;const p=document.createElement('p');p.append(document.createTextNode(name));const span=document.createElement('span');span.textContent=role;p.append(span);row.append(h,p);return row;}));schedule();}
  tabs.forEach((tab,i)=>{tab.addEventListener('click',()=>select(tab));tab.addEventListener('keydown',e=>{let next;if(['ArrowRight','ArrowDown'].includes(e.key))next=(i+1)%tabs.length;if(['ArrowLeft','ArrowUp'].includes(e.key))next=(i+tabs.length-1)%tabs.length;if(e.key==='Home')next=0;if(e.key==='End')next=tabs.length-1;if(next!==undefined){e.preventDefault();select(tabs[next]);tabs[next].focus();}});});

  const controls=document.querySelector('.motion-panel');
  function syncControls(){
    period=260*settings.lengthMultiplier+settings.streakGap;
    loopPixels=settings.speedMultiplier?7200/settings.speedMultiplier:Infinity;
    routes.forEach((r,i)=>{r.cycles=Math.max(1,Math.round((r.total+260)*frequencies[i]*40/12/period));});
    document.documentElement.dataset.scrollLoop=String(loopPixels);
    document.documentElement.dataset.routeCycles=routes.map(r=>r.cycles).join(',');
    if(controls){controls.querySelectorAll('[data-setting]').forEach(input=>{const key=input.dataset.setting;input.value=settings[key];controls.querySelector(`[data-value="${key}"]`).textContent=key==='speedMultiplier'?settings[key].toFixed(2)+'×':key==='guideOpacity'||key==='fullWidthFraction'?Math.round(settings[key]*100)+'%':String(settings[key]);});}
  }
  function saveControls(){try{localStorage.setItem(storageKey,JSON.stringify(settings));}catch{}syncControls();schedule();}
  if(controls){
    controls.querySelectorAll('[data-setting]').forEach(input=>input.addEventListener('input',()=>{
      const key=input.dataset.setting,value=Number(input.value);if(!Number.isFinite(value))return;
      const next=Math.max(limits[key][0],Math.min(limits[key][1],value));
      if(key==='speedMultiplier'){const y=paused||reduced.matches?heldY:scrollY;phaseOffset+=y*(settings.speedMultiplier-next);}
      settings[key]=next;saveControls();
    }));
    document.getElementById('panel-pause').addEventListener('click',togglePause);
    document.getElementById('motion-reset').addEventListener('click',()=>{phaseOffset+=(paused||reduced.matches?heldY:scrollY)*(settings.speedMultiplier-defaults.speedMultiplier);Object.assign(settings,defaults);saveControls();});
    document.getElementById('motion-export').addEventListener('click',()=>{const url=URL.createObjectURL(new Blob([JSON.stringify(settings,null,2)+'\n'],{type:'application/json'}));const link=document.createElement('a');link.href=url;link.download='chamber-launch-motion-settings.json';link.click();URL.revokeObjectURL(url);});
  }
  syncControls();
  // Read-only diagnostics make scroll/rest and common-period QA inspectable.
  document.documentElement.dataset.scrollLoop=String(loopPixels);
  document.documentElement.dataset.routeCycles=routes.map(r=>r.cycles).join(',');
})();
