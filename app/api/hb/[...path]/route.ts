import {env} from 'cloudflare:workers';
import {handle} from '../../../../server/service';
export const dynamic='force-dynamic';
const run=(request:Request)=>handle(request,env as any);
export const GET=run;export const POST=run;export const PATCH=run;export const DELETE=run;
