import { initializeApp } from "https://www.gstatic.com/firebasejs/12.17.1/firebase-app.js";
import { getAuth, signInAnonymously, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.17.1/firebase-auth.js";
import {
  getDatabase, ref, onValue, runTransaction, set, update
} from "https://www.gstatic.com/firebasejs/12.17.1/firebase-database.js";

const firebaseConfig = {
  apiKey: "AIzaSyD96cW2L2HMctfvG5ykBThY4NIv0OnuAvg",
  authDomain: "cricket-live-auction-75e14.firebaseapp.com",
  projectId: "cricket-live-auction-75e14",
  storageBucket: "cricket-live-auction-75e14.firebasestorage.app",
  messagingSenderId: "1031234623393",
  appId: "1:1031234623393:web:80e83ed10486322c7e5de0"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getDatabase(app);

const $ = id => document.getElementById(id);
const params = new URLSearchParams(location.search);
const defaultRoom = (params.get("room") || localStorage.getItem("auctionRoom") || "auction1").replace(/[^a-zA-Z0-9_-]/g,"").slice(0,24) || "auction1";

let user = null, state = null, stopRoom = null;
let session = JSON.parse(localStorage.getItem("auctionSession") || "null");

const defaultPlayers = Array.from({length:24},(_,i)=>({
  id:`P${String(i+1).padStart(2,"0")}`,
  name:`Player ${i+1}`,
  base:500,
  status:"available",
  soldTeam:"",
  soldPrice:0
}));

const defaultState = () => ({
  version:1,
  status:"waiting",
  currentIndex:0,
  currentBid:0,
  highestTeam:"",
  bidHistory:[],
  players:defaultPlayers,
  teams:{
    "Team A":{purse:10000, roster:[]},
    "Team B":{purse:10000, roster:[]},
    "Team C":{purse:10000, roster:[]}
  },
  activity:[{t:Date.now(),text:"Auction room created."}]
});

function money(n){return "₹"+Number(n||0).toLocaleString("en-IN")}
function roomRef(room){return ref(db,`auctions/${room}/state`)}
function log(text){
  if(!state) return;
  const arr = Array.isArray(state.activity)?state.activity.slice(-49):[];
  arr.push({t:Date.now(),text});
  return arr;
}
function toast(text){
  $("toast").textContent=text;$("toast").classList.add("show");
  setTimeout(()=>$("toast").classList.remove("show"),2200);
}
function currentPlayer(){
  return state?.players?.[state.currentIndex] || null;
}
function nextBid(){
  const p=currentPlayer();
  if(!p || p.status!=="available") return 0;
  return state.currentBid>0 ? state.currentBid+500 : p.base;
}
function render(){
  if(!state) return;
  const p=currentPlayer();
  $("connection").textContent="● Live";
  $("connection").style.background="#dcfce7";
  $("roomLabel").textContent=`Room: ${session.room}`;
  $("userLabel").textContent=`${session.name} • ${session.role==="auctioneer"?"Auctioneer":session.team}`;
  $("auctionStatus").textContent=state.status.toUpperCase();
  $("playerName").textContent=p ? p.name : "No player";
  $("playerMeta").textContent=p ? `Base price ${money(p.base)} • ${p.id}` : "";
  $("currentBid").textContent=money(state.currentBid);
  $("highestTeam").textContent=state.highestTeam || "No bids";
  const nb=nextBid();
  $("nextBidText").textContent=nb?`Next bid: ${money(nb)}`:"No bid available";
  $("bidBtn").textContent=nb?`BID ${money(nb)}`:"BID";
  $("bidBtn").disabled = session.role!=="team" || state.status!=="live" || !p || p.status!=="available" || !session.team || !state.teams?.[session.team] || state.teams[session.team].purse < nb || state.highestTeam===session.team;
  $("hostControls").hidden=session.role!=="auctioneer";
  $("progress").textContent=`${state.players.filter(x=>x.status==="sold").length} sold / 24`;

  $("teams").innerHTML=Object.entries(state.teams).map(([name,t])=>{
    const roster=Array.isArray(t.roster)?t.roster.length:0;
    return `<div class="teamCard"><div class="teamName">${name}</div><div class="purse">${money(t.purse)}</div><div class="small">${roster} player(s) • remaining purse</div></div>`;
  }).join("");

  $("players").innerHTML=state.players.map((x,i)=>{
    const cls=x.status==="sold"?"sold":x.status==="unsold"?"unsold":(i===state.currentIndex?"current":"");
    const right=x.status==="sold"?`${x.soldTeam} • ${money(x.soldPrice)}`:x.status==="unsold"?"UNSOLD":money(x.base);
    return `<div class="playerRow ${cls}"><div><b>${i+1}. ${x.name}</b><div class="small">${x.id} • Base ${money(x.base)}</div></div><div><b>${right}</b></div></div>`;
  }).join("");

  const myTeam=session.team && state.teams[session.team];
  $("myRoster").innerHTML = myTeam && myTeam.roster?.length
    ? myTeam.roster.map(r=>`<div class="rosterItem"><span>${r.name}</span><b>${money(r.price)}</b></div>`).join("")
    : `<div class="muted">No players bought yet.</div>`;

  const activity=[...(state.activity||[])].reverse();
  $("activity").innerHTML=activity.map(a=>`<div class="log">${new Date(a.t).toLocaleTimeString()} — ${escapeHtml(a.text)}</div>`).join("");
}
function escapeHtml(s){return String(s).replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]))}

