import { spawnSync } from "node:child_process";

const names = process.argv.slice(2);
if (!names.length || names.some((name) => !name.startsWith("tests.backend."))) {
  throw new Error("Pass explicit backend unittest case names");
}

const env = {
  ...process.env,
  MAZI_DATABASE_SCHEMA: "mazi_social_20261104_test",
  MAZI_STORAGE_BUCKET: "mazi-social-test",
  MAZI_BACKEND: "supabase",
  MAZI_TEST_POSTGRES: "1",
};
const script = `import json,os,sys,threading,time,unittest,psycopg
from psycopg.conninfo import conninfo_to_dict
from tests.backend.test_postgres import require_synthetic_schema
assert os.environ['MAZI_DATABASE_SCHEMA']=='mazi_social_20261104_test'
assert os.environ['MAZI_STORAGE_BUCKET']=='mazi-social-test'
assert os.environ['MAZI_BACKEND']=='supabase' and os.environ['MAZI_TEST_POSTGRES']=='1'
assert require_synthetic_schema()=='mazi_social_20261104_test'
sensitive=[os.environ.get('MAZI_SUPABASE_SECRET_KEY',''),os.environ.get('MAZI_DATABASE_URL',''),conninfo_to_dict(os.environ['MAZI_DATABASE_URL']).get('password','')]
original_connect=psycopg.connect
def timed_connect(*args,**kwargs):
 started=time.perf_counter()
 outcome='ok'
 try: return original_connect(*args,**kwargs)
 except BaseException as error:
  outcome=type(error).__module__+'.'+type(error).__name__
  raise
 finally:
  print(json.dumps({'connect_seconds':round(time.perf_counter()-started,3),'thread':threading.current_thread().name,'outcome':outcome}),file=sys.stderr,flush=True)
psycopg.connect=timed_connect
class DiagnosticResult(unittest.TextTestResult):
 def addError(self,test,err):
  super().addError(test,err)
  cause=err[1].__cause__ or err[1].__context__
  seen=set()
  while cause is not None and id(cause) not in seen:
   seen.add(id(cause))
   message=str(cause)
   for value in sensitive:
    if value: message=message.replace(value,'[REDACTED]')
   self.stream.writeln('Underlying '+type(cause).__module__+'.'+type(cause).__name__+' sqlstate='+str(getattr(cause,'sqlstate',None))+' '+message)
   cause=cause.__cause__ or cause.__context__
result=unittest.TextTestRunner(verbosity=2,resultclass=DiagnosticResult).run(unittest.defaultTestLoader.loadTestsFromNames(sys.argv[1:]))
raise SystemExit(not result.wasSuccessful())
`;

const result = spawnSync(
  "/Users/altanesmer/Desktop/Ales/Mazi/.venv/bin/python",
  ["-c", script, ...names],
  { stdio: "inherit", env },
);
process.exit(result.status ?? 1);
