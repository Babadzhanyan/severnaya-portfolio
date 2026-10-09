export async function waitPrintReady(root,timeoutMs=5000){
 const start=Date.now(),urls=new Set(),issues=[];
 let timer;const timeout=new Promise(resolve=>{timer=setTimeout(()=>resolve({ready:false,issues:['Иллюстрации или шрифты ожидают загрузки']}),timeoutMs);});
 const work=(async()=>{
  await document.fonts?.ready;
  // Печатный экземпляр получает общий реестр изображений после первого кадра
  if(window.PMO_RUNTIME?.productionAi&&root.querySelector('.value-chain')){while(!root.querySelector('img')&&Date.now()-start<Math.min(1200,timeoutMs)){await new Promise(r=>requestAnimationFrame(r));}}
  await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
  for(const element of root.querySelectorAll('img,image')){const src=element.tagName.toLowerCase()==='image'?element.getAttribute('href'):element.currentSrc||element.src;if(src)urls.add(src);}
  await Promise.all([...urls].map(src=>new Promise(resolve=>{const image=new Image();const finish=good=>{if(!good)issues.push(src);image.onload=null;image.onerror=null;resolve();};image.onload=()=>finish(true);image.onerror=()=>finish(false);image.src=src;if(image.complete)finish(image.naturalWidth>0);})));
  return {ready:issues.length===0,issues,images:urls.size};
 })();
 const result=await Promise.race([work,timeout]);clearTimeout(timer);return result;
}
