import {getStore,getDeployStore} from '@netlify/blobs';
import {createHandler,storeTarget} from '../lib/state-handler.mjs';
import {checkedTransport} from '../lib/blob-transport.mjs';
export default createHandler({
 allowedEmails:()=>process.env.GARDENER_ALLOWED_EMAILS,
 getStoreForContext(context){
  const target=storeTarget(context);
  const options={name:target.name,consistency:'strong',fetch:checkedTransport()};
  return target.production?getStore(options):getDeployStore(options);
 }
});
