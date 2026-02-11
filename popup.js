// Popup Script - Versão 3.0 Dashboard
window.initPopupAssistant = function initPopupAssistant(root=document) {
let listaContatosGlobal = [];
let contatosSelecionados = [];
let modoWhatsAppAtivo = false;
let listaChatsGlobal = [];
let chatSelecionadoId = null;

const API_BASE = "http://localhost:3001";
let API_TOKEN = localStorage.getItem('api_token') || '';

function setApiToken(token) {
  API_TOKEN = token || '';
  if (token) localStorage.setItem('api_token', token);
  else localStorage.removeItem('api_token');
}

// also persist API token to extension storage so content script can read it
function persistApiTokenToChromeStorage(token) {
  try {
    if (window.chrome && chrome.storage && chrome.storage.local && typeof chrome.storage.local.set === 'function') {
      const obj = { api_token: token || '' };
      chrome.storage.local.set(obj, () => {
        // ignore errors
      });
    }
  } catch (e) {
    // chrome.storage not available in page context — ignore
  }
}

async function apiGet(path) {
  const headers = {};
  if (API_TOKEN) headers['x-api-token'] = API_TOKEN;
  try {
    console.log('[Emidia][apiGet] GET', `${API_BASE}${path}`, headers);
    const res = await fetch(`${API_BASE}${path}`, { headers });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      console.error('[Emidia][apiGet] HTTP error', res.status, text);
      throw new Error(`HTTP ${res.status} ${text}`);
    }
    return res.json();
  } catch (err) {
    console.error('[Emidia][apiGet] fetch error', err);
    throw err;
  }
}
async function apiPost(path, body) {
  const headers = { "Content-Type": "application/json" };
  if (API_TOKEN) headers['x-api-token'] = API_TOKEN;
  try {
    console.log('[Emidia][apiPost] POST', `${API_BASE}${path}`, body, headers);
    const res = await fetch(`${API_BASE}${path}`, {
      method: "POST",
      headers,
      body: JSON.stringify(body)
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      console.error('[Emidia][apiPost] HTTP error', res.status, text);
      throw new Error(`HTTP ${res.status} ${text}`);
    }
    return res.json();
  } catch (err) {
    console.error('[Emidia][apiPost] fetch error', err);
    throw err;
  }
}

// Classe para gerenciar histórico
class GerenciadorHistorico {
  constructor() {
    this.chaveStorage = 'whatsapp_historico_envios';
  }

  adicionar(contato, mensagem, status = 'enviado') {
    const historico = this.obter();
    historico.unshift({
      id: Date.now(),
      contato,
      mensagem: mensagem.substring(0, 100),
      status,
      data: new Date().toLocaleString('pt-BR')
    });
    historico.splice(50);
    localStorage.setItem(this.chaveStorage, JSON.stringify(historico));
  }

  obter() {
    try {
      const dados = localStorage.getItem(this.chaveStorage);
      return dados ? JSON.parse(dados) : [];
    } catch {
      return [];
    }
  }

  limpar() {
    localStorage.removeItem(this.chaveStorage);
  }
}

const historico = new GerenciadorHistorico();

// Listener para receber contatos clicados no WhatsApp
if (window.chrome && chrome.runtime && chrome.runtime.onMessage) {
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "contatoSelecionado" && modoWhatsAppAtivo) {
    console.log("Contato do WhatsApp:", request.contato);
    adicionarContatoGlobal(request.contato);
  }
});
}

