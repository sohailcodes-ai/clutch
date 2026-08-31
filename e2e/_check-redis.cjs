const Redis = require('ioredis');
const r = new Redis('redis://localhost:6379');
r.info('server').then(i => {
  console.log(i.split('\n').filter(l => l.startsWith('redis_version:'))[0]);
  return r.quit();
}).catch(e => { console.error(e.message); process.exit(1); });
