
// server.js - full backend
const express=require('express');
const http=require('http');
const WebSocket=require('ws');
const app=express();
const server=http.createServer(app);
const wss=new WebSocket.Server({server});
let gameState={teams:[],roundHistory:[],shock:'none'};
function broadcast(d){const s=JSON.stringify(d);wss.clients.forEach(c=>{if(c.readyState===WebSocket.OPEN)c.send(s);});}
wss.on('connection',ws=>{ws.send(JSON.stringify({type:'init',state:gameState}));ws.on('message',m=>{let d=JSON.parse(m);switch(d.type){case 'join':gameState.teams.push(d.team);broadcast({type:'teamUpdate',teams:gameState.teams});break;case 'updateTeam':gameState.teams[d.index]={...gameState.teams[d.index],...d.update};broadcast({type:'teamUpdate',teams:gameState.teams});break;case 'applyShock':gameState.shock=d.shock;broadcast({type:'shockUpdate',shock:d.shock});break;case 'resolveRound':resolveRound();break;}});});
function resolveRound(){let demand=200,mc=4;const S={cost_increase:()=>mc=6,demand_boom:()=>demand=240,recession:()=>demand=160,ad_ban:()=>null};if(S[gameState.shock])S[gameState.shock]();let avg=gameState.teams.reduce((s,t)=>s+Number(t.price||0),0)/gameState.teams.length;let total=demand-5*avg;let per=Math.max(0,Math.round(total/gameState.teams.length));let updated=gameState.teams.map(t=>{let cc=t.capacity==='Low'?0:t.capacity==='Med'?20:40;let p=Number(t.price)||0;let m=t.marketing?.rnd?mc-1:mc;let u=per;let prof=(p-m)*u-cc;return {...t,units:u,profit:prof};});gameState.teams=updated;gameState.roundHistory.push(updated);broadcast({type:'roundResolved',teams:updated,history:gameState.roundHistory});}
app.get('/',(req,res)=>res.send('Server running'));
const PORT=process.env.PORT||8080;server.listen(PORT,()=>console.log('Running',PORT));
