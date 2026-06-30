let _ctx = null
const ctx = () => {
  if (!_ctx) _ctx = new (window.AudioContext||window.webkitAudioContext)()
  if (_ctx.state==='suspended') _ctx.resume()
  return _ctx
}
const t = (f,d,type='square',v=0.09,delay=0) => {
  try {
    const c=ctx(),o=c.createOscillator(),g=c.createGain()
    o.type=type; o.frequency.setValueAtTime(f,c.currentTime+delay)
    g.gain.setValueAtTime(v,c.currentTime+delay)
    g.gain.exponentialRampToValueAtTime(0.001,c.currentTime+delay+d)
    o.connect(g);g.connect(c.destination);o.start(c.currentTime+delay);o.stop(c.currentTime+delay+d)
  } catch {}
}
const sw = (f1,f2,d,type='square',v=0.09,delay=0) => {
  try {
    const c=ctx(),o=c.createOscillator(),g=c.createGain()
    o.type=type
    o.frequency.setValueAtTime(f1,c.currentTime+delay)
    o.frequency.exponentialRampToValueAtTime(f2,c.currentTime+delay+d)
    g.gain.setValueAtTime(v,c.currentTime+delay)
    g.gain.exponentialRampToValueAtTime(0.001,c.currentTime+delay+d)
    o.connect(g);g.connect(c.destination);o.start(c.currentTime+delay);o.stop(c.currentTime+delay+d)
  } catch {}
}

export const Sonido = {
  click:       ()=>t(660,0.05,'square',0.06),
  hover:       ()=>t(880,0.03,'square',0.04),
  seleccionar: ()=>{t(523,0.08,'square',0.09);t(784,0.12,'square',0.09,0.08)},
  miTurno:     ()=>{t(523,0.09,'square',0.09,0);t(659,0.09,'square',0.09,0.09);t(784,0.18,'square',0.1,0.18)},
  esperando:   ()=>t(330,0.12,'triangle',0.05),
  timerTick:   (u)=>t(u?1046:740,0.05,'square',u?0.09:0.05),
  timeout:     ()=>sw(400,120,0.4,'sawtooth',0.09),
  votar:       ()=>{t(587,0.06,'square',0.07);t(880,0.08,'square',0.07,0.06)},
  listo:       ()=>[523,659,784,1047].forEach((f,i)=>t(f,0.12,'square',0.09,i*0.08)),
  draftInicia: ()=>{sw(200,900,0.5,'square',0.09);t(1047,0.25,'square',0.1,0.45)},
  finDraft:    ()=>[659,784,1047,1319].forEach((f,i)=>t(f,0.22,'square',0.09,i*0.13)),
  copiar:      ()=>{t(900,0.05,'sine',0.06);t(1200,0.08,'sine',0.06,0.05)},
  error:       ()=>t(180,0.18,'sawtooth',0.08),
  limpiar:     ()=>sw(600,200,0.3,'triangle',0.07),
  chat:        ()=>t(440,0.08,'sine',0.05),
  buzz:        ()=>{t(200,0.1,'sawtooth',0.12);t(150,0.1,'sawtooth',0.12,0.12);t(200,0.1,'sawtooth',0.12,0.24)},
  votoOtro:   ()=>{t(660,0.06,'square',0.07);t(660,0.06,'square',0.07,0.1)},
}

window.addEventListener('pointerdown',()=>{
  try{const c=new(window.AudioContext||window.webkitAudioContext)();c.resume()}catch{}
},{once:true})
