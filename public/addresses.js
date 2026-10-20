export const ADDRESS_STATES=['VIC','NSW','QLD','SA','WA','TAS','NT','ACT'];
const clean=v=>String(v??'').trim().replace(/\s+/g,' ');
export function suggestAddress(address=''){
 let raw=clean(address),state='VIC',postcode='',suburb='',unit='';
 const tail=raw.match(/\b(VIC|NSW|QLD|SA|WA|TAS|NT|ACT)(?:\s+(\d{4}))?$/i);
 if(tail){state=tail[1].toUpperCase();postcode=tail[2]||'';raw=raw.slice(0,tail.index).replace(/[,\s]+$/,'');}
 else {const pc=raw.match(/\s+(\d{4})$/);if(pc){postcode=pc[1];raw=raw.slice(0,pc.index);}}
 raw=raw.replace(/^(unit\s+[A-Za-z0-9-]+),\s*(?=\d)/i,'$1 ');
 const parts=raw.split(',').map(clean).filter(Boolean);
 if(parts.length===2){suburb=parts.pop();raw=parts[0];}
 const match=raw.match(/^(?:unit\s+([A-Za-z0-9-]+)\s*[,/]?\s+|([A-Za-z0-9-]+)\s*\/\s*)(?=\d)/i);
 if(match){unit=match[1]||match[2];raw=raw.slice(match[0].length);}
 return {unit,street:raw,suburb,state,postcode,confirmed:false};
}
export function addressDraft(site={}){return site.addressParts?{...site.addressParts}:suggestAddress(site.address);}
export function formatAddress(p){return [p.unit?'Unit '+clean(p.unit)+', '+clean(p.street):clean(p.street),clean(p.suburb),[clean(p.state),clean(p.postcode)].filter(Boolean).join(' ')].filter(Boolean).join(', ');}
export function normaliseAddressParts(parts){
 const p={unit:clean(parts.unit),street:clean(parts.street),suburb:clean(parts.suburb),state:clean(parts.state).toUpperCase(),postcode:clean(parts.postcode),confirmed:parts.confirmed===true};
 if(p.unit.length>50||p.street.length>250||p.suburb.length>100||!ADDRESS_STATES.includes(p.state)||(p.postcode&&!/^\d{4}$/.test(p.postcode)))throw new Error('Check the address fields and use a four-digit postcode.');
 if(p.confirmed&&(!p.street||!p.suburb||!p.postcode))throw new Error('Enter street, suburb and postcode before confirming the address.');
 return p;
}
export function addressUpdate(site,parts){const p=normaliseAddressParts(parts),address=p.confirmed?formatAddress(p):(site?.address||formatAddress(p));if(!address.trim()||address.length>500)throw new Error('Enter a street address.');return {address,addressParts:p,...(site?.address&&!site.originalAddress?{originalAddress:site.address}:{})};}
