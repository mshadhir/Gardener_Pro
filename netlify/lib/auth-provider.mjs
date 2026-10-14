import {getStore,getDeployStore} from '@netlify/blobs';
import {createAuth} from './session.mjs';
import {storeTarget} from './state-handler.mjs';
import {checkedTransport} from './blob-transport.mjs';
export const auth=createAuth({password:()=>process.env.GARDENER_PASSWORD,getStore(context){
 const target=storeTarget(context),options={name:target.production?'gardener-pro-sessions-v1':'gardener-pro-preview-sessions-v1',consistency:'strong',fetch:checkedTransport()};
 return target.production?getStore(options):getDeployStore(options);
}});
