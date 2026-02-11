
// Dashboard WhatsApp Web - Seleção múltipla, delays humanizados, integração backend
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
  lista.innerHTML = '';
  contatos.forEach(contato => {
    const card = document.createElement('div');
    card.className = 'contato-card' + (contatosSelecionados.has(contato.id) ? ' selecionado' : '');
    card.innerHTML = `<strong>${contato.name || contato.number}</strong><br><span>${contato.number}</span>`;
    card.onclick = () => {
      if (contatosSelecionados.has(contato.id)) {
        contatosSelecionados.delete(contato.id);
      } else {
        contatosSelecionados.add(contato.id);
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
    // Exemplo: buscar contatos do backend
    const res = await apiGet('/contatos');
    contatosGlobal = res.contatos || [];
    renderContatos(contatosGlobal);
    setStatus('Conectado');
  } catch (e) {
    setStatus('Erro ao carregar contatos');
  }
}

function filtrarContatos() {
  const filtro = document.getElementById('busca-contato').value.toLowerCase();
  renderContatos(contatosGlobal.filter(c => (c.name || c.number || c.id).toLowerCase().includes(filtro)));
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
    const contato = contatosGlobal.find(c => c.id === contatoId);
    const numero = contato ? contato.number : contatoId;
    setEnvioStatus(`Enviando para ${numero}...`);
    try {
      await delay(1000 + Math.random() * 2000);
      await fetch(`${API_BASE}/send`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-token': 'changeme'
        },
        body: JSON.stringify({ number: numero, message: mensagem })
      });
      historico.unshift({
        contato: numero,
        mensagem: mensagem.substring(0, 100),
        status: 'enviado',
        data: new Date().toLocaleString('pt-BR')
      });
      sucesso++;
    } catch {
      historico.unshift({
        contato: numero,
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
});

