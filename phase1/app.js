const $ = (id) => document.getElementById(id);
let group = null;
let members = [];
let latestInvite = null;
let timelineOffset = 0;
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
  latestInvite=null; $('revoke-invite').hidden=true; $('invite-result').textContent='';
  staged.clear(); drafts.clear();
  const [ownedMedia, ownedMemories] = await Promise.all([
    api('/api/owned-media?group='+encodeURIComponent(item.id)),
    api('/api/owned-memories?group='+encodeURIComponent(item.id))
  ]);
  members = await api('/api/members?group='+encodeURIComponent(item.id));
  $('members').replaceChildren();
  for (const member of members) {
    const line=document.createElement('p'); line.textContent=member.email+' · '+member.role+' ';
    if (item.role==='admin' && member.role!=='admin') {
      const remove=document.createElement('button'); remove.className='secondary'; remove.textContent='Remove member';
      remove.addEventListener('click',()=>run(async()=>{ await api('/api/member/remove',{group:item.id,user:member.id}); await selectGroup(item); notice('Member removed and their contributions revoked.'); }));
      line.append(remove);
    }
    $('members').append(line);
  }
  for (const media of ownedMedia) staged.set(media.id,{id:media.id,group:item.id,version:media.policy_version});
  for (const memory of ownedMemories) drafts.set(memory.id,{id:memory.id,title:memory.title,group:item.id,version:memory.policy_version});
  await timeline(); renderPrivate();
}
async function timeline(more = false) {
  if (!group) return;
  if (!more) { timelineOffset = 0; $('timeline').replaceChildren(); }
  const items = await api('/api/timeline?group='+encodeURIComponent(group.id)+'&q='+encodeURIComponent($('search').value)+'&offset='+timelineOffset+'&limit=20');
  for (const item of items) $('timeline').append(memoryCard(item));
  timelineOffset += items.length;
  $('more').hidden = items.length < 20;
  if (!timelineOffset) $('timeline').textContent='No visible memories match this search.';
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
    const components=document.createElement('div');
    for (const [name,label] of [['caption','Caption'],['date','Capture date'],['original','Original download']]) {
      const checkbox=document.createElement('input'); checkbox.type='checkbox'; checkbox.value=name;
      const wrapper=document.createElement('label'); wrapper.append(checkbox, ' Share '+label); components.append(wrapper);
    }
    article.append(components);
    const audience=audienceControls(); article.append(audience.element);
    const button=document.createElement('button'); button.textContent='Publish selected components';
    button.addEventListener('click', () => run(async () => { const choice=audience.read(); await api('/api/media/publish',{id:media.id,components:['preview',...Array.from(components.querySelectorAll('input:checked')).map(input=>input.value)],...choice,version:media.version}); media.version++; notice('Image sharing updated.'); await timeline(); }));
    article.append(button);
    const revoke=document.createElement('button'); revoke.className='secondary'; revoke.textContent='Revoke image sharing';
    revoke.addEventListener('click', () => run(async () => { await api('/api/media/revoke',{id:media.id}); media.version++; notice('Sharing revoked.'); await timeline(); }));
    article.append(revoke); $('staged').append(article);
    const remove=document.createElement('button'); remove.className='secondary'; remove.textContent='Delete image';
    remove.addEventListener('click', () => run(async () => { await api('/api/media/delete',{id:media.id}); staged.delete(media.id); renderPrivate(); await timeline(); notice('Image deleted.'); }));
    article.append(remove);
  }
  for (const memory of drafts.values()) {
    if (memory.group !== group.id) continue;
    const article=document.createElement('article'); article.textContent=memory.title+' · private draft ';
    const audience=audienceControls(); article.append(audience.element);
    const button=document.createElement('button'); button.textContent='Publish memory title';
    button.addEventListener('click', () => run(async () => { await api('/api/memory/publish',{id:memory.id,...audience.read(),version:memory.version}); memory.version++; notice('Memory published. Private images remain hidden.'); await timeline(); }));
    const revoke=document.createElement('button'); revoke.className='secondary'; revoke.textContent='Revoke memory';
    revoke.addEventListener('click', () => run(async () => { await api('/api/memory/revoke',{id:memory.id}); memory.version++; await timeline(); notice('Memory sharing revoked.'); }));
    const remove=document.createElement('button'); remove.className='secondary'; remove.textContent='Delete memory';
    remove.addEventListener('click', () => run(async () => { await api('/api/memory/delete',{id:memory.id}); drafts.delete(memory.id); renderPrivate(); await timeline(); notice('Memory deleted.'); }));
    article.append(button,revoke,remove); $('drafts').append(article);
  }
}
function audienceControls() {
  const element=document.createElement('div');
  const select=document.createElement('select'); select.setAttribute('aria-label','Audience');
  for (const [value,label] of [['group','Whole group'],['selected','Selected members']]) {
    const option=document.createElement('option'); option.value=value; option.textContent=label; select.append(option);
  }
  const recipients=document.createElement('div');
  for (const member of members) {
    const checkbox=document.createElement('input'); checkbox.type='checkbox'; checkbox.value=member.id;
    const label=document.createElement('label'); label.append(checkbox,' '+member.email); recipients.append(label);
  }
  recipients.hidden=true; select.addEventListener('change',()=>{ recipients.hidden=select.value!=='selected'; });
  element.append(select,recipients);
  return {element,read:()=>({audience:select.value,recipients:Array.from(recipients.querySelectorAll('input:checked')).map(input=>input.value)})};
}
$('register').addEventListener('submit', event => { event.preventDefault(); run(async () => { await api('/api/register',form(event.target)); notice('Account created. Sign in to continue.'); }); });
$('login').addEventListener('submit', event => { event.preventDefault(); run(async () => { await api('/api/login',form(event.target)); notice('Signed in.'); await refresh(); }); });
$('logout').addEventListener('click', () => run(async () => { await api('/api/logout',{}); location.reload(); }));
$('create-group').addEventListener('submit', event => { event.preventDefault(); run(async () => { await api('/api/group',form(event.target)); event.target.reset(); await refresh(); notice('Group created.'); }); });
$('accept').addEventListener('submit', event => { event.preventDefault(); run(async () => { await api('/api/accept',form(event.target)); event.target.reset(); await refresh(); notice('Joined group.'); }); });
$('invite').addEventListener('click', () => run(async () => { const result=await api('/api/invite',{group:group.id}); latestInvite=result.token; $('revoke-invite').hidden=false; $('invite-result').textContent='Share this token privately. It works once and expires in 24 hours: '+result.token; }));
$('revoke-invite').addEventListener('click', () => run(async () => { await api('/api/invite/revoke',{group:group.id,token:latestInvite}); latestInvite=null; $('revoke-invite').hidden=true; $('invite-result').textContent='Latest invite revoked.'; }));
$('export').addEventListener('click', () => run(async () => { const data=await api('/api/export?group='+encodeURIComponent(group.id)); const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'}); const url=URL.createObjectURL(blob); const link=document.createElement('a'); link.href=url; link.download='mazi-visible-export.json'; link.click(); setTimeout(()=>URL.revokeObjectURL(url),1000); notice('Visible metadata exported. Originals are available through their separately authorized download links.'); }));
$('upload').addEventListener('submit', event => { event.preventDefault(); run(async () => {
  const values=form(event.target); const file=values.file;
  if (file.size > 20*1024*1024) throw new Error('Image must be 20 MB or smaller');
  const bytes=new Uint8Array(await file.arrayBuffer());
  const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))).map(x=>x.toString(16).padStart(2,'0')).join('');
  const key='mazi-upload:'+group.id+':'+hash;
  let id=localStorage.getItem(key); let received=0;
  if (id) { try { received=(await api('/api/upload/'+encodeURIComponent(id))).received; } catch { id=null; } }
  if (!id) { id=(await api('/api/upload/start',{group:group.id,filename:file.name,size:file.size,sha256:hash,caption:values.caption,capture_date:values.capture_date||null})).id; localStorage.setItem(key,id); }
  while (received < bytes.length) {
    const chunk=bytes.subarray(received,Math.min(received+256*1024,bytes.length));
    let binary=''; for (const byte of chunk) binary+=String.fromCharCode(byte);
    received=(await api('/api/upload/chunk',{id,offset:received,data:btoa(binary)})).received;
    $('upload-progress').value=Math.round(received*100/bytes.length);
    notice('Uploading '+$('upload-progress').value+'%');
  }
  const result=await api('/api/upload/finish',{id}); localStorage.removeItem(key);
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
$('more').addEventListener('click', () => run(() => timeline(true)));
run(refresh);
