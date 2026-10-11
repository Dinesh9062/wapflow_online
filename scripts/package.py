import json
from pathlib import Path
from zipfile import ZipFile,ZIP_DEFLATED
root=Path.cwd()
version=json.loads((root/'package.json').read_text())['version'].replace('.','_')
out=root.parent/f'ZFLEET_Connect_Extension_Source_v{version}.zip'
with ZipFile(out,'w',ZIP_DEFLATED) as z:
 for p in sorted(root.rglob('*')):
  if not p.is_file():continue
  rel=p.relative_to(root)
  if any(x in {'node_modules','.git','artifacts','coverage'} for x in rel.parts):continue
  if rel.name=='.env' or rel.name.startswith('.env.local') or rel.suffix in {'.log','.zip'}:continue
  z.write(p,Path('ZFLEET-Connect')/rel)
print(out)
