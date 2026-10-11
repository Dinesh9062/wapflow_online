import {spawnSync} from 'node:child_process';
const r=spawnSync('python3',['scripts/package.py'],{stdio:'inherit'});if(r.status)process.exit(r.status);
