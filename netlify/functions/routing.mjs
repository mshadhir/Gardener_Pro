import {getStore,getDeployStore} from '@netlify/blobs';
import {auth} from '../lib/auth-provider.mjs';
import {storeTarget} from '../lib/state-handler.mjs';
import {checkedTransport} from '../lib/blob-transport.mjs';
import {createRoutingHandler} from '../lib/routing-handler.mjs';
export default createRoutingHandler({authenticate:auth.authenticate,getStore(context){const target=storeTarget(context),options={name:target.name,consistency:'strong',fetch:checkedTransport()};return target.production?getStore(options):getDeployStore(options);}});
export const config={rateLimit:{windowLimit:6,windowSize:60,aggregateBy:['ip','domain']}};
