// Guard the SDK's conditional-write path: non-412 provider errors must throw,
// even if a failed response includes an ETag. No response bodies/tokens are logged.
export function checkedTransport(transport=fetch) {
 return async (input,init)=>{
  const response=await transport(input,init);
  const method=(init?.method||'GET').toUpperCase();
  const expectedConflict=method==='PUT'&&response.status===412;
  const missingRead=['GET','HEAD'].includes(method)&&response.status===404;
  if(!response.ok&&!expectedConflict&&!missingRead)throw new Error('Storage request failed');
  return response;
 };
}
