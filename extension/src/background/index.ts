const API_BASE='http://localhost:8787';
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== 'API') return;
  fetch(`${API_BASE}${message.path}`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(message.body)})
    .then(async r=>{ if(!r.ok) throw new Error((await r.json()).error ?? `Server error ${r.status}`); return r.json(); })
    .then(sendResponse).catch(error=>sendResponse({error:error.message}));
  return true;
});
