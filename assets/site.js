(() => {
 const tabs = document.querySelectorAll('[data-slam-tab]');
 tabs.forEach((button, index) => {
  button.addEventListener('click', () => {
   tabs.forEach(t => {const active=t===button;t.setAttribute('aria-selected',String(active));t.tabIndex=active?0:-1;});
   document.querySelectorAll('[data-slam-panel]').forEach(p => p.hidden=p.dataset.slamPanel!==button.dataset.slamTab);
   const caption=document.querySelector('#slam-caption');
   if(caption) caption.textContent=button.dataset.caption;
  });
  button.addEventListener('keydown', e => {
   if(e.key==='ArrowLeft'||e.key==='ArrowRight'){e.preventDefault();const target=tabs[(index+(e.key==='ArrowRight'?1:tabs.length-1))%tabs.length];target.click();target.focus();}
  });
 });
})();
