const $ = (id) => document.getElementById(id);
let group = null;
const staged = new Map();
const drafts = new Map();
function notice(message) { $('notice').textContent = message; }
async function api(path, body) {
  const options = body === undefined ? {} : {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(body)};
  const response = await fetch(path, options);
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || 'Request failed');
  return result;
}
function run(task) { Promise.resolve().then(task).catch(error => notice(error.message)); }
function form(form) { return Object.fromEntries(new FormData(form)); }
async function refresh() {
  const groups = await api('/api/groups');
  $('auth').classList.add('hidden'); $('workspace').classList.remove('hidden'); $('logout').classList.remove('hidden');
  $('groups').replaceChildren();
  for (const item of groups) {
    const button = document.createElement('button'); button.className='secondary';
    button.textContent = item.name + ' · ' + item.role;
    button.addEventListener('click', () => selectGroup(item)); $('groups').append(button);
  }
  if (group && groups.some(item => item.id === group.id)) await selectGroup(groups.find(item => item.id === group.id));
}
async function selectGroup(item) {
  group=item; $('group-work').classList.remove('hidden'); $('group-title').textContent=item.name;
  staged.clear(); drafts.clear();
  const [ownedMedia, ownedMemories] = await Promise.all([
    api('/api/owned-media?group='+encodeURIComponent(item.id)),
    api('/api/owned-memories?group='+encodeURIComponent(item.id))
  ]);
  for (const media of ownedMedia) staged.set(media.id,{id:media.id,group:item.id,version:media.policy_version});
  for (const memory of ownedMemories) drafts.set(memory.id,{id:memory.id,title:memory.title,group:item.id,version:memory.policy_version});
  await timeline(); renderPrivate();
}
async function timeline() {
  if (!group) return;
  const items = await api('/api/timeline?group='+encodeURIComponent(group.id)+'&q='+encodeURIComponent($('search').value));
  $('timeline').replaceChildren();
  for (const item of items) $('timeline').append(memoryCard(item));
  if (!items.length) $('timeline').textContent='No visible memories match this search.';
}
function memoryCard(item) {
  const article=document.createElement('article'); const heading=document.createElement('h4');
  heading.textContent=item.title; article.append(heading);
  const detail=document.createElement('small'); detail.textContent=item.visible_media_count+' visible images'; article.append(detail);
  for (const media of item.media) {
    const image=document.createElement('img'); image.src='/api/media/'+encodeURIComponent(media.id)+'/preview'; image.alt=media.caption || 'Memory image'; article.append(image);
    if (media.caption) { const p=document.createElement('p'); p.textContent=media.caption; article.append(p); }
  }
  return article;
}
function renderPrivate() {
  $('staged').replaceChildren(); $('drafts').replaceChildren();
  for (const media of staged.values()) {
    if (media.group !== group.id) continue;
    const article=document.createElement('article');
    const image=document.createElement('img'); image.src='/api/media/'+encodeURIComponent(media.id)+'/preview'; image.alt='Staged image'; article.append(image);
    const label=document.createElement('p'); label.textContent='Private image · '+media.id; article.append(label);
    const button=document.createElement('button'); button.textContent='Publish preview to group';
    button.addEventListener('click', () => run(async () => { await api('/api/media/publish',{id:media.id,components:['preview'],audience:'group',version:media.version}); media.version++; notice('Preview published. Caption, date and original remain private.'); await timeline(); }));
    article.append(button);
    const revoke=document.createElement('button'); revoke.className='secondary'; revoke.textContent='Revoke image sharing';
    revoke.addEventListener('click', () => run(async () => { await api('/api/media/revoke',{id:media.id}); media.version++; notice('Sharing revoked.'); await timeline(); }));
    article.append(revoke); $('staged').append(article);
  }
  for (const memory of drafts.values()) {
    if (memory.group !== group.id) continue;
    const article=document.createElement('article'); article.textContent=memory.title+' · private draft ';
    const button=document.createElement('button'); button.textContent='Publish memory title to group';
    button.addEventListener('click', () => run(async () => { await api('/api/memory/publish',{id:memory.id,audience:'group',version:memory.version}); memory.version++; notice('Memory published. Private images remain hidden.'); await timeline(); }));
    article.append(button); $('drafts').append(article);
  }
}
$('register').addEventListener('submit', event => { event.preventDefault(); run(async () => { await api('/api/register',form(event.target)); notice('Account created. Sign in to continue.'); }); });
$('login').addEventListener('submit', event => { event.preventDefault(); run(async () => { await api('/api/login',form(event.target)); notice('Signed in.'); await refresh(); }); });
$('logout').addEventListener('click', () => run(async () => { await api('/api/logout',{}); location.reload(); }));
$('create-group').addEventListener('submit', event => { event.preventDefault(); run(async () => { await api('/api/group',form(event.target)); event.target.reset(); await refresh(); notice('Group created.'); }); });
$('accept').addEventListener('submit', event => { event.preventDefault(); run(async () => { await api('/api/accept',form(event.target)); event.target.reset(); await refresh(); notice('Joined group.'); }); });
$('invite').addEventListener('click', () => run(async () => { const result=await api('/api/invite',{group:group.id}); $('invite-result').textContent='Share this token privately. It works once and expires in 24 hours: '+result.token; }));
$('upload').addEventListener('submit', event => { event.preventDefault(); run(async () => {
  const values=form(event.target); const file=values.file;
  if (file.size > 20*1024*1024) throw new Error('Image must be 20 MB or smaller');
  const data=await new Promise((resolve,reject) => { const reader=new FileReader(); reader.onload=()=>resolve(String(reader.result).split(',')[1]); reader.onerror=reject; reader.readAsDataURL(file); });
  const result=await api('/api/upload',{group:group.id,filename:file.name,data,caption:values.caption,capture_date:values.capture_date||null});
  staged.set(result.id,{id:result.id,group:group.id,version:0});
  $('memory-media-ids').value=Array.from(staged.values()).filter(item=>item.group===group.id).map(item=>item.id).join(', ');
  event.target.reset(); renderPrivate(); notice('Image staged privately. Review before publishing.');
}); });
$('create-memory').addEventListener('submit', event => { event.preventDefault(); run(async () => {
  const values=form(event.target); const media_ids=values.media_ids.split(',').map(s=>s.trim()).filter(Boolean);
  const result=await api('/api/memory',{group:group.id,title:values.title,media_ids});
  drafts.set(result.id,{id:result.id,title:values.title,group:group.id,version:0});
  event.target.reset(); renderPrivate(); notice('Private memory created.');
}); });
$('search').addEventListener('input', () => run(timeline));
run(refresh);
