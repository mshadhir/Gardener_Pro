import {auth} from '../lib/auth-provider.mjs';
export default auth.handler;
export const config={rateLimit:{windowLimit:10,windowSize:60,aggregateBy:['ip','domain']}};
