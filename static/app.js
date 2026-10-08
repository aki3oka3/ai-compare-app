'use strict';
const $ = id => document.getElementById(id);
const providers = ['chatgpt', 'claude', 'gemini'];
let lastPrompt = '', answers = {}, busy = false;
function setBusy(value) {
  busy = value;
  $('ask-button').disabled = value;
  $('compare-button').disabled = value || Object.keys(answers).length < 2;
  $('prompt').disabled = value;
}
async function api(path, body) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 110000);
  try {
    const response = await fetch(path, {
      method: 'POST', headers: {'Content-Type': 'application/json', 'Authorization': 'Bearer ' + $('password').value},
      body: JSON.stringify(body), signal: controller.signal
    });
    const data = await response.json().catch(() => { throw new Error('サーバーから回答を読み取れませんでした。'); });
    if (!response.ok) throw new Error(data.error || '通信に失敗しました。');
    return data;
  } catch (error) {
    if (error.name === 'AbortError') throw new Error('待ち時間を超えました。少し待って再送してください。');
    throw error;
  } finally { clearTimeout(timer); }
}
$('ask-form').addEventListener('submit', async event => {
  event.preventDefault();
  if (busy) return;
  lastPrompt = $('prompt').value.trim();
  if (!lastPrompt) { $('status').textContent = '質問を入力してください。'; return; }
  answers = {};
  setBusy(true);
  $('status').textContent = '3つのAIに問い合わせています…';
  $('comparison').textContent = '新しい回答を取得中です。';
  providers.forEach(name => { $('answer-' + name).textContent = '回答を作成中…'; $('answer-' + name).classList.remove('error'); $('model-' + name).textContent = '問い合わせ中'; });
  try {
    const data = await api('/api/ask', {prompt: lastPrompt});
    providers.forEach(name => {
      const result = data.results[name];
      $('model-' + name).textContent = result.model;
      $('answer-' + name).textContent = result.ok ? result.text + (result.truncated ? '\n\n［出力上限に達したため、回答が途中で終わっています］' : '') : result.error;
      $('answer-' + name).classList.toggle('error', !result.ok);
      if (result.ok) answers[name] = result.text;
    });
    $('status').textContent = `${Object.keys(answers).length} / 3 件の回答を取得しました。`;
    $('comparison').textContent = Object.keys(answers).length >= 2 ? '「ChatGPTで比較する」を押してください。' : '比較には2件以上の回答が必要です。';
  } catch (error) {
    $('status').textContent = error.message;
    providers.forEach(name => { $('answer-' + name).textContent = '回答を取得できませんでした。'; $('model-' + name).textContent = '未取得'; });
    $('comparison').textContent = '質問を再送してから比較してください。';
  } finally { setBusy(false); }
});
$('compare-button').addEventListener('click', async () => {
  if (busy) return;
  setBusy(true);
  $('comparison').textContent = 'ChatGPTが回答を比較しています…';
  try {
    const {result} = await api('/api/compare', {prompt: lastPrompt, answers});
    $('comparison').textContent = result.ok ? result.text + (result.truncated ? '\n［出力上限に達しました］' : '') : result.error;
  } catch (error) { $('comparison').textContent = error.message; }
  finally { setBusy(false); }
});
const tabs = [...document.querySelectorAll('[role="tab"]')];
function activate(tab) {
  tabs.forEach(item => {
    const active = item === tab;
    item.setAttribute('aria-selected', String(active));
    item.tabIndex = active ? 0 : -1;
    $('panel-' + item.dataset.tab).hidden = !active;
  });
}
tabs.forEach((tab, index) => {
  tab.addEventListener('click', () => activate(tab));
  tab.addEventListener('keydown', event => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : (index + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
    activate(tabs[next]); tabs[next].focus();
  });
});
