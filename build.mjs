import fs from 'node:fs/promises';
await fs.rm('dist',{recursive:true,force:true});
await fs.mkdir('dist/server',{recursive:true});
await fs.cp('public','dist/client',{recursive:true});
await fs.copyFile('worker.js','dist/server/index.js');
console.log('Built standalone Worker and local assets.');

const config=JSON.parse(await fs.readFile('wrangler.jsonc','utf8'));config.main='index.js';config.assets.directory='../client';await fs.writeFile('dist/server/wrangler.json',JSON.stringify(config,null,2));
