import sys,json,time,urllib.request,urllib.error,re,datetime,subprocess,atexit
base=sys.argv[1].rstrip('/')
record={'time':datetime.datetime.now(datetime.timezone.utc).isoformat(),'base':base,'checks':[],'result':'INCOMPLETE'}
atexit.register(lambda: print(json.dumps(record,indent=2)))
def fetch(path):
    started=time.monotonic()
    if '--vercel' in sys.argv:
        result=subprocess.run(['vercel','curl',path,'--deployment',base,'--','--silent','--show-error','--max-time','55','--write-out','\n%{http_code}\t%{content_type}\t%header{cache-control}'],capture_output=True,check=True)
        data,_,metadata=result.stdout.rpartition(b'\n')
        status,content_type,cache_control=metadata.decode().split('\t',2)
        headers={'Content-Type':content_type,'Cache-Control':cache_control}
        item={'path':path,'status':int(status),'seconds':round(time.monotonic()-started,3),'content_type':content_type,'cache_control':cache_control}
        record['checks'].append(item)
        return int(status),headers,data,item
    try:
        with urllib.request.urlopen(base+path,timeout=55) as response:
            status=response.status; headers=response.headers; data=response.read()
    except urllib.error.HTTPError as response:
        status=response.code; headers=response.headers; data=response.read()
    item={'path':path,'status':status,'seconds':round(time.monotonic()-started,3),'content_type':headers.get('Content-Type'),'cache_control':headers.get('Cache-Control')}
    record['checks'].append(item)
    return status,headers,data,item
status,headers,data,item=fetch('/health')
assert status==200 and json.loads(data)=={'status':'ok'}, item
for path in ['/api/session','/api/groups','/api/social/home?group=release-probe','/api/social/activity?group=release-probe','/api/social/plans?group=release-probe','/api/social/comments?group=release-probe&kind=photo&target=release-probe','/api/social/reactions?group=release-probe&kind=photo&target=release-probe','/api/atlas/memory?group=release-probe&memory=release-probe','/api/discovery/matches?group=release-probe']:
    status,headers,data,item=fetch(path)
    assert status==403 and isinstance(json.loads(data).get('error'),str), item
    assert 'no-store' in (headers.get('Cache-Control') or ''),item
for path in ['/','/explore','/circle','/memories','/search','/memory/release-probe']:
    status,headers,data,item=fetch(path)
    assert status==200 and 'text/html' in headers.get('Content-Type',''),item
    scripts=re.findall(rb'<script[^>]+src="([^"]+)"',data)
    assert scripts,item
    if path=='/':
        item['entry_scripts']=[script.decode() for script in scripts]
        entries=item['entry_scripts']
for entry in entries:
    status,headers,data,item=fetch(entry)
    assert status==200 and len(data)>0 and 'javascript' in headers.get('Content-Type',''),item
record['result']='PASS'
