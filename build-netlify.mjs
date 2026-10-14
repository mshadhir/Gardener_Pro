import fs from 'node:fs/promises';
await fs.rm('dist',{recursive:true,force:true});
await fs.mkdir('dist/client',{recursive:true});
await fs.cp('public','dist/client',{recursive:true});
console.log('Built Netlify static assets. Login and state functions deploy from netlify/.');
