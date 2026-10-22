import {autoPlan,addDays,validDate} from './auto-schedule.js';
import {assignmentValue,assignmentFields,assignedMemberIds} from './team.js';
import {plannerOptions,saveWeeklyPlan} from './weekly-planner.js';
import {estimatedMinutes,siteTitle} from './scheduling.js';

const clock=/^([01]\d|2[0-3]):[0-5]\d$/;
const place=p=>p&&typeof p.placeId==='string'&&/^[A-Za-z0-9_-]{1,300}$/.test(p.placeId);
export const mappedSite=s=>place(s?.mapLocation)&&s.mapLocation.sourceAddress===s.address&&s.mapLocation.confirmed===true;
export const mapLink=(address,placeId='')=>'https://www.google.com/maps/search/?api=1&query='+encodeURIComponent(address)+(placeId?'&query_place_id='+encodeURIComponent(placeId):'');
export function routingSettings(value={}){
 const profiles=value.profiles??[];
 if(!Array.isArray(profiles)||profiles.length>30||typeof (value.useHistory??false)!=='boolean')throw new Error('Check route settings.');
 const seen=new Set();
 for(const p of profiles){if(!p||typeof p.assignment!=='string'||! /^(member|crew):[-_A-Za-z0-9]{1,100}$/.test(p.assignment)||seen.has(p.assignment)||!clock.test(p.startTime)||!clock.test(p.endTime)||p.endTime<=p.startTime||!Number.isInteger(p.breakMinutes)||p.breakMinutes<0||p.breakMinutes>120||[p.start,p.end].some(x=>!place(x)||typeof x.address!=='string'||!x.address.trim()||x.address.length>500))throw new Error('Check starting points, finish points and route hours.');seen.add(p.assignment);}
 return {profiles:structuredClone(profiles),useHistory:value.useHistory??false};
}
export function zonedStamp(date,time,zone){
 if(!validDate(date)||!clock.test(time))throw new Error('Invalid route date or time.');
 const wanted=Date.parse(date+'T'+time+':00Z');let ms=wanted;
 const fmt=new Intl.DateTimeFormat('en-CA',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'});
 const local=t=>{const p=Object.fromEntries(fmt.formatToParts(new Date(t)).map(x=>[x.type,x.value]));return Date.parse(`${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:${p.second}Z`);};
 for(let i=0;i<4;i++)ms+=wanted-local(ms);
 if(local(ms)!==wanted)throw new Error('Route hours fall in a daylight-saving clock change.');
 return new Date(ms).toISOString();
}
const localDate=(iso,zone)=>new Intl.DateTimeFormat('en-CA',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(iso));
export function visitEstimate(data,site,useHistory=false){
 const fallback={minutes:estimatedMinutes(site.estimatedTime),source:'Site estimate',samples:0};
 if(!useHistory||/^gp_sample_/.test(site.id)||/^\[sample\]/i.test(site.name||''))return fallback;
 const days=new Map();
 for(const e of data.entries){if(e.siteId!==site.id||!e.end)continue;const minutes=(Date.parse(e.end)-Date.parse(e.start))/60000;if(!Number.isFinite(minutes)||minutes<1||minutes>480)continue;const day=localDate(e.start,data.settings.timezone);if(localDate(e.end,data.settings.timezone)!==day||data.jobs.filter(j=>j.siteId===site.id&&j.date===day&&j.status==='completed').length!==1)continue;days.set(day,(days.get(day)||0)+minutes);}
 const sample=[...days].sort((a,b)=>b[0].localeCompare(a[0])).slice(0,10).map(x=>x[1]).filter(n=>n>=10&&n<=480).sort((a,b)=>a-b);
 if(sample.length<3)return fallback;
 const mid=Math.floor(sample.length/2),median=sample.length%2?sample[mid]:(sample[mid-1]+sample[mid])/2;
 return {minutes:Math.ceil(median/5)*5,source:'Recorded visit median',samples:sample.length};
}

// Build from saved records. Client rows can choose eligible visits, assignments and locks,
// but cannot supply coordinates, appointment changes or a prebuilt Google request.
export function buildRouteRequest(data,input,today){
 const {start,end}=input,options=plannerOptions(input.options),settings=routingSettings(data.settings.routing);
 if(!validDate(start)||!validDate(end)||end!==addDays(start,6)||end<=today)throw new Error('Choose a week with future days. Map planning starts tomorrow.');
 if(!Array.isArray(input.rows)||input.rows.length>100)throw new Error('Plan up to 100 visits at a time.');
 const base=autoPlan(data,start,end,today),seen=new Set(),proposals=[];
 for(const row of input.rows){const candidate=base.planned.find(r=>r.siteId===row.siteId);if(!candidate||seen.has(row.siteId)||(row.jobId||'')!==candidate.jobId)throw new Error('Bookings changed. Rebuild the draft.');seen.add(row.siteId);const fields=assignmentFields(data,row.assignment??assignmentValue(candidate));if(!assignmentValue(fields))throw new Error('Assign each selected visit to a person or crew.');proposals.push({...candidate,...fields,locked:row.locked===true,lockedDate:row.date});}
 const moving=new Set(proposals.map(r=>r.jobId).filter(Boolean));
 const fixed=data.jobs.filter(j=>j.date>=start&&j.date<=end&&j.date>today&&j.status!=='deferred'&&!moving.has(j.id));
 if(fixed.some(j=>j.status!=='scheduled'))throw new Error('Review completed or in-progress bookings dated in the future.');
 const jobs=[...fixed.map(j=>({...j,fixed:true,jobId:j.id})),...proposals];
 if(!jobs.length||jobs.length>100)throw new Error('Select visits or use a week with existing future bookings (maximum 100).');
 const assignments=[...new Set(jobs.map(assignmentValue))];
 if(assignments.includes(''))throw new Error('Assign existing future bookings before optimising.');
 // Separate vehicle routes cannot use the same person simultaneously.
 const people=new Set();for(const a of assignments){const fields=assignmentFields(data,a),members=assignedMemberIds(data,fields);if(!members.length)throw new Error('Each route needs active crew members.');for(const id of members){if(people.has(id))throw new Error('A worker belongs to multiple routes. Use one crew assignment per worker for this week.');people.add(id);}}
 const vehicles=[],meta=[];
 for(const a of assignments){const p=settings.profiles.find(x=>x.assignment===a);if(!p)throw new Error('Configure starting points and hours for every person or crew in this plan.');for(let date=start;date<=end;date=addDays(date,1)){if(date<=today||(!options.weekdays.includes(new Date(date+'T12:00:00Z').getUTCDay())&&!fixed.some(j=>j.date===date&&assignmentValue(j)===a)))continue;
  const begin=zonedStamp(date,p.startTime,data.settings.timezone),finish=zonedStamp(date,p.endTime,data.settings.timezone),span=(Date.parse(finish)-Date.parse(begin))/1000;
  const v={label:'vehicle_'+meta.length,travelMode:'DRIVING',startWaypoint:{placeId:p.start.placeId},endWaypoint:{placeId:p.end.placeId},startTimeWindows:[{startTime:begin,endTime:begin}],endTimeWindows:[{startTime:begin,endTime:finish}],costPerTraveledHour:100,costPerHour:1,loadLimits:{visits:{maxLoad:String(options.maxJobs)}},routeDurationLimit:{maxDuration:Math.round(Math.min(span,options.maxHours*3600))+'s'}};
  if(p.breakMinutes){const from=new Date(Date.parse(begin)+Math.min(3*3600000,span*250)).toISOString(),to=new Date(Math.min(Date.parse(begin)+5*3600000,Date.parse(finish)-p.breakMinutes*60000)).toISOString();if(to<from)throw new Error('Route hours are too short for the configured break.');v.breakRule={breakRequests:[{earliestStartTime:from,latestStartTime:to,minDuration:p.breakMinutes*60+'s'}]};}
  vehicles.push(v);meta.push({assignment:a,date,begin,finish,profile:p});
 }}
 const shipments=[],visits=[];
 for(const j of jobs){const site=data.sites.find(s=>s.id===j.siteId);if(!site||!mappedSite(site))throw new Error('Confirm the map location for '+siteTitle(site)+'.');if(/^gp_sample_/.test(site.id)||/^\[sample\]/i.test(site.name||''))throw new Error('Remove sample visits from the map plan.');
  const estimate=visitEstimate(data,site,input.useHistory===true);if(!estimate.minutes)throw new Error('Add a visit duration for '+siteTitle(site)+'.');
  const indices=[];for(let i=0;i<meta.length;i++){const m=meta[i];if(m.assignment!==assignmentValue(j))continue;if(j.fixed?m.date!==j.date:m.date<j.date||!options.weekdays.includes(new Date(m.date+'T12:00:00Z').getUTCDay()))continue;if(j.locked&&m.date!==j.lockedDate)continue;if(!j.fixed&&/^[0-6]$/.test(String(site.preferredDay??''))&&new Date(m.date+'T12:00:00Z').getUTCDay()!==Number(site.preferredDay))continue;if(data.jobs.some(x=>x.siteId===j.siteId&&x.id!==j.jobId&&x.date===m.date))continue;indices.push(i);}
  if(!indices.length)throw new Error('No eligible future day for '+siteTitle(site)+'. Check its due date, day lock and working days.');
  const windows=indices.map(i=>{const m=meta[i];if(j.fixed&&j.time){const at=zonedStamp(j.date,j.time,data.settings.timezone);if(at<m.begin||at>m.finish)throw new Error('An existing appointment falls outside route hours.');return {startTime:at,endTime:at};}return {startTime:m.begin,endTime:m.finish};});
  const index=shipments.length;shipments.push({label:'visit_'+index,pickups:[{arrivalWaypoint:{placeId:site.mapLocation.placeId},duration:Math.round((estimate.minutes+options.buffer)*60)+'s',timeWindows:windows}],allowedVehicleIndices:indices,loadDemands:{visits:{amount:'1'}},...(j.fixed?{}:{penaltyCost:1000000})});visits.push({...j,estimate});
 }
 return {request:{timeout:'15s',considerRoadTraffic:true,model:{globalStartTime:zonedStamp(start,'00:00',data.settings.timezone),globalEndTime:zonedStamp(addDays(end,1),'00:00',data.settings.timezone),shipments,vehicles}},meta,visits,start,end,options};
}

export function readRouteResponse(model,response){
 if(response.validationErrors?.length||!Array.isArray(response.routes))throw new Error('Google could not create a valid route. Check route hours and appointments.');
 const seen=new Set(),usedVehicles=new Set(),routes=[],rows=[];
 for(const route of response.routes){const vehicleIndex=route.vehicleIndex??0,m=model.meta[vehicleIndex];if(!m||usedVehicles.has(vehicleIndex)||route.hasTrafficInfeasibilities)throw new Error('Travel estimates conflict with route hours. Adjust limits and try again.');usedVehicles.add(vehicleIndex);const stops=[];
  for(const v of route.visits||[]){const index=v.shipmentIndex??0,j=model.visits[index];if(!j||seen.has(index)||v.isPickup===false||!(model.request.model.shipments[index].allowedVehicleIndices||[]).includes(vehicleIndex)||!Number.isFinite(Date.parse(v.startTime)))throw new Error('Invalid route returned. Please try again.');seen.add(index);const arrival=new Date(v.startTime).toISOString(),duration=Number.parseFloat(model.request.model.shipments[index].pickups[0].duration),windows=model.request.model.shipments[index].pickups[0].timeWindows;if(!windows.some(w=>arrival>=w.startTime&&arrival<=w.endTime)||Date.parse(arrival)+duration*1000>Date.parse(m.finish))throw new Error('A route stop falls outside working hours.');
   const stop={siteId:j.siteId,jobId:j.jobId||'',fixed:!!j.fixed,arrival,order:stops.length,...j.estimate};stops.push(stop);if(!j.fixed)rows.push({siteId:j.siteId,jobId:j.jobId||'',date:m.date,assignment:m.assignment,order:stop.order});
  }
  if(stops.length){const travelMinutes=Number.parseFloat(route.metrics?.travelDuration)/60,totalMinutes=(Date.parse(route.vehicleEndTime)-Date.parse(route.vehicleStartTime))/60000;if(!Number.isFinite(travelMinutes)||travelMinutes<0||travelMinutes>totalMinutes||!Number.isFinite(totalMinutes)||totalMinutes<0||totalMinutes>model.options.maxHours*60+.01||Date.parse(route.vehicleStartTime)<Date.parse(m.begin)||Date.parse(route.vehicleEndTime)>Date.parse(m.finish)||stops.length>model.options.maxJobs)throw new Error('A route exceeds the daily limits.');routes.push({assignment:m.assignment,date:m.date,stops,travelMinutes:Math.ceil(travelMinutes),totalMinutes:Math.ceil(totalMinutes)});}
 }
 if(model.visits.some((j,i)=>j.fixed&&!seen.has(i)))throw new Error('An existing booking could not fit. Adjust route hours before saving.');
 const needs=model.visits.filter((_,i)=>!seen.has(i)).map(j=>({siteId:j.siteId,reason:'Could not fit within route hours and daily limits'}));
 return {rows,routes,needs,provider:'Google Maps',generatedAt:new Date().toISOString()};
}

// Both schedule changes and route order are committed in the existing atomic workspace save.
export function saveRoutePlan(data,result,start,end,today,options,makeId){
 const copy=structuredClone(data);
 // Validate service capacity using the durations actually used in this route.
 // These are temporary values; the site's configured estimate is not changed.
 for(const route of result.routes)for(const stop of route.stops){if(!Number.isFinite(stop.minutes)||stop.minutes<=0||stop.minutes>960)throw new Error('Invalid route duration. Optimise again.');const site=copy.sites.find(s=>s.id===stop.siteId);if(!site)throw new Error('A route site is missing. Rebuild the draft.');site.estimatedTime=stop.minutes+'m';}
 saveWeeklyPlan(copy,result.rows,start,end,today,options,makeId);
 for(const route of result.routes)for(const stop of route.stops){const job=stop.fixed?copy.jobs.find(j=>j.id===stop.jobId):copy.jobs.find(j=>j.siteId===stop.siteId&&j.date===route.date&&assignmentValue(j)===route.assignment&&j.status==='scheduled');if(!job||job.date!==route.date||assignmentValue(job)!==route.assignment||job.status!=='scheduled')throw new Error('Bookings changed. Rebuild the map plan.');job.order=stop.order;}
 data.jobs=copy.jobs;data.settings.planner=copy.settings.planner;
 return result.rows.length;
}
