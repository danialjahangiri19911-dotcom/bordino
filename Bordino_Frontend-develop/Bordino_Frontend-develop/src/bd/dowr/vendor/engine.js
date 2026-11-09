(function(g){'use strict';
class Game{
 constructor(config,cards,random=Math.random){
  if(!Array.isArray(config.teams)||config.teams.length<2||config.teams.length>6)throw Error('۲ تا ۶ تیم انتخاب کنید.');
  if(!['classic','taboo'].includes(config.mode)||!Number.isInteger(config.seconds)||config.seconds<15||config.seconds>600||!Number.isInteger(config.rounds)||config.rounds<1||config.rounds>10)throw Error('تنظیمات بازی معتبر نیست.');
  if(!cards.length)throw Error('حداقل یک موضوع انتخاب کنید.');
  if(config.teams.some(t=>t.members&&t.members.length!==2))throw Error('هر تیم دقیقاً دو نفر دارد.');
  const bombEnabled=Boolean(config.bombEnabled),bombSeconds=config.bombSeconds??60,bombPenalty=config.bombPenalty??500;
  if(bombEnabled&&(!Number.isInteger(bombSeconds)||bombSeconds<10||bombSeconds>600||!Number.isInteger(bombPenalty)||bombPenalty<100||bombPenalty>5000))throw Error('زمان بمب باید ۱۰ تا ۶۰۰ ثانیه و جریمه ۱۰۰ تا ۵۰۰۰ امتیاز باشد.');
  const handoffSeconds=config.handoffSeconds??0;if(!Number.isInteger(handoffSeconds)||handoffSeconds<0||handoffSeconds>30)throw Error('زمان تحویل باید ۰ تا ۳۰ ثانیه باشد.');
  const n=config.teams.length;
  this.config={...config,handoffSeconds,bombEnabled,bombSeconds,bombPenalty,teams:config.teams.map((t,i)=>({name:String(t.name||'').trim().slice(0,24)||'تیم '+String.fromCharCode(65+i),members:(t.members||['','']).map((s,j)=>String(s).trim().slice(0,24)||'بازیکن '+String(j*n+i+1).replace(/\d/g,d=>'۰۱۲۳۴۵۶۷۸۹'[d]))}))};
  this.cards=cards.map(c=>({...c,forbidden:c.forbidden.slice()}));this.random=random;this.used=new Set();this.scores=this.config.teams.map(()=>0);this.correct=this.scores.slice();this.visits=this.scores.slice();this.history=[];this.round=1;this.notice='';this.bombRemaining=bombSeconds*1000;this.bombStarted=false;this.explosions=0;this.timeouts=0;this.blastVictim=null;this.lastActionAt=-Infinity;this.prepareRound();
 }
 prepareRound(){this.seat=0;this.turns=0;this.resetClock();this.phase='handoff';this.handoffMs=this.config.handoffSeconds*1000;this.current=null;this.log=[];this.last=null;this.resumePhase=null;}
 resetClock(){this.remaining=this.config.seconds*1000;}
 get mode(){return this.config.mode;}
 get team(){return this.seat%this.scores.length;}
 get member(){return Math.floor(this.seat/this.scores.length);}
 get player(){return this.config.teams[this.team].members[this.member];}
 get clock(){return this.remaining;}
 get clockRuns(){return this.phase==='playing';}
 get running(){return ['playing','handoff'].includes(this.phase);}
 get bombRuns(){return this.config.bombEnabled&&this.bombStarted&&['playing','handoff'].includes(this.phase);}
 get bombPulseInterval(){const ratio=Math.max(0,Math.min(1,this.bombRemaining/(this.config.bombSeconds*1000)));return 400+1000*Math.pow(ratio,.75);}
 draw(){let a=this.cards.filter(c=>!this.used.has(c.id));if(!a.length){this.used.clear();a=this.cards.filter(c=>this.cards.length===1||c.id!==this.lastCard);}this.current={...a[Math.floor(this.random()*a.length)]};this.lastCard=this.current.id;this.used.add(this.current.id);}
 ready(now){if(this.phase!=='handoff')return false;this.phase='playing';this.handoffMs=0;this.last=now;this.bombStarted=this.config.bombEnabled;this.draw();return true;}
 tick(now){
  if(!this.running)return;if(this.last===null){this.last=now;if(this.phase==='handoff'&&this.handoffMs===0)this.ready(now);return;}
  let delta=Math.max(0,now-this.last),cursor=this.last;this.last=now;
  // Resolve the earliest deadline first, so a late UI tick cannot charge the wrong team.
  while(delta>=0&&this.running){
   const phaseTime=this.phase==='handoff'?this.handoffMs:this.remaining;
   const bombTime=this.bombRuns?this.bombRemaining:Infinity;
   const spent=Math.min(delta,phaseTime,bombTime);
   if(this.bombRuns)this.bombRemaining=Math.max(0,this.bombRemaining-spent);
   if(this.phase==='handoff')this.handoffMs=Math.max(0,this.handoffMs-spent);else this.remaining=Math.max(0,this.remaining-spent);
   delta-=spent;cursor+=spent;
   if(this.bombRuns&&this.bombRemaining===0){this.explode(cursor);break;}
   if(this.phase==='handoff'&&this.handoffMs===0){this.ready(cursor);if(delta===0)break;continue;}
   if(this.phase==='playing'&&this.remaining===0){this.expire(cursor);if(this.phase==='finished'||delta===0)break;continue;}
   break;
  }
  this.last=now;
 }
 explode(now){if(!this.bombRuns||this.bombRemaining!==0)return false;this.record('bomb',-this.config.bombPenalty);this.scores[this.team]-=this.config.bombPenalty;this.explosions++;this.notice='بمب دستِ '+this.player+' ترکید؛ '+String(this.config.bombPenalty).replace(/\d/g,d=>'۰۱۲۳۴۵۶۷۸۹'[d])+' امتیاز از '+this.config.teams[this.team].name+' کم شد.';this.blastVictim={team:this.team,player:this.player};this.bombStarted=false;this.advance(now,'exploded');return true;}
 continueAfterExplosion(now){if(this.phase!=='exploded')return false;this.bombRemaining=this.config.bombSeconds*1000;this.phase='handoff';this.ready(now);this.notice='';return true;}
 continueAfterTimeout(now){if(this.phase!=='timedout')return false;this.phase='handoff';this.ready(now);this.notice='';return true;}
 pointsForCorrect(){return Math.min(1000,100+Math.floor(900*this.clock/(this.config.seconds*1000)));}
 record(kind,points=0){this.log.push({team:this.team,seat:this.seat,player:this.player,text:this.current?.text||'هنگام تحویل گوشی',kind,remaining:this.clock,bombRemaining:this.config.bombEnabled?this.bombRemaining:null,elapsedMs:this.config.seconds*1000-this.clock,points});}
 act(kind,now){if(!['correct','skip','foul'].includes(kind)||this.phase!=='playing'||now<=this.lastActionAt)return false;const seat=this.seat,round=this.round;this.tick(now);if(this.phase!=='playing'||this.seat!==seat||this.round!==round)return false;
  if(kind==='skip'&&!this.cards.some(c=>c.id!==this.current.id))return false;
  this.lastActionAt=now;
  if(kind==='skip'){this.record('skip',-100);this.scores[this.team]-=100;this.notice='لغت تعویض شد؛ ۱۰۰ امتیاز از '+this.config.teams[this.team].name+' کم شد.';this.draw();return true;}
  const points=kind==='correct'?this.pointsForCorrect():0;this.record(kind,points);
  if(kind==='correct'){this.correct[this.team]++;this.scores[this.team]+=points;this.notice=this.player+' درست گفت؛ '+String(points).replace(/\d/g,d=>'۰۱۲۳۴۵۶۷۸۹'[d])+' امتیاز برای '+this.config.teams[this.team].name;}
  else this.notice=(kind==='foul'?'پاسخ نامعتبر':'بدون پاسخ')+' از '+this.player+'؛ بدون امتیاز.';
  this.advance(now);return true;
 }
 expire(now){this.record('timeout');this.timeouts++;this.notice='زمان '+this.player+' تمام شد؛ بدون امتیاز.';this.advance(now,'timedout');}
 advance(now,manual=false){this.visits[this.team]++;this.turns++;this.current=null;if(this.turns===this.scores.length*2){this.endRound();if(this.round===this.config.rounds){this.phase='finished';return;}this.round++;this.prepareRound();}else{this.seat++;this.phase='handoff';this.handoffMs=this.config.handoffSeconds*1000;this.resetClock();}this.last=now;if(manual)this.phase=manual;else if(this.handoffMs===0)this.ready(now);}
 endRound(){this.history.push({round:this.round,scores:this.scores.slice(),log:this.log.map(x=>({...x}))});}
 pause(now){this.tick(now);if(!this.running)return false;this.resumePhase=this.phase;this.phase='paused';return true;}
 resume(now){if(this.phase!=='paused')return false;this.phase=this.resumePhase;this.last=now;return true;}
 ranking(){const rows=this.config.teams.map((t,i)=>({team:i,name:t.name,score:this.scores[i],correct:this.correct[i]})).sort((a,b)=>b.score-a.score||a.team-b.team);let rank=0;return rows.map((r,i)=>{if(!i||r.score!==rows[i-1].score)rank=i+1;return {...r,rank};});}
 result(){return JSON.parse(JSON.stringify({mode:this.mode,teams:this.config.teams,rounds:this.config.rounds,seconds:this.config.seconds,handoffSeconds:this.config.handoffSeconds,scoringVersion:5,swapPenalty:100,bomb:{enabled:this.config.bombEnabled,seconds:this.config.bombSeconds,penalty:this.config.bombPenalty,explosions:this.explosions},scores:this.scores,ranking:this.ranking(),history:this.history}));}
}
g.BordinoDowrEngine=Game;
})(typeof window==='undefined'?globalThis:window);
