const $=id=>document.getElementById(id);
const defaults={fuelPrice:24,consumption:12,runningCost:1.5,margin:25};
let settings={...defaults,...JSON.parse(localStorage.getItem("workflow-settings")||"{}")};
let rides=JSON.parse(localStorage.getItem("workflow-rides")||"[]");
let current=null;

function money(n){return "R"+Number(n).toFixed(2)}
function setStatus(t){$("status").textContent=t}
function saveSettings(){localStorage.setItem("workflow-settings",JSON.stringify(settings))}
function renderRides(){
  $("rideCount").textContent=rides.length;
  $("rides").innerHTML=rides.length?rides.map((r,i)=>`<div class="ride"><strong>${r.date} • ${r.time} • ${r.passengers} passenger${r.passengers==1?"":"s"}</strong><small>${escapeHtml(r.pickup)} → ${escapeHtml(r.destination)} • ${r.distance.toFixed(1)} km • ${money(r.total)}</small></div>`).join(""):'<p class="muted">No rides scheduled yet.</p>';
}
function escapeHtml(s){return String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]))}
async function geocode(q){
  const u="https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&countrycodes=za&q="+encodeURIComponent(q);
  const r=await fetch(u,{headers:{Accept:"application/json"}}); const d=await r.json();
  if(!d[0])throw new Error("Address not found: "+q); return {lat:+d[0].lat,lon:+d[0].lon};
}
async function route(a,b){
  const u=`https://router.project-osrm.org/route/v1/driving/${a.lon},${a.lat};${b.lon},${b.lat}?overview=false`;
  const r=await fetch(u);const d=await r.json();if(d.code!=="Ok")throw new Error("Route could not be calculated");return d.routes[0].distance/1000;
}
$("calculateBtn").onclick=async()=>{
  const pickup=$("pickup").value.trim(),destination=$("destination").value.trim();
  if(!pickup||!destination){setStatus("Enter both addresses.");return}
  setStatus("Finding addresses and calculating route…");$("calculateBtn").disabled=true;
  try{
    const [a,b]=await Promise.all([geocode(pickup),geocode(destination)]);
    let distance=await route(a,b);
    const multiplier=$("tripType").value==="return"?2:1;
    distance*=multiplier;
    const p=+$("passengers").value;
    const fuel=distance*(settings.consumption/100)*settings.fuelPrice;
    const operating=distance*settings.runningCost;
    const totalVehicle=(fuel+operating)*(1+settings.margin/100);
    const per=Math.max(10,totalVehicle/p);
    current={pickup,destination,date:$("date").value,time:$("time").value,passengers:p,distance,total:per*p,per};
    $("resultPickup").textContent=pickup;$("resultDestination").textContent=destination;
    $("distance").textContent=distance.toFixed(1)+" km";$("fare").textContent=money(per);$("total").textContent=money(per*p);
    $("result").classList.remove("hidden");setStatus("Estimate calculated.");
  }catch(e){setStatus(e.message||"Could not calculate route.")}
  finally{$("calculateBtn").disabled=false}
};
$("confirmBtn").onclick=()=>{
  if(!current)return;
  rides.push({...current,id:Date.now()});localStorage.setItem("workflow-rides",JSON.stringify(rides));renderRides();
  $("result").classList.add("hidden");setStatus("Ride confirmed and saved on this phone.");current=null;
};
$("settingsBtn").onclick=()=>{$("fuelPrice").value=settings.fuelPrice;$("consumption").value=settings.consumption;$("runningCost").value=settings.runningCost;$("margin").value=settings.margin;$("settingsModal").classList.remove("hidden")};
$("closeSettings").onclick=()=>$("settingsModal").classList.add("hidden");
$("saveSettings").onclick=()=>{settings={fuelPrice:+$("fuelPrice").value||defaults.fuelPrice,consumption:+$("consumption").value||defaults.consumption,runningCost:+$("runningCost").value||defaults.runningCost,margin:+$("margin").value||0};saveSettings();$("settingsModal").classList.add("hidden");setStatus("Pricing settings saved.")};
const today=new Date();$("date").value=today.toISOString().slice(0,10);$("time").value="06:00";renderRides();
if("serviceWorker" in navigator)navigator.serviceWorker.register("./sw.js").catch(()=>{});