// Em vez de DOMContentLoaded, inicializa diretamente
(function popupInit(){
  // helper to get elements inside root (document or container)
  const $id = (id) => (root && typeof root.getElementById === 'function') ? root.getElementById(id) : root.querySelector('#' + id);
  // Elementos gerais
  const tabBtns = root.querySelectorAll(".tab-btn");
  const tabContents = root.querySelectorAll(".tab-content");
  const textoConexao = $id("textoConexao");
  // Token UI
  const apiTokenInput = $id('apiTokenInput');
  const saveApiTokenBtn = $id('saveApiToken');
  if (apiTokenInput) apiTokenInput.value = API_TOKEN || '';
  if (saveApiTokenBtn) {
    saveApiTokenBtn.addEventListener('click', () => {
      const v = (apiTokenInput && apiTokenInput.value) ? apiTokenInput.value.trim() : '';
      setApiToken(v);
      persistApiTokenToChromeStorage(v);
      textoConexao.textContent = v ? 'Token salvo' : 'Token removido';
      // refresh connection status
      setTimeout(() => carregarStatus(), 200);
    });
  }

  // If chrome.storage has a saved token (from previous save), sync it into localStorage
  try {
    if (window.chrome && chrome.storage && chrome.storage.local && typeof chrome.storage.local.get === 'function') {
      chrome.storage.local.get('api_token', (res) => {
        try {
          if (res && res.api_token) {
            API_TOKEN = res.api_token;
            if (apiTokenInput) apiTokenInput.value = API_TOKEN;
            localStorage.setItem('api_token', API_TOKEN);
          }
        } catch (e) {
          // ignore
        }
      });
    }
  } catch (e) {
    // chrome.storage not available here
  }

  async function carregarStatus() {
    try {
      const st = await apiGet('/status');
      textoConexao.textContent = st.ready ? '✅ Backend conectado' : (st.hasQr ? '⚠️ Escaneie o QR' : '❌ Backend offline');
      return st;
    } catch (e) {
      textoConexao.textContent = '❌ Backend offline';
      return null;
    }
  }

  // initial status check
  carregarStatus();

  // PAINEL
  const totalContatos = $id("totalContatos");
  const totalSelecionados = $id("totalSelecionados");
  const totalEnvios = $id("totalEnvios");
  const btnAtualizarContatos = $id("btnAtualizarContatos");
  const toggleModoWhatsApp = $id("toggleModoWhatsApp");
  const textoModoWhatsApp = $id("textoModoWhatsApp");
  const btnLimparSelecao = $id("btnLimparSelecao");
  const btnLimparHistorico = $id("btnLimparHistorico");
  const statusCarregar = $id("statusCarregar");

  // CONTATOS
  const inputBuscaContatos = $id("inputBuscaContatos");
  const listaContatos = $id("listaContatos");

  // ENVIAR
  const contatoInput = $id("contatoInput");
  const chipContatos = $id("chipContatos");
  const listaContatosRapida = $id("listaContatosRapida");
  const mensagem = $id("mensagem");
  const intervaloEnvio = $id("intervaloEnvio");
  const arquivo = $id("arquivo");
  const nomeArquivo = $id("nomeArquivo");
  const btnEnviarMensagem = $id("btnEnviarMensagem");
  const statusEnvio = $id("statusEnvio");

  // CONVERSAS
  const inputBuscaChats = $id("inputBuscaChats");
  const btnAtualizarChats = $id("btnAtualizarChats");
  const listaChats = $id("listaChats");
  const chatTitulo = $id("chatTitulo");
  const chatSubtitulo = $id("chatSubtitulo");
  const listaMensagens = $id("listaMensagens");
  const mensagemConversa = $id("mensagemConversa");
  const arquivoConversa = $id("arquivoConversa");
  const btnEnviarConversa = $id("btnEnviarConversa");
  const statusConversa = $id("statusConversa");

  // AUTOMAÇÃO
  const listaNumeros = $id("listaNumeros");
  const dataHoraEnvio = $id("dataHoraEnvio");
  const mensagemAgendada = $id("mensagemAgendada");
  const arquivoAgendado = $id("arquivoAgendado");
  const nomeArquivoAgendado = $id("nomeArquivoAgendado");
  const btnAgendar = $id("btnAgendar");
  const statusAgendamento = $id("statusAgendamento");
  const arquivoCSV = $id("arquivoCSV");
  const nomeArquivoCSV = $id("nomeArquivoCSV");
  const templateSelect = $id("templateSelect");
  const btnSalvarTemplate = $id("btnSalvarTemplate");
  const btnAtualizarAgendamentos = $id("btnAtualizarAgendamentos");
  const listaAgendamentos = $id("listaAgendamentos");

  // GRUPOS
  const nomeGrupo = $id("nomeGrupo");
  const numerosGrupo = $id("numerosGrupo");
  const selectGrupo = $id("selectGrupo");
  const numerosGrupoEditar = $id("numerosGrupoEditar");
  const btnCriarGrupo = $id("btnCriarGrupo");
  const btnAdicionarGrupo = $id("btnAdicionarGrupo");
  const btnRemoverGrupo = $id("btnRemoverGrupo");
  const btnAtualizarGrupos = $id("btnAtualizarGrupos");
  const statusGrupos = $id("statusGrupos");

  // RESPOSTAS
  const btnAtualizarRespostas = $id("btnAtualizarRespostas");
  const listaRespostas = $id("listaRespostas");

  // CAMPANHAS
  const campanhaNome = $id("campanhaNome");
  const campanhaNumeros = $id("campanhaNumeros");
  const campanhaMensagem = $id("campanhaMensagem");
  const btnCriarCampanha = $id("btnCriarCampanha");
  const btnAtualizarCampanhas = $id("btnAtualizarCampanhas");
  const listaCampanhas = $id("listaCampanhas");
  const statusCampanhas = $id("statusCampanhas");

  // ETIQUETAS
  const tagNome = $id("tagNome");
  const tagNumeros = $id("tagNumeros");
  const tagLista = $id("tagLista");
  const btnCriarTag = $id("btnCriarTag");
  const btnAplicarTags = $id("btnAplicarTags");
  const statusTags = $id("statusTags");

  // FUNIL
  const funilNumero = $id("funilNumero");
  const funilEtapa = $id("funilEtapa");
  const btnAtualizarFunil = $id("btnAtualizarFunil");
  const btnVerFunil = $id("btnVerFunil");
  const listaFunil = $id("listaFunil");
  const statusFunil = $id("statusFunil");

  // RELATÓRIOS
  const btnAtualizarRelatorios = $id("btnAtualizarRelatorios");
  const listaRelatorios = $id("listaRelatorios");

  // HISTÓRICO
  const listaHistorico = $id("listaHistorico");

  // ===== NAVEGAÇÃO ENTRE ABAS =====
  tabBtns.forEach(btn => {
    btn.addEventListener("click", () => {
      const tabName = btn.dataset.tab;
      
      // Remover classe ativo de todos
      tabBtns.forEach(b => b.classList.remove("ativo"));
      tabContents.forEach(c => c.classList.remove("ativo"));

      // Adicionar classe ativo ao clicado
      btn.classList.add("ativo");
      const target = $id(tabName);
      if (target) target.classList.add("ativo");

      if (tabName === "conversas") {
        carregarChats();
      }
      if (tabName === "grupos") {
        carregarGrupos();
      }
      if (tabName === "respostas") {
        carregarRespostas();
      }
      if (tabName === "campanhas") {
        carregarCampanhas();
      }
      if (tabName === "funil") {
        carregarFunil();
      }
      if (tabName === "relatorios") {
        carregarRelatorios();
      }
    });
  });

  // ===== FUNÇÕES GERAIS =====
  function atualizarEstatisticas() {
    totalContatos.textContent = listaContatosGlobal.length;
    totalSelecionados.textContent = contatosSelecionados.length;
    totalEnvios.textContent = historico.obter().length;
  }

  function adicionarContatoGlobal(nome) {
    const contato = typeof nome === "string"
      ? criarContatoPorNomeOuNumero(nome)
      : nome;

    if (!contato) return;

    if (contatosSelecionados.some(c => c.numero === contato.numero)) {
      return;
    }
    contatosSelecionados.push({ ...contato, id: Date.now() });
    atualizarChips();
    atualizarEstatisticas();
  }

  function removerContatoGlobal(id) {
    contatosSelecionados = contatosSelecionados.filter(c => c.id !== id);
    atualizarChips();
    atualizarEstatisticas();
  }

  function atualizarChips() {
    chipContatos.innerHTML = "";

    if (contatosSelecionados.length === 0) {
      chipContatos.innerHTML = '<p class="vazio-chips">Nenhum contato selecionado</p>';
      return;
    }

    contatosSelecionados.forEach(contato => {
      const chip = document.createElement("div");
      chip.className = "chip";
      chip.innerHTML = `
        <span>${contato.nome}${contato.numero ? ` (${contato.numero})` : ""}</span>
        <button class="chip-remove">×</button>
      `;
      chip.querySelector(".chip-remove").addEventListener("click", () => {
        removerContatoGlobal(contato.id);
      });
      chipContatos.appendChild(chip);
    });
  }

  function criarContatoPorNomeOuNumero(valor) {
    const texto = (valor || "").trim();
    if (!texto) return null;
    const somenteNumeros = texto.replace(/\D/g, "");

    const match = listaContatosGlobal.find(c =>
      c.nome.toLowerCase() === texto.toLowerCase() ||
      (c.numero || "") === texto ||
      (c.numero || "").replace(/\D/g, "") === somenteNumeros
    );
    if (match) return match;

    if (somenteNumeros.length >= 10) {
      return { nome: texto, numero: somenteNumeros, id: texto };
    }

    return { nome: texto, numero: "", id: texto };
  }

  function lerArquivoBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const dataUrl = e.target.result || "";
        const [meta, base64] = dataUrl.split(",");
        const mime = (meta.match(/data:(.*);base64/) || [])[1] || file.type;
        resolve({ base64, mime });
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  // ===== PAINEL - CARREGAR CONTATOS =====
  btnAtualizarContatos.addEventListener("click", async () => {
    statusCarregar.textContent = "⏳ Carregando...";
    btnAtualizarContatos.disabled = true;

    try {
      const status = await apiGet("/status");
      if (!status.ready) {
        statusCarregar.textContent = "❌ Backend não autenticado";
        textoConexao.textContent = status.hasQr ? "⚠️ Escaneie o QR" : "❌ Backend offline";
        btnAtualizarContatos.disabled = false;
        return;
      }

      const response = await apiGet("/contacts");
      const contatos = response.contatos || [];

      if (contatos.length > 0) {
        listaContatosGlobal = contatos.map((c) => ({
          nome: c.name || c.number,
          numero: c.number,
          id: c.id
        }));
        statusCarregar.textContent = `✓ ${listaContatosGlobal.length} contatos carregados`;
        textoConexao.textContent = "✅ Backend conectado";
        atualizarEstatisticas();
        renderizarContatos(listaContatosGlobal);
      } else {
        statusCarregar.textContent = "❌ Nenhum contato encontrado";
        textoConexao.textContent = "⚠️ Sem contatos";
      }
    } catch (e) {
      statusCarregar.textContent = "❌ Erro ao conectar no backend";
      textoConexao.textContent = "❌ Backend offline";
    } finally {
      btnAtualizarContatos.disabled = false;
    }
  });

  // ===== PAINEL - MODO WHATSAPP =====
  toggleModoWhatsApp.addEventListener("change", () => {
    modoWhatsAppAtivo = toggleModoWhatsApp.checked;
    textoModoWhatsApp.textContent = modoWhatsAppAtivo ? "Ativado" : "Desativado";

    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs.length === 0) return;
      chrome.tabs.sendMessage(tabs[0].id, { 
        action: "ativarModoSeleção", 
        ativo: modoWhatsAppAtivo 
      });
    });
  });

  // ===== PAINEL - LIMPAR SELEÇÃO =====
  btnLimparSelecao.addEventListener("click", () => {
    contatosSelecionados = [];
    atualizarChips();
    atualizarEstatisticas();
    statusEnvio.textContent = "";
    mensagem.value = "";
    arquivo.value = "";
    nomeArquivo.textContent = "";
  });

  // ===== PAINEL - LIMPAR HISTÓRICO =====
  btnLimparHistorico.addEventListener("click", () => {
    if (confirm("Tem certeza que deseja limpar todo o histórico?")) {
      historico.limpar();
      atualizarEstatisticas();
      listaHistorico.innerHTML = '<p class="vazio">Nenhum envio realizado</p>';
    }
  });

  // ===== CONTATOS - RENDERIZAR LISTA =====
  function renderizarContatos(contatos) {
    listaContatos.innerHTML = "";

    if (contatos.length === 0) {
      listaContatos.innerHTML = '<p class="vazio">Nenhum contato disponível</p>';
      return;
    }

    contatos.forEach(contato => {
      const item = document.createElement("div");
      item.className = "contato-item";
      item.innerHTML = `<div class="contato-nome">${contato.nome}</div><div class="contato-numero">${contato.numero || ""}</div>`;
      item.addEventListener("click", () => {
        adicionarContatoGlobal(contato);
        // Mudar para aba ENVIAR
        tabBtns.forEach(b => {
          if (b.dataset.tab === "enviar") b.click();
        });
      });
      listaContatos.appendChild(item);
    });
  }

  // ===== CONVERSAS =====
  async function carregarChats() {
    try {
      const response = await apiGet("/chats");
      listaChatsGlobal = response.chats || [];
      renderizarChats(listaChatsGlobal);
    } catch (e) {
      listaChats.innerHTML = '<p class="vazio">Erro ao carregar conversas.</p>';
    }
  }

  function renderizarChats(chats) {
    listaChats.innerHTML = "";

    if (!chats.length) {
      listaChats.innerHTML = '<p class="vazio">Nenhuma conversa encontrada.</p>';
      return;
    }

    chats.forEach((chat) => {
      const item = document.createElement("div");
      item.className = "chat-item";
      item.innerHTML = `
        <div class="chat-nome">
          ${chat.name || "Sem nome"}
          ${chat.isGroup ? '<span class="badge-grupo">GRUPO</span>' : ''}
        </div>
        <div class="chat-meta">${chat.lastMessage || ""}</div>
      `;
      item.addEventListener("click", async () => {
        chatSelecionadoId = chat.id;
        chatTitulo.textContent = chat.name || "Sem nome";
        chatSubtitulo.textContent = chat.isGroup ? "Grupo" : "Conversa";
        await carregarMensagens(chat.id);
      });
      listaChats.appendChild(item);
    });
  }

  async function carregarMensagens(chatId) {
    try {
      const response = await apiGet(`/messages?chatId=${encodeURIComponent(chatId)}`);
      const mensagens = response.messages || [];
      renderizarMensagens(mensagens);
    } catch (e) {
      listaMensagens.innerHTML = '<p class="vazio">Erro ao carregar mensagens.</p>';
    }
  }

  function renderizarMensagens(mensagens) {
    listaMensagens.innerHTML = "";
    if (!mensagens.length) {
      listaMensagens.innerHTML = '<p class="vazio">Nenhuma mensagem.</p>';
      return;
    }

    mensagens.forEach((m) => {
      const div = document.createElement("div");
      div.className = `msg ${m.fromMe ? "me" : "other"}`;
      div.textContent = m.body || (m.hasMedia ? "📎 Mídia" : "");
      listaMensagens.appendChild(div);
    });

    listaMensagens.scrollTop = listaMensagens.scrollHeight;
  }

  // ===== CONTATOS - BUSCA =====
  inputBuscaContatos.addEventListener("input", () => {
    const valor = inputBuscaContatos.value.toLowerCase();
    const filtrados = listaContatosGlobal.filter(c => 
      c.nome.toLowerCase().includes(valor) ||
      (c.numero || "").toLowerCase().includes(valor)
    );
    renderizarContatos(filtrados);
  });

  // ===== CONVERSAS - BUSCA E ATUALIZAÇÃO =====
  btnAtualizarChats.addEventListener("click", () => {
    carregarChats();
  });

  inputBuscaChats.addEventListener("input", () => {
    const valor = inputBuscaChats.value.toLowerCase();
    const filtrados = listaChatsGlobal.filter(c =>
      (c.name || "").toLowerCase().includes(valor) ||
      (c.lastMessage || "").toLowerCase().includes(valor)
    );
    renderizarChats(filtrados);
  });

  // ===== ENVIAR - AUTOCOMPLETE =====
  contatoInput.addEventListener("input", () => {
    const valor = contatoInput.value.trim().toLowerCase();

    if (valor.length === 0) {
      listaContatosRapida.classList.remove("ativa");
      return;
    }

    const filtrados = listaContatosGlobal.filter(c =>
      (c.nome.toLowerCase().includes(valor) || (c.numero || "").toLowerCase().includes(valor)) &&
      !contatosSelecionados.some(s => s.numero === c.numero)
    );

    listaContatosRapida.innerHTML = "";

    if (filtrados.length > 0) {
      filtrados.forEach(contato => {
        const div = document.createElement("div");
        div.className = "item-contato-rapido";
        div.textContent = contato.numero ? `${contato.nome} (${contato.numero})` : contato.nome;
        div.addEventListener("click", () => {
          adicionarContatoGlobal(contato);
          contatoInput.value = "";
          listaContatosRapida.classList.remove("ativa");
        });
        listaContatosRapida.appendChild(div);
      });
      listaContatosRapida.classList.add("ativa");
    } else if (valor.length >= 2) {
      const div = document.createElement("div");
      div.className = "item-contato-rapido";
      div.innerHTML = `<strong>➕ Adicionar:</strong> ${valor}`;
      div.addEventListener("click", () => {
        adicionarContatoGlobal(valor);
        contatoInput.value = "";
        listaContatosRapida.classList.remove("ativa");
      });
      listaContatosRapida.appendChild(div);
      listaContatosRapida.classList.add("ativa");
    }
  });

  contatoInput.addEventListener("blur", () => {
    setTimeout(() => {
      listaContatosRapida.classList.remove("ativa");
    }, 200);
  });

  // ===== ENVIAR - ARQUIVO =====
  arquivo.addEventListener("change", (e) => {
    if (e.target.files.length > 0) {
      nomeArquivo.textContent = `📎 ${e.target.files[0].name}`;
    } else {
      nomeArquivo.textContent = "";
    }
  });

  // ===== AUTOMAÇÃO =====
  arquivoAgendado?.addEventListener("change", (e) => {
    if (e.target.files.length > 0) {
      nomeArquivoAgendado.textContent = `📎 ${e.target.files[0].name}`;
    } else {
      nomeArquivoAgendado.textContent = "";
    }
  });

  arquivoCSV?.addEventListener("change", async (e) => {
    if (!e.target.files.length) return;
    const file = e.target.files[0];
    nomeArquivoCSV.textContent = `📄 ${file.name}`;
    const text = await file.text();
    const linhas = text.split(/\r?\n/).filter(Boolean);
    const numeros = linhas
      .flatMap(l => l.split(/[;,\t]/))
      .map(s => s.replace(/\D/g, ""))
      .filter(n => n.length >= 10);
    listaNumeros.value = Array.from(new Set(numeros)).join(", ");
  });

  function carregarTemplates() {
    const templates = JSON.parse(localStorage.getItem("templates_mensagem") || "[]");
    templateSelect.innerHTML = "";
    const empty = document.createElement("option");
    empty.value = "";
    empty.textContent = "Selecionar template";
    templateSelect.appendChild(empty);
    templates.forEach((t, idx) => {
      const opt = document.createElement("option");
      opt.value = idx;
      opt.textContent = t.nome;
      templateSelect.appendChild(opt);
    });
  }

  templateSelect?.addEventListener("change", () => {
    const templates = JSON.parse(localStorage.getItem("templates_mensagem") || "[]");
    const t = templates[templateSelect.value];
    if (t) mensagemAgendada.value = t.texto;
  });

  btnSalvarTemplate?.addEventListener("click", () => {
    const texto = mensagemAgendada.value.trim();
    if (!texto) return;
    const nome = prompt("Nome do template:");
    if (!nome) return;
    const templates = JSON.parse(localStorage.getItem("templates_mensagem") || "[]");
    templates.push({ nome, texto });
    localStorage.setItem("templates_mensagem", JSON.stringify(templates));
    carregarTemplates();
  });

  btnAgendar?.addEventListener("click", async () => {
    const numeros = (listaNumeros.value || "").split(/[,\n]/).map(s => s.replace(/\D/g, "")).filter(Boolean);
    const sendAt = dataHoraEnvio.value;
    const msg = mensagemAgendada.value.trim();
    const file = arquivoAgendado.files[0];

    if (!numeros.length || !sendAt) {
      statusAgendamento.textContent = "❌ Informe números e data/hora";
      statusAgendamento.className = "status-envio erro";
      return;
    }

    try {
      let uploadId = null;
      if (file) {
        const { base64, mime } = await lerArquivoBase64(file);
        const up = await apiPost("/upload", { filename: file.name, base64, mime });
        uploadId = up.id;
      }

      await apiPost("/schedule", { numbers: numeros, message: msg, sendAt, uploadId });
      statusAgendamento.textContent = "✅ Agendado";
      statusAgendamento.className = "status-envio sucesso";
      listaNumeros.value = "";
      mensagemAgendada.value = "";
      arquivoAgendado.value = "";
      nomeArquivoAgendado.textContent = "";
    } catch (e) {
      statusAgendamento.textContent = "❌ Falha ao agendar";
      statusAgendamento.className = "status-envio erro";
    }
  });

  async function carregarAgendamentos() {
    try {
      const response = await apiGet("/schedules");
      const ag = response.schedules || [];
      listaAgendamentos.innerHTML = "";
      if (!ag.length) {
        listaAgendamentos.innerHTML = '<p class="vazio">Nenhum agendamento.</p>';
        return;
      }
      ag.forEach(s => {
        const div = document.createElement("div");
        div.className = "item-historico";
        div.innerHTML = `
          <div class="item-historico-header">
            <span class="item-historico-contato">${s.numbers.length} números</span>
            <span class="item-historico-data">${new Date(s.sendAt).toLocaleString('pt-BR')}</span>
          </div>
          <div class="item-historico-msg">${s.message || "(sem mensagem)"}</div>
          <span class="item-historico-status">${s.status}</span>
        `;
        listaAgendamentos.appendChild(div);
      });
    } catch {
      listaAgendamentos.innerHTML = '<p class="vazio">Erro ao carregar agendamentos.</p>';
    }
  }

  btnAtualizarAgendamentos?.addEventListener("click", carregarAgendamentos);

  // ===== GRUPOS =====
  async function carregarGrupos() {
    try {
      const response = await apiGet("/chats");
      const grupos = (response.chats || []).filter(c => c.isGroup);
      selectGrupo.innerHTML = "";
      grupos.forEach(g => {
        const opt = document.createElement("option");
        opt.value = g.id;
        opt.textContent = g.name || g.id;
        selectGrupo.appendChild(opt);
      });
    } catch {
      // ignore
    }
  }

  btnCriarGrupo?.addEventListener("click", async () => {
    const name = nomeGrupo.value.trim();
    const numbers = (numerosGrupo.value || "").split(/[,\n]/).map(s => s.replace(/\D/g, "")).filter(Boolean);
    if (!name || numbers.length === 0) {
      statusGrupos.textContent = "❌ Informe nome e números";
      statusGrupos.className = "status-envio erro";
      return;
    }
    try {
      await apiPost("/groups/create", { name, numbers });
      statusGrupos.textContent = "✅ Grupo criado";
      statusGrupos.className = "status-envio sucesso";
      nomeGrupo.value = "";
      numerosGrupo.value = "";
      await carregarGrupos();
    } catch {
      statusGrupos.textContent = "❌ Falha ao criar grupo";
      statusGrupos.className = "status-envio erro";
    }
  });

  btnAdicionarGrupo?.addEventListener("click", async () => {
    const chatId = selectGrupo.value;
    const numbers = (numerosGrupoEditar.value || "").split(/[,\n]/).map(s => s.replace(/\D/g, "")).filter(Boolean);
    if (!chatId || numbers.length === 0) {
      statusGrupos.textContent = "❌ Informe grupo e números";
      statusGrupos.className = "status-envio erro";
      return;
    }
    try {
      await apiPost("/groups/add", { chatId, numbers });
      statusGrupos.textContent = "✅ Números adicionados";
      statusGrupos.className = "status-envio sucesso";
    } catch {
      statusGrupos.textContent = "❌ Falha ao adicionar";
      statusGrupos.className = "status-envio erro";
    }
  });

  btnRemoverGrupo?.addEventListener("click", async () => {
    const chatId = selectGrupo.value;
    const numbers = (numerosGrupoEditar.value || "").split(/[,\n]/).map(s => s.replace(/\D/g, "")).filter(Boolean);
    if (!chatId || numbers.length === 0) {
      statusGrupos.textContent = "❌ Informe grupo e números";
      statusGrupos.className = "status-envio erro";
      return;
    }
    try {
      await apiPost("/groups/remove", { chatId, numbers });
      statusGrupos.textContent = "✅ Números removidos";
      statusGrupos.className = "status-envio sucesso";
    } catch {
      statusGrupos.textContent = "❌ Falha ao remover";
      statusGrupos.className = "status-envio erro";
    }
  });

  btnAtualizarGrupos?.addEventListener("click", carregarGrupos);

  // ===== RESPOSTAS =====
  async function carregarRespostas() {
    try {
      const response = await apiGet("/replies");
      const replies = response.replies || [];
      listaRespostas.innerHTML = "";
      if (!replies.length) {
        listaRespostas.innerHTML = '<p class="vazio">Nenhuma resposta registrada.</p>';
        return;
      }
      replies.forEach(r => {
        const div = document.createElement("div");
        div.className = "item-historico";
        div.innerHTML = `
          <div class="item-historico-header">
            <span class="item-historico-contato">${r.from}</span>
            <span class="item-historico-data">${new Date(r.timestamp * 1000 || r.timestamp).toLocaleString('pt-BR')}</span>
          </div>
          <div class="item-historico-msg">${r.body}</div>
        `;
        listaRespostas.appendChild(div);
      });
    } catch {
      listaRespostas.innerHTML = '<p class="vazio">Erro ao carregar respostas.</p>';
    }
  }

  btnAtualizarRespostas?.addEventListener("click", carregarRespostas);

  // ===== CAMPANHAS =====
  async function carregarCampanhas() {
    try {
      const response = await apiGet("/campaigns");
      const campanhas = response.campaigns || [];
      listaCampanhas.innerHTML = "";
      if (!campanhas.length) {
        listaCampanhas.innerHTML = '<p class="vazio">Nenhuma campanha.</p>';
        return;
      }
      campanhas.forEach(c => {
        const div = document.createElement("div");
        div.className = "item-historico";
        div.innerHTML = `
          <div class="item-historico-header">
            <span class="item-historico-contato">${c.name}</span>
            <span class="item-historico-data">${new Date(c.createdAt).toLocaleString('pt-BR')}</span>
          </div>
          <div class="item-historico-msg">${c.message || "(sem mensagem)"}</div>
        `;
        listaCampanhas.appendChild(div);
      });
    } catch {
      listaCampanhas.innerHTML = '<p class="vazio">Erro ao carregar campanhas.</p>';
    }
  }

  btnAtualizarCampanhas?.addEventListener("click", carregarCampanhas);

  btnCriarCampanha?.addEventListener("click", async () => {
    const name = campanhaNome.value.trim();
    const numbers = (campanhaNumeros.value || "").split(/[,\n]/).map(s => s.replace(/\D/g, "")).filter(Boolean);
    const message = campanhaMensagem.value.trim();
    if (!name) {
      statusCampanhas.textContent = "❌ Informe nome";
      statusCampanhas.className = "status-envio erro";
      return;
    }
    try {
      await apiPost("/campaigns", { name, numbers, message });
      statusCampanhas.textContent = "✅ Campanha criada";
      statusCampanhas.className = "status-envio sucesso";
      campanhaNome.value = "";
      campanhaNumeros.value = "";
      campanhaMensagem.value = "";
      carregarCampanhas();
    } catch {
      statusCampanhas.textContent = "❌ Falha ao criar campanha";
      statusCampanhas.className = "status-envio erro";
    }
  });

  // ===== ETIQUETAS =====
  btnCriarTag?.addEventListener("click", async () => {
    const name = tagNome.value.trim();
    if (!name) return;
    try {
      await apiPost("/tags", { name });
      statusTags.textContent = "✅ Etiqueta criada";
      statusTags.className = "status-envio sucesso";
      tagNome.value = "";
    } catch {
      statusTags.textContent = "❌ Falha ao criar etiqueta";
      statusTags.className = "status-envio erro";
    }
  });

  btnAplicarTags?.addEventListener("click", async () => {
    const numbers = (tagNumeros.value || "").split(/[,\n]/).map(s => s.replace(/\D/g, "")).filter(Boolean);
    const tags = (tagLista.value || "").split(/[,\n]/).map(s => s.trim()).filter(Boolean);
    if (!numbers.length || !tags.length) {
      statusTags.textContent = "❌ Informe números e etiquetas";
      statusTags.className = "status-envio erro";
      return;
    }
    try {
      await apiPost("/tags/apply", { numbers, tags });
      statusTags.textContent = "✅ Etiquetas aplicadas";
      statusTags.className = "status-envio sucesso";
    } catch {
      statusTags.textContent = "❌ Falha ao aplicar";
      statusTags.className = "status-envio erro";
    }
  });

  // ===== FUNIL =====
  async function carregarFunil() {
    try {
      const response = await apiGet("/funnel");
      const funnel = response.funnel || {};
      listaFunil.innerHTML = "";
      const entries = Object.entries(funnel);
      if (!entries.length) {
        listaFunil.innerHTML = '<p class="vazio">Sem dados.</p>';
        return;
      }
      entries.forEach(([num, info]) => {
        const div = document.createElement("div");
        div.className = "item-historico";
        div.innerHTML = `
          <div class="item-historico-header">
            <span class="item-historico-contato">${num}</span>
            <span class="item-historico-data">${new Date(info.updatedAt).toLocaleString('pt-BR')}</span>
          </div>
          <div class="item-historico-msg">${info.stage}</div>
        `;
        listaFunil.appendChild(div);
      });
    } catch {
      listaFunil.innerHTML = '<p class="vazio">Erro ao carregar funil.</p>';
    }
  }

  btnAtualizarFunil?.addEventListener("click", async () => {
    const number = funilNumero.value.trim();
    const stage = funilEtapa.value.trim();
    if (!number || !stage) {
      statusFunil.textContent = "❌ Informe número e etapa";
      statusFunil.className = "status-envio erro";
      return;
    }
    try {
      await apiPost("/funnel/update", { number, stage });
      statusFunil.textContent = "✅ Funil atualizado";
      statusFunil.className = "status-envio sucesso";
      funilNumero.value = "";
      funilEtapa.value = "";
      carregarFunil();
    } catch {
      statusFunil.textContent = "❌ Falha ao atualizar";
      statusFunil.className = "status-envio erro";
    }
  });

  btnVerFunil?.addEventListener("click", carregarFunil);

  // ===== RELATÓRIOS =====
  async function carregarRelatorios() {
    try {
      const r = await apiGet("/reports");
      listaRelatorios.innerHTML = `
        <div class="item-historico">
          <div class="item-historico-header">
            <span class="item-historico-contato">Totais</span>
            <span class="item-historico-data">Agora</span>
          </div>
          <div class="item-historico-msg">Enviadas: ${r.totalSent} | Respostas: ${r.totalReplies}</div>
        </div>
      `;
      const byCampaign = r.byCampaign || {};
      Object.keys(byCampaign).forEach((k) => {
        const div = document.createElement("div");
        div.className = "item-historico";
        div.innerHTML = `
          <div class="item-historico-header">
            <span class="item-historico-contato">Campanha: ${k}</span>
          </div>
          <div class="item-historico-msg">Envios: ${byCampaign[k]}</div>
        `;
        listaRelatorios.appendChild(div);
      });
    } catch {
      listaRelatorios.innerHTML = '<p class="vazio">Erro ao carregar relatórios.</p>';
    }
  }

  btnAtualizarRelatorios?.addEventListener("click", carregarRelatorios);

  // ===== ENVIAR - MENSAGEM/ARQUIVO =====
  btnEnviarMensagem.addEventListener("click", async () => {
    if (contatosSelecionados.length === 0) {
      statusEnvio.textContent = "❌ Adicione um contato";
      statusEnvio.className = "status-envio erro";
      return;
    }

    const texto = mensagem.value.trim();
    const file = arquivo.files[0];
    if (!texto && !file) {
      statusEnvio.textContent = "❌ Digite uma mensagem ou selecione um arquivo";
      statusEnvio.className = "status-envio erro";
      return;
    }

    statusEnvio.textContent = `⏳ Enviando para ${contatosSelecionados.length} contato(s)...`;
    statusEnvio.className = "status-envio info";
    btnEnviarMensagem.disabled = true;

    const intervalo = Math.max(0, parseInt(intervaloEnvio.value || "0", 10)) * 1000;

    try {
      let enviados = 0;
      for (let i = 0; i < contatosSelecionados.length; i++) {
        const contato = contatosSelecionados[i];
        const numero = contato.numero || contato.nome;

        if (file) {
          const { base64, mime } = await lerArquivoBase64(file);
          await apiPost("/send-media", {
            number: numero,
            message: texto,
            mediaBase64: base64,
            mimetype: mime,
            filename: file.name
          });
          historico.adicionar(contato.nome || numero, `Arquivo: ${file.name}`, "enviado");
        } else {
          await apiPost("/send", { number: numero, message: texto });
          historico.adicionar(contato.nome || numero, texto, "enviado");
        }

        enviados++;

        statusEnvio.textContent = `✓ Enviado ${enviados}/${contatosSelecionados.length}`;
        statusEnvio.className = "status-envio sucesso";

        if (i < contatosSelecionados.length - 1) {
          await new Promise(r => setTimeout(r, intervalo || 2000));
        }
      }

      statusEnvio.textContent = `✅ ${enviados} envio(s) concluído(s)!`;
      statusEnvio.className = "status-envio sucesso";
      mensagem.value = "";
      arquivo.value = "";
      nomeArquivo.textContent = "";
      contatosSelecionados = [];
      atualizarChips();
      atualizarEstatisticas();
      btnEnviarMensagem.disabled = false;
    } catch (error) {
      statusEnvio.textContent = "❌ " + error.message;
      statusEnvio.className = "status-envio erro";
      btnEnviarMensagem.disabled = false;
    }
  });

  // ===== CONVERSAS - ENVIAR =====
  btnEnviarConversa.addEventListener("click", async () => {
    if (!chatSelecionadoId) {
      statusConversa.textContent = "❌ Selecione uma conversa";
      statusConversa.className = "status-envio erro";
      return;
    }

    const texto = mensagemConversa.value.trim();
    const file = arquivoConversa.files[0];

    try {
      if (file) {
        const { base64, mime } = await lerArquivoBase64(file);
        await apiPost("/send-media", {
          chatId: chatSelecionadoId,
          message: texto,
          mediaBase64: base64,
          mimetype: mime,
          filename: file.name
        });
      } else if (texto) {
        await apiPost("/send", { chatId: chatSelecionadoId, message: texto });
      } else {
        statusConversa.textContent = "❌ Digite uma mensagem ou selecione um arquivo";
        statusConversa.className = "status-envio erro";
        return;
      }

      statusConversa.textContent = "✅ Enviado";
      statusConversa.className = "status-envio sucesso";
      mensagemConversa.value = "";
      arquivoConversa.value = "";
      await carregarMensagens(chatSelecionadoId);
    } catch (e) {
      statusConversa.textContent = "❌ Falha ao enviar";
      statusConversa.className = "status-envio erro";
    }
  });

  // ===== HISTÓRICO - RENDERIZAR =====
  function renderizarHistorico() {
    const dados = historico.obter();
    listaHistorico.innerHTML = "";

    if (dados.length === 0) {
      listaHistorico.innerHTML = '<p class="vazio">Nenhum envio realizado</p>';
      return;
    }

    dados.forEach(item => {
      const div = document.createElement("div");
      div.className = "item-historico";
      div.innerHTML = `
        <div class="item-historico-header">
          <span class="item-historico-contato">${item.contato}</span>
          <span class="item-historico-data">${item.data}</span>
        </div>
        <div class="item-historico-msg">${item.mensagem}</div>
        <span class="item-historico-status">✓ ${item.status}</span>
      `;
      listaHistorico.appendChild(div);
    });
  }

  // ===== INICIALIZAÇÃO =====
  atualizarEstatisticas();
  renderizarHistorico();
  renderizarContatos(listaContatosGlobal);
  carregarTemplates();

  // Carregar contatos automaticamente ao abrir a extensão
  btnAtualizarContatos.click();
})();
};