async function ensureRoom(){
  const r=roomRef(session.room);
  await runTransaction(r,current=>{
    if(current===null) return defaultState();
    return current;
  });
}
function subscribe(){
  if(stopRoom) stopRoom();
  stopRoom=onValue(roomRef(session.room),snap=>{
    state=snap.val();
    if(state) render();
  },err=>{
    $("connection").textContent="Database error";
    toast(err.message);
  });
}
async function bid(){
  if(!user || !state) return;
  const team=session.team, r=roomRef(session.room);
  const result=await runTransaction(r,current=>{
    if(!current) return current;
    const p=current.players?.[current.currentIndex];
    if(current.status!=="live" || !p || p.status!=="available") return;
    const amount=current.currentBid>0?current.currentBid+500:p.base;
    if(!team || !current.teams?.[team] || current.highestTeam===team || current.teams[team].purse<amount) return;
    current.currentBid=amount;
    current.highestTeam=team;
    current.bidHistory=[...(current.bidHistory||[]),{t:Date.now(),team,player:p.name,amount}].slice(-100);
    current.activity=logFor(current,`${team} bid ${money(amount)} for ${p.name}.`);
    return current;
  });
  if(result.committed) toast("Bid accepted!");
  else toast("Bid not accepted — another bid may have happened first.");
}
function logFor(current,text){
  const arr=Array.isArray(current.activity)?current.activity.slice(-49):[];
  arr.push({t:Date.now(),text});return arr;
}
async function hostAction(action){
  if(session.role!=="auctioneer") return;
  const r=roomRef(session.room);
  const result=await runTransaction(r,current=>{
    if(!current) return;
    const p=current.players?.[current.currentIndex];
    if(action==="start"){
      if(!p) return;
      current.status="live";
      current.activity=logFor(current,`Auction started: ${p.name}.`);
      return current;
    }
    if(action==="sell"){
      if(!p || current.status!=="live" || !current.highestTeam || current.currentBid<=0) return;
      const team=current.teams[current.highestTeam];
      if(!team || team.purse<current.currentBid) return;
      p.status="sold";p.soldTeam=current.highestTeam;p.soldPrice=current.currentBid;
      team.purse-=current.currentBid;
      team.roster=[...(team.roster||[]),{id:p.id,name:p.name,price:current.currentBid}];
      current.status="sold";
      current.activity=logFor(current,`${p.name} SOLD to ${current.highestTeam} for ${money(current.currentBid)}.`);
      return current;
    }
    if(action==="unsold"){
      if(!p || current.status!=="live") return;
      p.status="unsold";
      current.status="unsold";
      current.activity=logFor(current,`${p.name} marked UNSOLD.`);
      return current;
    }
    if(action==="next"){
      if(!p || !["sold","unsold"].includes(current.status)) return;
      const next=current.currentIndex+1;
      if(next>=current.players.length){
        current.status="complete";
        current.activity=logFor(current,"Auction completed.");
      }else{
        current.currentIndex=next;current.currentBid=0;current.highestTeam="";current.bidHistory=[];
        current.status="waiting";
        current.activity=logFor(current,`Next player: ${current.players[next].name}.`);
      }
      return current;
    }
    if(action==="reset"){
      return defaultState();
    }
  });
  if(!result.committed) toast("Action not available right now.");
}
$("roleInput").addEventListener("change",()=>{$("teamChooserWrap").hidden=$("roleInput").value==="auctioneer"});
$("joinBtn").onclick=async()=>{
  const room=($("roomInput").value||"auction1").replace(/[^a-zA-Z0-9_-]/g,"").slice(0,24);
  const name=($("nameInput").value||"Guest").trim().slice(0,30);
  const role=$("roleInput").value;
  const team=$("teamInput").value;
  if(!room||!name) return toast("Enter room code and your name.");
  session={room,name,role,team:role==="team"?team:""};
  localStorage.setItem("auctionSession",JSON.stringify(session));
  localStorage.setItem("auctionRoom",room);
  $("joinCard").hidden=true;$("app").hidden=false;
  await ensureRoom();subscribe();render();
};
$("bidBtn").onclick=bid;
$("startBtn").onclick=()=>hostAction("start");
$("sellBtn").onclick=()=>hostAction("sell");
$("unsoldBtn").onclick=()=>hostAction("unsold");
$("nextBtn").onclick=()=>hostAction("next");
$("resetBtn").onclick=async()=>{if(confirm("Reset all players, bids, purses and rosters?")) await hostAction("reset")};
$("leaveBtn").onclick=()=>{localStorage.removeItem("auctionSession");location.reload()};
$("copyLinkBtn").onclick=async()=>{
  const url=`${location.origin}${location.pathname}?room=${encodeURIComponent(session.room)}`;
  try{await navigator.clipboard.writeText(url);toast("Invite link copied!")}catch{prompt("Copy this invite link:",url)}
};

onAuthStateChanged(auth,u=>{user=u});
$("roomInput").value=defaultRoom;
$("teamChooserWrap").hidden=$("roleInput").value==="auctioneer";
signInAnonymously(auth).catch(e=>{ $("connection").textContent="Auth error"; toast(e.message); });
