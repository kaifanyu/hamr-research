(() => {
  const data = window.HAMR_TRAJECTORIES;
  if (!data || !document.getElementById('trajectory-chart')) return;
  const colors = { ball: '#6f1d1b', swivel: '#99582a' };
  const duration = 71.4;
  const position = document.getElementById('trajectory-chart');
  const errors = document.getElementById('error-chart');
  const slider = document.getElementById('trajectory-time');
  const output = document.getElementById('trajectory-time-label');
  const play = document.getElementById('trajectory-play');
  let mode = 'both';
  let running = false;
  let last = 0;
  let animation;
  const line = (x1,y1,x2,y2,c='grid-line') => `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" class="${c}"/>`;
  const label = (x,y,s,anchor='middle') => `<text x="${x}" y="${y}" text-anchor="${anchor}">${s}</text>`;
  const px = x => 89 + (x + 2.7) / 5.4 * 350;
  const py = y => 375 - (y + 2.7) / 5.4 * 350;
  const ex = t => 54 + t / duration * 452;
  const ey = e => 245 - e / .07 * 210;
  const path = (points,x,y) => points.map((p,i) => `${i ? 'L' : 'M'}${x(p).toFixed(2)},${y(p).toFixed(2)}`).join(' ');
  const draw = () => {
    const time = Number(slider.value);
    let pos = '';
    for (let v=-2; v<=2; v++) {
      pos += line(px(v),25,px(v),375)+line(89,py(v),439,py(v))+label(px(v),397,v)+label(71,py(v)+4,v,'end');
    }
    pos += label(264,424,'World X (m)')+`<text transform="translate(17 200) rotate(-90)" text-anchor="middle">World Y (m)</text>`;
    pos += `<path d="${path([[-2.2,-2.2],[2.2,-2.2],[2.2,2.2],[-2.2,2.2],[-2.2,-2.2]],p=>px(p[0]),p=>py(p[1]))}" fill="none" stroke="#795b45" stroke-width="1.8" stroke-dasharray="2 5"/>`;
    let err = '';
    for (let t=0;t<=70;t+=10) err += line(ex(t),35,ex(t),245)+label(ex(t),268,t);
    for (let mm=0;mm<=60;mm+=20) err += line(54,ey(mm/1000),506,ey(mm/1000))+label(43,ey(mm/1000)+4,mm,'end');
    err += label(280,294,'Trajectory time (s)')+`<text transform="translate(13 140) rotate(-90)" text-anchor="middle">Position error (mm)</text>`;
    for (const k of ['swivel','ball']) {
      if (mode !== 'both' && mode !== k) continue;
      const samples = data[k].samples.filter(p => p[0] <= time);
      if (!samples.length) continue;
      const current = samples[samples.length-1];
      pos += `<path d="${path(samples,p=>px(p[1]),p=>py(p[2]))}" fill="none" stroke="${colors[k]}" stroke-dasharray="${k === 'swivel' ? '8 4' : 'none'}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/><circle cx="${px(current[1])}" cy="${py(current[2])}" r="4.4" fill="${colors[k]}" stroke="#fffefa" stroke-width="1.5"/>`;
      err += `<path d="${path(samples,p=>ex(p[0]),p=>ey(p[5]))}" fill="none" stroke="${colors[k]}" stroke-dasharray="${k === 'swivel' ? '8 4' : 'none'}" stroke-width="1.7" stroke-linejoin="round"/>`;
    }
    err += `<line x1="${ex(time)}" y1="35" x2="${ex(time)}" y2="245" stroke="#bb9457" stroke-width="1" stroke-dasharray="3 4"/>`;
    position.innerHTML = pos;
    errors.innerHTML = err;
    output.value = `${time.toFixed(1)} / ${duration.toFixed(1)} s`;
  };
  const stop = () => { running=false;cancelAnimationFrame(animation);play.textContent='Play history'; };
  const tick = now => {
    if (!running) return;
    if (last) slider.value = Math.min(duration, Number(slider.value) + (now-last)/1000*4);
    last=now;draw();
    if (Number(slider.value) >= duration) stop(); else animation=requestAnimationFrame(tick);
  };
  document.querySelectorAll('[data-trajectory]').forEach(button => button.addEventListener('click', () => {
    mode=button.dataset.trajectory;
    document.querySelectorAll('[data-trajectory]').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));
    draw();
  }));
  slider.addEventListener('input', () => {stop();draw();});
  play.addEventListener('click', () => {
    if (running) {stop();return;}
    if (Number(slider.value)>=duration) slider.value=0;
    running=true;last=0;play.textContent='Pause history';animation=requestAnimationFrame(tick);
  });
  document.addEventListener('visibilitychange', () => {if(document.hidden)stop();});
  const casterVideo = document.getElementById('caster-replay');
  const casterCaption = document.getElementById('caster-replay-caption');
  document.querySelectorAll('[data-caster-replay]').forEach(button => button.addEventListener('click', () => {
    document.querySelectorAll('[data-caster-replay]').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));
    const ball = button.dataset.casterReplay==='ball';
    casterVideo.pause();
    casterVideo.src = ball ? 'assets/caster-encoder-replay.mp4' : 'assets/swivel-closeup.mp4';
    casterVideo.poster = ball ? 'assets/caster-encoder-replay.png' : 'assets/swivel-closeup.png';
    casterVideo.setAttribute('aria-label',ball ? 'Recorded encoder motion replayed on a caster CAD model' : 'Passive wheelchair caster motion in Gazebo simulation');
    casterCaption.textContent = ball ? 'Recorded H1, H2, and CENTER signals replayed on the caster model. CAD signs and zero offsets are illustrative; this is not a calibrated orientation reconstruction.' : 'Passive wheelchair caster roll and swivel during a Gazebo trajectory. This simulation close-up is a placeholder for the synchronized measured-motion replay.';
    casterVideo.load();
  }));
  draw();
})();
