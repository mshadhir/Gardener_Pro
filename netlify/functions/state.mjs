import {auth} from '../lib/auth-provider.mjs';
import {getStore,getDeployStore} from '@netlify/blobs';
import {createHandler,storeTarget} from '../lib/state-handler.mjs';
import {checkedTransport} from '../lib/blob-transport.mjs';
export default createHandler({
 authenticate:auth.authenticate,
 getStoreForContext(context){
  const target=storeTarget(context);
  const options={name:target.name,consistency:'strong',fetch:checkedTransport()};
  return target.production?getStore(options):getDeployStore(options);
 }
});
