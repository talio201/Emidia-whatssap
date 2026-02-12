// Dashboard WhatsApp Web - Integrado com chrome.storage e WebSocket
const API_BASE = "http://localhost:3001";
let contatosGlobal = [];
let contatosSelecionados = new Set();
let historico = [];

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function apiGet(path) {
  const res = await fetch(`${API_BASE}${path}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

function renderContatos(contatos) {
  const lista = document.getElementById('contatos-lista');

  if (!contatos || contatos.length === 0) {
    lista.innerHTML = '<p style="text-align: center; color: #999; padding: 20px;">Nenhum contato encontrado.<br>Abra o WhatsApp Web em uma aba.</p>';
    return;
  }

  lista.innerHTML = '';
  contatos.forEach((contato, idx) => {
    const card = document.createElement('div');
    const contatoId = contato.name || idx;
    card.className = 'contato-card' + (contatosSelecionados.has(contatoId) ? ' selecionado' : '');
    card.innerHTML = `<strong>${contato.name}</strong><br><span>${contato.timestamp ? new Date(contato.timestamp).toLocaleString() : ''}</span>`;
    card.onclick = () => {
      if (contatosSelecionados.has(contatoId)) {
        contatosSelecionados.delete(contatoId);
      } else {
        contatosSelecionados.add(contatoId);
      }
      renderContatos(contatosGlobal);
    };
    lista.appendChild(card);
  });
}

function renderHistorico() {
  const lista = document.getElementById('historico-lista');
  lista.innerHTML = '';
  historico.slice(0, 30).forEach(item => {
    const div = document.createElement('div');
    div.className = 'historico-item';
    div.textContent = `[${item.data}] ${item.contato}: ${item.mensagem} (${item.status})`;
    lista.appendChild(div);
  });
}

function setStatus(text) {
  document.getElementById('status').textContent = text;
}

function setEnvioStatus(text) {
  document.getElementById('envio-status').textContent = text;
}

async function carregarContatos() {
  setStatus('Carregando contatos...');
  try {
    // Load from chrome.storage (where background.js saves them)
    const result = await chrome.storage.local.get(['contacts']);

    if (result.contacts && result.contacts.length > 0) {
      contatosGlobal = result.contacts;
      renderContatos(contatosGlobal);
      setStatus(`✅ ${contatosGlobal.length} contatos carregados`);
    } else {
      // Fallback: try loading from server
      try {
        const store = await apiGet('/status');
        if (store.contacts && store.contacts.length > 0) {
          contatosGlobal = store.contacts;
          renderContatos(contatosGlobal);
          setStatus(`✅ ${contatosGlobal.length} contatos (servidor)`);
        } else {
          contatosGlobal = [];
          renderContatos([]);
          setStatus('⚠️ Aguardando sincronização');
        }
      } catch (e) {
        contatosGlobal = [];
        renderContatos([]);
        setStatus('⚠️ Aguardando sincronização');
      }
    }
  } catch (e) {
    console.error('Erro ao carregar contatos:', e);
    setStatus('❌ Erro ao carregar');
  }
}

// Listen for storage changes
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes.contacts) {
    console.log('📊 Contatos atualizados!', changes.contacts.newValue?.length);
    contatosGlobal = changes.contacts.newValue || [];
    renderContatos(contatosGlobal);
    setStatus(`✅ ${contatosGlobal.length} contatos`);
  }
});

function filtrarContatos() {
  const filtro = document.getElementById('busca-contato').value.toLowerCase();
  renderContatos(contatosGlobal.filter(c => (c.name || '').toLowerCase().includes(filtro)));
}

async function enviarMensagens() {
  const mensagem = document.getElementById('mensagem-envio').value.trim();
  if (!mensagem) {
    setEnvioStatus('Digite uma mensagem.');
    return;
  }
  if (contatosSelecionados.size === 0) {
    setEnvioStatus('Selecione ao menos um contato.');
    return;
  }
  setEnvioStatus('Enviando mensagens...');
  let sucesso = 0, erro = 0;

  for (const contatoId of contatosSelecionados) {
    const contato = contatosGlobal.find(c => c.name === contatoId);
    const nome = contato ? contato.name : contatoId;
    setEnvioStatus(`Enviando para ${nome}...`);

    try {
      await delay(1000 + Math.random() * 2000);

      // Send via WebSocket through background script
      chrome.runtime.sendMessage({
        type: 'send_message_request',
        to: nome,
        message: mensagem
      });

      historico.unshift({
        contato: nome,
        mensagem: mensagem.substring(0, 100),
        status: 'enviado',
        data: new Date().toLocaleString('pt-BR')
      });
      sucesso++;
    } catch {
      historico.unshift({
        contato: nome,
        mensagem: mensagem.substring(0, 100),
        status: 'erro',
        data: new Date().toLocaleString('pt-BR')
      });
      erro++;
    }
    renderHistorico();
  }
  setEnvioStatus(`Mensagens enviadas: ${sucesso}, erros: ${erro}`);
}

document.addEventListener('DOMContentLoaded', () => {
  carregarContatos();
  renderHistorico();
  document.getElementById('busca-contato').oninput = filtrarContatos;
  document.getElementById('enviar-multiplos').onclick = enviarMensagens;

  // Auto-refresh every 5 seconds
  setInterval(carregarContatos, 5000);
});
