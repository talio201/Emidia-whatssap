// Content Script - Injeta código no WhatsApp Web
console.log("✓ Content Script carregado no WhatsApp Web");

// Verifica se há mensagem pendente de envio (após recarregamento de página)
if (window.proximaMensagem) {
  console.log("🔄 Detectada mensagem pendente de envio");
  setTimeout(() => {
    enviarMensagemAposPagina(window.proximaMensagem);
    window.proximaMensagem = null;
  }, 2000);
}

// Variável para rastrear modo de seleção
let modoSelecaoAtivo = false;
const contatosClicados = new Set();

// ===== Sidebar embutida =====
function injectSidebar() {
  if (document.getElementById('emidia-sidebar')) return;

  const style = document.createElement('style');
  style.id = 'emidia-sidebar-style';
  style.textContent = `
    #emidia-sidebar { position: fixed; right: 0; top: 0; height: 100vh; width: 420px; max-width: 100vw; z-index: 2147483647; box-shadow: -6px 0 24px rgba(0,0,0,0.24); transition: transform .22s ease; transform: translateX(100%); background: #fff; display: flex; flex-direction: column; }
    #emidia-sidebar.open { transform: translateX(0); }
    #emidia-sidebar.minimized { width: 56px; overflow: hidden; }
    #emidia-sidebar.closed { display: none; }
    #emidia-popup-container { flex: 1; overflow: auto; }
    #emidia-sidebar iframe { width: 100%; height: 100%; border: 0; }
    #emidia-sidebar-toggle { position: fixed; right: 420px; top: 140px; width: 48px; height: 140px; background: linear-gradient(180deg,#25d366,#128c7e); color: #fff; display:flex;align-items:center;justify-content:center;border-radius:8px 0 0 8px; z-index:2147483647; cursor:pointer; box-shadow: -4px 2px 12px rgba(0,0,0,0.18); }
    #emidia-sidebar-toggle.collapsed { right: 0; border-radius: 0 0 0 0; transform: translateX(0); }
    #emidia-sidebar-toggle span { writing-mode: vertical-rl; transform: rotate(180deg); font-weight:700; font-size:13px; }
    .emidia-controls { display:flex; gap:8px; padding:8px; justify-content:flex-end; align-items:center; border-bottom:1px solid rgba(0,0,0,0.06); }
    .emidia-controls button { background: transparent; border: none; font-size:16px; padding:6px 8px; cursor:pointer; border-radius:6px; }
    .emidia-controls button:hover { background: rgba(0,0,0,0.04); }
    @media(max-width:600px){ #emidia-sidebar{width: 100vw;} #emidia-sidebar-toggle{right: calc(100vw - 44px);} }
  `;
  document.head.appendChild(style);

  const toggle = document.createElement('div');
  toggle.id = 'emidia-sidebar-toggle';
  toggle.title = 'Abrir WhatsApp Assistente';
  toggle.innerHTML = `<span>Assistente</span>`;
  document.body.appendChild(toggle);

  const sidebar = document.createElement('div');
  sidebar.id = 'emidia-sidebar';
  // Instead of using an iframe (blocked by Chrome), fetch popup.html and popup.css
  // and inject the markup/styles directly into the page. popup.js will be loaded
  // as a content script (see manifest.json) so it can bind to the injected DOM.
  // helper: try fetch, fallback to XHR (some pages block fetch to chrome-extension://)
  function loadText(url) {
    return new Promise((resolve, reject) => {
      fetch(url).then((r) => r.text()).then(resolve).catch(() => {
        try {
          const xhr = new XMLHttpRequest();
          xhr.open('GET', url, true);
          xhr.onreadystatechange = function () {
            if (xhr.readyState === 4) {
              if (xhr.status === 0 || (xhr.status >= 200 && xhr.status < 300)) {
                resolve(xhr.responseText);
              } else {
                reject(new Error('XHR failed ' + xhr.status));
              }
            }
          };
          xhr.onerror = () => reject(new Error('XHR error'));
          xhr.send();
        } catch (e) {
          reject(e);
        }
      });
    });
  }

  (async () => {
    try {
      const htmlUrl = chrome.runtime.getURL('popup.html');
      const cssUrl = chrome.runtime.getURL('popup.css');
      const [htmlText, cssText] = await Promise.all([loadText(htmlUrl), loadText(cssUrl)]);

      // Parse HTML and extract body content
      const parser = new DOMParser();
      const doc = parser.parseFromString(htmlText, 'text/html');
      const bodyHtml = doc.body ? doc.body.innerHTML : htmlText;

      // Remove any script tags to avoid attempted page-context loads
      const cleaned = bodyHtml.replace(/<script[\s\S]*?<\/script>/gi, '');

      // Inject CSS
      const styleEl = document.createElement('style');
      styleEl.id = 'emidia-popup-css';
      styleEl.textContent = cssText;
      sidebar.appendChild(styleEl);

      // Controls (minimize / close)
      const controls = document.createElement('div');
      controls.className = 'emidia-controls';
      // SVG icons for minimize and close
      controls.innerHTML = `
        <button id="emidia-minimize" title="Minimizar" aria-label="Minimizar">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="3" y="11" width="18" height="2" rx="1" fill="currentColor"/></svg>
        </button>
        <button id="emidia-close" title="Fechar" aria-label="Fechar">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M6 6L18 18M6 18L18 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
        </button>
      `;
      sidebar.appendChild(controls);

      // Create container for popup content
      const container = document.createElement('div');
      container.id = 'emidia-popup-container';
      container.innerHTML = cleaned;
      sidebar.appendChild(container);
      document.body.appendChild(sidebar);
      // state handling (open/minimized/closed)
      const stateKey = 'emidia-sidebar-state';
      const saved = localStorage.getItem(stateKey) || 'open';
      if (saved === 'open') {
        sidebar.classList.add('open');
        toggle.classList.remove('collapsed');
      } else if (saved === 'minimized') {
        sidebar.classList.add('open', 'minimized');
        toggle.classList.remove('collapsed');
      } else if (saved === 'closed') {
        sidebar.classList.add('closed');
        toggle.classList.add('collapsed');
      }

      // wire controls
      document.getElementById('emidia-minimize')?.addEventListener('click', (ev) => {
        ev.stopPropagation();
        const isMin = sidebar.classList.toggle('minimized');
        if (isMin) localStorage.setItem(stateKey, 'minimized');
        else localStorage.setItem(stateKey, 'open');
      });
      document.getElementById('emidia-close')?.addEventListener('click', (ev) => {
        ev.stopPropagation();
        sidebar.classList.remove('open');
        sidebar.classList.add('closed');
        localStorage.setItem(stateKey, 'closed');
        toggle.classList.add('collapsed');
      });

      // Keyboard shortcut: Ctrl/Cmd + Shift + E toggles sidebar
      window.addEventListener('keydown', (ev) => {
        const isMac = navigator.platform.toUpperCase().includes('MAC');
        const mod = isMac ? ev.metaKey : ev.ctrlKey;
        if (mod && ev.shiftKey && (ev.key === 'E' || ev.key === 'e')) {
          ev.preventDefault();
          // reopen if closed
          if (sidebar.classList.contains('closed')) {
            sidebar.classList.remove('closed');
            sidebar.classList.add('open');
            localStorage.setItem(stateKey, 'open');
            toggle.classList.remove('collapsed');
          } else {
            // toggle open/close
            const currentlyOpen = sidebar.classList.toggle('open');
            if (!currentlyOpen) {
              sidebar.classList.add('closed');
              localStorage.setItem(stateKey, 'closed');
              toggle.classList.add('collapsed');
            } else {
              localStorage.setItem(stateKey, 'open');
              toggle.classList.remove('collapsed');
            }
          }
        }
      });
    } catch (err) {
      console.error('Erro ao injetar popup HTML/CSS:', err);
      // fallback: still append empty sidebar so toggle works
      try {
        const msg = document.createElement('div');
        msg.id = 'emidia-error-message';
        msg.style.padding = '16px';
        msg.style.color = '#111';
        msg.style.fontSize = '13px';
        msg.style.lineHeight = '1.4';
        msg.innerHTML = `<strong>Erro ao carregar Assistant</strong><p style="color:#666;margin-top:8px;">${(err && err.message) ? err.message : String(err)}</p><p style="margin-top:8px;color:#666">Abra o console (Option+Cmd+I) e envie os erros para depuração.</p>`;
        sidebar.appendChild(msg);
      } catch (e) {
        // ignore
      }
      document.body.appendChild(sidebar);
    }
  })();

  function toggleSidebar() {
    const stateKey = 'emidia-sidebar-state';
    const opened = sidebar.classList.toggle('open');
    sidebar.classList.remove('closed');
    sidebar.classList.remove('minimized');
    if (!opened) {
      sidebar.classList.add('closed');
      localStorage.setItem(stateKey, 'closed');
      toggle.classList.add('collapsed');
    } else {
      localStorage.setItem(stateKey, 'open');
      toggle.classList.remove('collapsed');
    }
    toggle.title = opened ? 'Fechar Assistente' : 'Abrir Assistente';
  }

  toggle.addEventListener('click', (e) => {
    e.stopPropagation();
    toggleSidebar();
  });

  // close when clicking outside
  window.addEventListener('click', (e) => {
    if (!sidebar.classList.contains('open')) return;
    const rect = sidebar.getBoundingClientRect();
    if (e.clientX < rect.left) {
      sidebar.classList.remove('open');
      toggle.classList.remove('collapsed');
    }
  });
}

  // inject sidebar on load (open by default)
  try {
    injectSidebar();
    // open by default
    const existing = document.getElementById('emidia-sidebar');
    const existingToggle = document.getElementById('emidia-sidebar-toggle');
    if (existing) existing.classList.add('open');
    if (existingToggle) existingToggle.classList.remove('collapsed');
  } catch (e) { console.error('Erro injectSidebar', e); }

// Função auxiliar para debugar estrutura do botão de envio
function debugBotaoEnvio() {
  console.log("🔍 === DEBUG: Estrutura do DOM para envio ===");
  
  // Procura por todos os buttons
  const allButtons = document.querySelectorAll('button');
  console.log(`Total de buttons: ${allButtons.length}`);
  
  allButtons.forEach((btn, idx) => {
    const aria = btn.getAttribute('aria-label') || 'sem aria-label';
    const testid = btn.getAttribute('data-testid') || 'sem data-testid';
    const title = btn.getAttribute('title') || 'sem title';
    const classes = btn.className || 'sem classes';
    
    // Log apenas botões relevantes (com atributos de envio)
    if (aria.toLowerCase().includes('enviar') || 
        aria.toLowerCase().includes('send') ||
        testid.includes('send') ||
        title.toLowerCase().includes('enviar') ||
        title.toLowerCase().includes('send')) {
      console.log(`[${idx}] aria-label="${aria}", data-testid="${testid}", title="${title}", classes="${classes}"`);
    }
  });
  
  // Procura por divs com role="button"
  const divButtons = document.querySelectorAll('div[role="button"]');
  console.log(`\nTotal de div[role="button"]: ${divButtons.length}`);
  
  divButtons.forEach((div, idx) => {
    const aria = div.getAttribute('aria-label') || 'sem aria-label';
    if (aria.toLowerCase().includes('enviar') || aria.toLowerCase().includes('send')) {
      console.log(`[${idx}] div aria-label="${aria}"`);
    }
  });
  
  console.log("=== FIM DEBUG ===\n");
}

// Função para extrair contatos/conversas do DOM do WhatsApp Web
function extrairContatos() {
  console.log("\n=== EXTRAINDO CONTATOS ===");
  const contatos = [];
  
  try {
    console.log("Testando diferentes seletores...");
    
    // Testa vários seletores possíveis
    const seletores = [
      '[role="navigation"]',
      '[role="list"]',
      '[role="main"]',
      'main',
      '.x1n2onr6',  // Classes do WhatsApp
      '[aria-label*="chat"]',
      '[data-testid="chat-list"]'
    ];
    
    let elementoPai = null;
    
    for (let seletor of seletores) {
      const elemento = document.querySelector(seletor);
      if (elemento) {
        console.log("✓ Encontrado:", seletor);
        elementoPai = elemento;
        break;
      }
    }
    
    if (!elementoPai) {
      console.log("Procurando pela estrutura geral...");
      // Debug: mostra a estrutura do body
      console.log("Body HTML (primeiras 2000 chars):", document.body.innerHTML.substring(0, 2000));
      
      // Procura por qualquer elemento que contenha vários span[dir="auto"]
      const todasDivs = document.querySelectorAll('div');
      console.log("Total de divs:", todasDivs.length);
      
      // Encontra a div que tem mais spans[dir="auto"]
      let melhorDiv = null;
      let maxSpans = 0;
      
      todasDivs.forEach(div => {
        const spansNaDiv = div.querySelectorAll('span[dir="auto"]');
        if (spansNaDiv.length > maxSpans && spansNaDiv.length < 100) {
          maxSpans = spansNaDiv.length;
          melhorDiv = div;
        }
      });
      
      if (melhorDiv) {
        console.log("✓ Melhor div encontrada com", maxSpans, "spans");
        elementoPai = melhorDiv;
      }
    }
    
    if (elementoPai) {
      console.log("Extraindo contatos por número...");
      const rows = elementoPai.querySelectorAll('[role="row"]');
      console.log("Total de linhas:", rows.length);

      const contatosEncontrados = new Map();

      const normalizarNumero = (texto) => {
        const digitos = texto.replace(/\D/g, '');
        if (digitos.length < 10) return '';

        // Brasil: 10 ou 11 dígitos (DDD + número)
        if (digitos.length === 10 || digitos.length === 11) {
          return `+55${digitos}`;
        }

        // Já com país (55) e tamanho correto
        if ((digitos.length === 12 || digitos.length === 13) && digitos.startsWith('55')) {
          return `+${digitos}`;
        }

        return '';
      };

      const extrairNomeCurto = (row) => {
        const spans = row.querySelectorAll('span[dir="auto"]');
        const candidatos = [];
        spans.forEach((s) => {
          const t = s.textContent.trim();
          if (!t) return;
          if (t.length > 80) return;
          if (/^[\d:]+$/.test(t)) return;
          if (t.includes('…')) return;
          candidatos.push(t);
        });
        if (!candidatos.length) return '';
        candidatos.sort((a, b) => a.length - b.length);
        return candidatos[0];
      };

      const coletarNumeros = (texto) => {
        const encontrados = (texto.match(/\+?\d[\d\s().-]{8,}\d/g) || [])
          .map((m) => normalizarNumero(m))
          .filter((n) => n);

        // Remove duplicados, mantendo apenas o formato completo
        return Array.from(new Set(encontrados));
      };

      rows.forEach((row, index) => {
        const numerosEncontrados = new Set();

        // 1) Texto visível
        const textoLinha = row.textContent || '';
        coletarNumeros(textoLinha).forEach((n) => numerosEncontrados.add(n));

        // 2) Atributos relevantes (data-id, aria-label, title, etc.)
        const elementos = row.querySelectorAll('[data-id],[data-testid],[aria-label],[title],a[href],span[title]');
        elementos.forEach((el) => {
          const attrs = [
            el.getAttribute('data-id') || '',
            el.getAttribute('data-testid') || '',
            el.getAttribute('aria-label') || '',
            el.getAttribute('title') || '',
            el.getAttribute('href') || ''
          ];
          attrs.forEach((val) => {
            if (!val) return;
            coletarNumeros(val).forEach((n) => numerosEncontrados.add(n));
          });
        });

        if (!numerosEncontrados.size) return;

        const nomeCurto = extrairNomeCurto(row);

        numerosEncontrados.forEach((numero) => {
          if (!contatosEncontrados.has(numero)) {
            contatosEncontrados.set(numero, nomeCurto || numero);
            console.log(`[${index}] ✓ ${numero} ${nomeCurto ? `(${nomeCurto})` : ''}`);
          }
        });
      });

      console.log("Contatos filtrados (por número):", contatosEncontrados.size);

      contatosEncontrados.forEach((nome, numero) => {
        contatos.push({
          id: numero,
          nome: nome,
          numero: numero
        });
      });
    } else {
      console.log("❌ Não foi possível encontrar a lista de chats");
    }
    
  } catch (erro) {
    console.error("❌ Erro ao extrair contatos:", erro);
  }
  
  console.log("=== RESULTADO: " + contatos.length + " contatos ===\n");
  return contatos;
}

// Função para enviar mensagem APÓS uma página recarregar (para números/novas conversas)
function enviarMensagemAposPagina(mensagem) {
  console.log(`📤 [PASSO PÓS-PÁGINA] Tentando enviar: "${mensagem.substring(0, 30)}..."`);
  
  let tentativasChat = 0;
  const maxTentativas = 15; // Mais tentativas pois a página acabou de carregar
  
  const aguardarChat = setInterval(() => {
    tentativasChat++;
    
    const input = document.querySelector('div[contenteditable="true"][data-tab="10"]') ||
                 document.querySelector('[contenteditable="true"][role="textbox"]');
    
    if (input) {
      clearInterval(aguardarChat);
      console.log("✓ [PASSO 2] Chat aberto após página recarregar");
      
      // Inserir texto
      input.focus();
      input.innerHTML = '';
      document.execCommand('insertText', false, mensagem);
      
      console.log(`✓ [PASSO 3] Texto inserido`);
      
      // Procurar botão de envio
      setTimeout(() => {
        const botao = document.querySelector('button[data-tab="11"]') ||
                     document.querySelector('span[data-icon="send"]')?.closest('button') ||
                     document.querySelector('button[aria-label*="Enviar"]') ||
                     document.querySelector('button[aria-label*="Send"]');
        
        if (botao) {
          console.log("✓ [PASSO 4] Botão de envio encontrado");
          botao.click();
          console.log("✓ [PASSO 5] Botão clicado");
          
          setTimeout(() => {
            const inputDepois = document.querySelector('div[contenteditable="true"][data-tab="10"]') ||
                               document.querySelector('[contenteditable="true"][role="textbox"]');
            
            if (!inputDepois || inputDepois.textContent.trim() === '') {
              console.log("✅ [SUCESSO PÓS-PÁGINA] Mensagem enviada!");
            }
          }, 1500);
        } else {
          console.log("❌ Botão de envio não encontrado após página recarregar");
        }
      }, 500);
      
    } else if (tentativasChat > maxTentativas) {
      clearInterval(aguardarChat);
      console.log("❌ Timeout ao esperar chat após página recarregar");
    }
  }, 500);
}

// Função para abrir nova conversa com número via UI do WhatsApp
function abrirNovaConversaComNumero(numero) {
  return new Promise((resolve) => {
    console.log(`📱 Abrindo nova conversa com: ${numero}`);
    
    // Procura pelo botão de nova conversa (ícone +)
    let botaoNovaConversa = null;
    
    // Tenta vários seletores para o botão de nova conversa
    const seletoresBotao = [
      'button[aria-label*="Nova"]',
      'button[aria-label*="New"]',
      'button[aria-label*="Mensagem"]',
      'button[aria-label*="Message"]',
      'div[role="button"][aria-label*="Nova"]',
      'div[role="button"][aria-label*="New"]'
    ];
    
    for (let seletor of seletoresBotao) {
      const btn = document.querySelector(seletor);
      if (btn) {
        botaoNovaConversa = btn;
        console.log(`✓ Botão nova conversa encontrado: ${seletor}`);
        break;
      }
    }
    
    if (!botaoNovaConversa) {
      // Procura por button com ícone de + genérico
      const allButtons = document.querySelectorAll('button');
      for (let btn of allButtons) {
        if (btn.innerHTML.includes('svg') || btn.getAttribute('aria-label')?.includes('+')) {
          // Verifica se é na sidebar (não no chat)
          if (btn.closest('[role="navigation"]') || btn.closest('nav')) {
            botaoNovaConversa = btn;
            console.log("✓ Botão + genérico encontrado na sidebar");
            break;
          }
        }
      }
    }
    
    if (!botaoNovaConversa) {
      console.log("❌ Botão de nova conversa não encontrado");
      resolve(false);
      return;
    }
    
    // Clica no botão
    botaoNovaConversa.click();
    console.log("✓ Clicado no botão de nova conversa");
    
    // Aguarda o campo de busca aparecer (com mais tempo)
    setTimeout(() => {
      console.log("🔍 Procurando campo de busca...");
      
      // Tenta vários seletores para o campo de busca
      const seletoresCampo = [
        'input[type="text"]',
        'input[placeholder*="Buscar"]',
        'input[placeholder*="Search"]',
        'input[placeholder*="Nome"]',
        'input[placeholder*="Telefone"]',
        'input[placeholder*="Name"]',
        'input[placeholder*="Phone"]',
        'input[aria-label*="Buscar"]',
        'input[aria-label*="Search"]',
        '[contenteditable="true"]',
        'div[role="searchbox"]',
        'input[role="textbox"]'
      ];
      
      let campoBusca = null;
      
      for (let seletor of seletoresCampo) {
        const campo = document.querySelector(seletor);
        if (campo && campo.offsetParent !== null) { // Verifica se está visível
          campoBusca = campo;
          console.log(`✓ Campo de busca encontrado: ${seletor}`);
          break;
        }
      }
      
      // Se ainda não encontrou, mostra todos os inputs para debug
      if (!campoBusca) {
        console.log("❌ Campo de busca não encontrado com seletores padrão");
        console.log("🔍 Analisando todos os inputs...");
        
        const allInputs = document.querySelectorAll('input, [contenteditable="true"], [role="textbox"]');
        console.log(`Total de inputs: ${allInputs.length}`);
        
        allInputs.forEach((input, idx) => {
          const tipo = input.getAttribute('type') || input.tagName;
          const placeholder = input.getAttribute('placeholder') || '';
          const ariaLabel = input.getAttribute('aria-label') || '';
          console.log(`[${idx}] ${tipo} | placeholder="${placeholder}" | aria-label="${ariaLabel}"`);
          
          // Tenta usar o primeiro input que não estiver hidden
          if (!campoBusca && input.offsetParent !== null) {
            campoBusca = input;
          }
        });
      }
      
      if (!campoBusca) {
        console.log("❌ Nenhum campo de busca encontrado");
        resolve(false);
        return;
      }
      
      console.log("✓ Campo de busca identificado");
      
      // Digita o número no campo
      campoBusca.focus();
      
      // Limpa o campo primeiro
      campoBusca.value = '';
      campoBusca.textContent = '';
      
      // Insere o número
      campoBusca.value = numero;
      
      // Dispara eventos para o WhatsApp reconhecer a entrada
      campoBusca.dispatchEvent(new Event('input', { bubbles: true }));
      campoBusca.dispatchEvent(new Event('change', { bubbles: true }));
      campoBusca.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
      
      console.log(`✓ Número digitado: ${numero}`);
      
      // Aguarda aparecer o resultado da busca
      setTimeout(() => {
        console.log("🔍 Procurando resultado da busca...");
        
        // Procura por um contato/resultado que contenha o número
        const resultados = document.querySelectorAll('div[role="button"], li, span');
        let resultadoEncontrado = null;
        
        let encontrados = 0;
        for (let resultado of resultados) {
          const texto = resultado.textContent;
          if (texto.includes(numero) || texto.includes(numero.slice(-6)) || texto.includes(numero.slice(0, 6))) {
            encontrados++;
            if (!resultadoEncontrado) {
              resultadoEncontrado = resultado;
              console.log(`✓ Resultado encontrado: ${texto.substring(0, 50)}`);
            }
          }
        }
        
        if (encontrados > 0) {
          console.log(`✓ Total de ${encontrados} resultado(s) encontrado(s)`);
        }
        
        if (resultadoEncontrado) {
          // Clica no resultado mais próximo
          let elementoClicavel = resultadoEncontrado;
          for (let i = 0; i < 5; i++) {
            if (elementoClicavel.getAttribute('role') === 'button' || elementoClicavel.onclick) {
              break;
            }
            elementoClicavel = elementoClicavel.parentElement;
            if (!elementoClicavel) {
              elementoClicavel = resultadoEncontrado;
              break;
            }
          }
          
          elementoClicavel.click();
          console.log("✓ Resultado clicado");
          resolve(true);
        } else {
          console.log("⚠️ Resultado não encontrado, mas continuando...");
          // Tenta pressionar Enter para confirmar
          const enterEvent = new KeyboardEvent('keydown', {
            key: 'Enter',
            code: 'Enter',
            keyCode: 13,
            which: 13,
            bubbles: true
          });
          campoBusca.dispatchEvent(enterEvent);
          console.log("✓ Enter pressionado");
          resolve(true);
        }
      }, 1500);
      
    }, 1500); // Aumentei o tempo de espera
  });
}


// Função para enviar mensagem - REESCRITA COMPLETA
function enviarMensagem(numeroOuNome, mensagem) {
  return new Promise((resolve) => {
    try {
      console.log(`📤 [PASSO 1] Iniciando envio para: "${numeroOuNome}"`);

      const normalizeTexto = (texto) => {
        return texto
          .normalize('NFD')
          .replace(/\p{Diacritic}/gu, '')
          .replace(/\s+/g, ' ')
          .trim()
          .toLowerCase();
      };

      const limparVoce = (texto) => {
        return texto.replace(/\(você\)|\(voce\)/gi, '').trim();
      };

      const obterTituloConversaAtual = () => {
        const header = document.querySelector('header');
        if (!header) return '';
        const candidatos = [];

        const testIds = [
          '[data-testid="conversation-info-header-chat-title"]',
          '[data-testid="chat-title"]'
        ];
        testIds.forEach((sel) => {
          const el = header.querySelector(sel);
          if (el && el.textContent.trim()) candidatos.push(el.textContent.trim());
        });

        const spansTitulo = header.querySelectorAll('span[dir="auto"], [title]');
        spansTitulo.forEach((s) => {
          const t = (s.getAttribute('title') || s.textContent || '').trim();
          if (t) candidatos.push(t);
        });

        const h = header.querySelector('h1, h2');
        if (h && h.textContent.trim()) candidatos.push(h.textContent.trim());

        if (!candidatos.length) return '';
        candidatos.sort((a, b) => b.length - a.length);
        return candidatos[0];
      };
      
      // PASSO 1: Encontrar e clicar no contato
      const containerPrincipal = document.querySelector('.x1n2onr6');
      if (!containerPrincipal) {
        console.log("❌ Container principal não encontrado");
        resolve({ sucesso: false, mensagem: "Container não encontrado" });
        return;
      }
      
      const rows = containerPrincipal.querySelectorAll('[role="row"]');
      let elementoClicavel = null;

      console.log(`🔍 Procurando "${numeroOuNome}" entre ${rows.length} linhas...`);

      const apenasNumeros = numeroOuNome.replace(/\D/g, '');
      const termoNumero = apenasNumeros.length >= 10 ? apenasNumeros : null;

      const extrairCandidatosDaRow = (row) => {
        const spans = row.querySelectorAll('span[dir="auto"]');
        const candidatos = [];
        spans.forEach((s) => {
          const t = s.textContent.trim();
          if (!t) return;
          if (t.length > 80) return;
          if (/^[\d:]+$/.test(t)) return;
          if (t.includes('…')) return;
          candidatos.push(t);
        });
        return candidatos;
      };

      const alvoNormalizado = normalizeTexto(limparVoce(numeroOuNome));

      // 1) Match exato por nome ou número
      for (const row of rows) {
        const candidatos = extrairCandidatosDaRow(row);
        if (!candidatos.length) continue;

        const candidatosNormalizados = candidatos.map((c) => normalizeTexto(limparVoce(c)));
        const matchNome = candidatosNormalizados.includes(alvoNormalizado);
        const matchNumero = termoNumero && candidatos.some((c) => c.replace(/\D/g, '') === termoNumero);

        if (matchNome || matchNumero) {
          elementoClicavel = row;
          console.log(`✓ Match encontrado na linha: "${candidatos[0]}"`);
          break;
        }
      }

      // 2) Fallback: match parcial somente se houver UM único resultado
      if (!elementoClicavel) {
        const alvo = alvoNormalizado;
        const candidatosParciais = [];

        for (const row of rows) {
          const candidatos = extrairCandidatosDaRow(row);
          if (!candidatos.length) continue;

          const candidatosNormalizados = candidatos.map((c) => normalizeTexto(limparVoce(c)));
          if (candidatosNormalizados.some((c) => c.includes(alvo))) {
            candidatosParciais.push({ row, nome: candidatos[0] });
          }
        }

        if (candidatosParciais.length === 1) {
          elementoClicavel = candidatosParciais[0].row;
          console.log(`✓ Match parcial único encontrado: "${candidatosParciais[0].nome}"`);
        }
      }
      
      // Se não encontrou, tenta abrir nova conversa (para números)
      let aberturaNova = false;
      if (!elementoClicavel) {
        console.log(`⚠️ Contato "${numeroOuNome}" não encontrado na lista`);
        
        // Verifica se é um número de telefone
        const apenasNumeros = numeroOuNome.replace(/\D/g, '');
        
        if (apenasNumeros.length >= 10) {
          console.log(`📱 Detectado número de telefone: ${apenasNumeros}`);
          console.log(`🌐 Abrindo nova conversa via UI do WhatsApp...`);
          
          // Armazena a mensagem na janela para usar após a conversa abrir
          window.proximaMensagem = mensagem;
          
          // Chama função para abrir nova conversa
          abrirNovaConversaComNumero(apenasNumeros).then((sucesso) => {
            if (sucesso) {
              console.log("✓ Nova conversa aberta com sucesso");
              // Aguarda um pouco e depois tenta enviar
              setTimeout(() => {
                console.log("🔄 Tentando enviar mensagem...");
                enviarMensagemAposPagina(mensagem);
              }, 2000);
            } else {
              console.log("❌ Falha ao abrir nova conversa");
            }
          });
          
          resolve({ sucesso: true, mensagem: "Abrindo conversa..." });
          return;
          
        } else {
          console.log(`❌ Não é número válido e não encontrado na lista`);
          resolve({ sucesso: false, mensagem: "Contato não encontrado" });
          return;
        }
      } else {
        // Clica no contato encontrado
        elementoClicavel.click();
        console.log("✓ [PASSO 1] Contato clicado");
      }
      
      // PASSO 2: Aguardar chat abrir e pegar input
      let tentativasChat = 0;
      const maxTentativas = 12;
      
      const aguardarChat = setInterval(() => {
        tentativasChat++;
        
        const input = document.querySelector('div[contenteditable="true"][data-tab="10"]') ||
                     document.querySelector('[contenteditable="true"][role="textbox"]');
        
        if (input) {
          const tituloAtual = obterTituloConversaAtual();
          const alvoNormalizado = normalizeTexto(limparVoce(numeroOuNome));
          const tituloNormalizado = normalizeTexto(limparVoce(tituloAtual));
          const tituloNumero = tituloAtual.replace(/\D/g, '');
          const alvoNumero = apenasNumeros.length >= 10 ? apenasNumeros : '';

          if (!tituloAtual) {
            console.log("⏳ [PASSO 2] Header ainda não carregou o título, aguardando...");
            if (tentativasChat === 3 || tentativasChat === 6) {
              if (elementoClicavel) {
                elementoClicavel.scrollIntoView({ block: 'center' });
                elementoClicavel.click();
                console.log("↻ Re-clicando no contato para forçar abertura da conversa...");
              }
            }
            if (tentativasChat >= maxTentativas) {
              clearInterval(aguardarChat);
              resolve({ sucesso: false, mensagem: "Título não carregou" });
            }
            return;
          }

          const matchTitulo = tituloNormalizado === alvoNormalizado ||
            (alvoNumero && tituloNumero === alvoNumero);

          if (!matchTitulo) {
            console.log(`⚠️ [PASSO 2] Chat aberto, mas título não corresponde. Atual="${tituloAtual}"`);
            if (tentativasChat === 3 || tentativasChat === 6) {
              if (elementoClicavel) {
                elementoClicavel.scrollIntoView({ block: 'center' });
                elementoClicavel.click();
                console.log("↻ Re-clicando no contato para garantir conversa correta...");
              }
            }
            if (tentativasChat >= maxTentativas) {
              clearInterval(aguardarChat);
              resolve({ sucesso: false, mensagem: "Conversa incorreta aberta" });
            }
            return;
          }

          clearInterval(aguardarChat);
          console.log("✓ [PASSO 2] Chat correto aberto, input encontrado");
          
          // PASSO 3: Inserir texto no input de forma NATIVA
          input.focus();
          
          // Método 1: Usar execCommand (mais confiável)
          input.innerHTML = '';
          document.execCommand('insertText', false, mensagem);
          
          console.log(`✓ [PASSO 3] Texto inserido: "${mensagem.substring(0, 30)}..."`);
          
          // PASSO 4: Aguardar e procurar botão de envio
          setTimeout(() => {
            console.log("🔍 [PASSO 4] Enviando mensagem via tecla Enter...");
            
            // Encontra o input
            const input = document.querySelector('div[contenteditable="true"][data-tab="10"]') ||
                         document.querySelector('[contenteditable="true"][role="textbox"]');
            
            if (!input) {
              console.log("❌ Input não encontrado");
              resolve({ sucesso: false, mensagem: "Input não encontrado" });
              return;
            }
            
            // Foca no input
            input.focus();
            
            // Cria evento de Enter
            const enterEvent = new KeyboardEvent('keydown', {
              key: 'Enter',
              code: 'Enter',
              keyCode: 13,
              which: 13,
              bubbles: true,
              cancelable: true
            });
            
            // Dispara o evento
            input.dispatchEvent(enterEvent);
            console.log("✓ [PASSO 4] Enter pressionado");
            
            // Alternativa: tenta também KeyboardEvent com variações
            setTimeout(() => {
              const enterEventUp = new KeyboardEvent('keyup', {
                key: 'Enter',
                code: 'Enter',
                keyCode: 13,
                which: 13,
                bubbles: true
              });
              input.dispatchEvent(enterEventUp);
              console.log("✓ [PASSO 5] KeyUp disparado");
              
              // PASSO 6: Monitorar se mensagem foi realmente enviada
              setTimeout(() => {
                // Verifica se o input está vazio (sinal de envio)
                const inputDepois = document.querySelector('div[contenteditable="true"][data-tab="10"]') ||
                                   document.querySelector('[contenteditable="true"][role="textbox"]');
                
                const estaVazio = !inputDepois || inputDepois.textContent.trim() === '';
                
                // Verifica se há mensagens no chat (bolhas de mensagem)
                const mensagens = document.querySelectorAll('div[class*="message"]');
                const ultimaMensagem = mensagens[mensagens.length - 1];
                const textoUltima = ultimaMensagem ? ultimaMensagem.textContent : '';
                
                console.log(`🔍 [PASSO 6] Verificando envio:`);
                console.log(`   - Input vazio: ${estaVazio}`);
                console.log(`   - Total mensagens: ${mensagens.length}`);
                console.log(`   - Última mensagem contém texto: ${textoUltima.includes(mensagem.substring(0, 20))}`);
                
                if (estaVazio) {
                  console.log("✅ [SUCESSO] Mensagem enviada! (input limpo)");
                  resolve({ sucesso: true, mensagem: "Mensagem enviada!" });
                } else {
                  console.log("⚠️ [AVISO] Input não está vazio, mas considerando enviado");
                  resolve({ sucesso: true, mensagem: "Mensagem enviada (verificação pendente)" });
                }
              }, 1500); // Aguarda 1.5s para verificar
            }, 100);
            
          }, 500);
          
        } else if (tentativasChat > maxTentativas) {
          clearInterval(aguardarChat);
          console.log("❌ [ERRO] Timeout ao abrir chat");
          resolve({ sucesso: false, mensagem: "Timeout ao abrir chat" });
        }
      }, 500);
      
    } catch (e) {
      console.error("❌ [ERRO FATAL]", e);
      resolve({ sucesso: false, mensagem: "Erro: " + e.message });
    }
  });
}

// Função para enviar arquivo
function enviarArquivo(numeroOuNome, arquivoData) {
  try {
    // Encontra e clica no contato
    const conversas = document.querySelectorAll('[data-testid="chat-list-item"]');
    
    conversas.forEach((conversa) => {
      const nomeElement = conversa.querySelector('[dir="auto"]');
      const nome = nomeElement ? nomeElement.textContent.trim() : "";
      
      if (nome === numeroOuNome) {
        conversa.click();
      }
    });
    
    setTimeout(() => {
      // Procura o botão de anexar
      const botaoAnexar = document.querySelector('button[aria-label*="Anexar"]') ||
                         document.querySelector('button[aria-label*="attach"]');
      
      if (botaoAnexar) {
        botaoAnexar.click();
        return { sucesso: true, mensagem: "Clique no botão de anexar para enviar o arquivo" };
      }
      return { sucesso: false, mensagem: "Botão de anexar não encontrado" };
    }, 500);
    
  } catch (e) {
    console.error("Erro ao enviar arquivo:", e);
    return { sucesso: false, mensagem: "Erro ao enviar arquivo" };
  }
}

// Listener para mensagens do popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log("Mensagem recebida:", request.action);
  
  if (request.action === "obterContatos") {
    const contatos = extrairContatos();
    console.log("Enviando contatos:", contatos);
    sendResponse({ sucesso: true, contatos });
    return true; // Importante: mantém o canal aberto
  } 
  else if (request.action === "enviarMensagem") {
    // Como enviarMensagem é async (Promise), precisa de tratamento especial
    enviarMensagem(request.contato, request.mensagem).then((resultado) => {
      sendResponse(resultado);
    }).catch((erro) => {
      sendResponse({ sucesso: false, mensagem: "Erro: " + erro.message });
    });
    return true; // CRÍTICO: mantém canal aberto para resposta async
  }
  else if (request.action === "enviarArquivo") {
    const resultado = enviarArquivo(request.contato, request.arquivo);
    sendResponse(resultado);
    return true;
  }
  else if (request.action === "ativarModoSeleção") {
    modoSelecaoAtivo = request.ativo;
    if (modoSelecaoAtivo) {
      ativarModoSelecaoContatos();
    } else {
      desativarModoSelecaoContatos();
    }
    sendResponse({ sucesso: true });
    return true;
  }
  
  return false; // Se não reconhecer a action, fecha o canal
});

// Função para ativar modo de seleção de contatos
let clickListenersAtivos = false;

function ativarModoSelecaoContatos() {
  console.log("🎯 Ativando modo de seleção de contatos");
  
  if (clickListenersAtivos) {
    console.log("Listeners já estão ativos");
    return;
  }
  
  // Usa a mesma estratégia de extrairContatos
  const containerPrincipal = document.querySelector('.x1n2onr6');
  if (!containerPrincipal) {
    console.log("❌ Container principal não encontrado");
    return;
  }
  
  // Procura por todos os span[dir="auto"]
  const spans = containerPrincipal.querySelectorAll('span[dir="auto"]');
  console.log(`Encontrados ${spans.length} spans, procurando elementos clicáveis...`);
  
  const elementosUnicos = new Set();
  
  // Para cada span, encontra seu elemento "clicável" pai
  spans.forEach((span, idx) => {
    const texto = span.textContent.trim();
    
    // Filtra spans vazios ou muito curtos
    if (!texto || texto.length < 2 || texto.length > 100) return;
    
    // Encontra o elemento clicável pai
    let elemento = span;
    for (let i = 0; i < 10; i++) {
      elemento = elemento.parentElement;
      if (!elemento) break;
      
      // Procura por um elemento que pareça clicável
      if (elemento.onclick || 
          elemento.getAttribute('role') === 'button' ||
          elemento.getAttribute('role') === 'link' ||
          elemento.className.includes('clickable') ||
          elemento.style.cursor === 'pointer' ||
          (elemento.tagName === 'DIV' && i >= 3)) { // DIV mais profundo
        
        // Verifica se já não temos este elemento
        if (!elementosUnicos.has(elemento)) {
          elementosUnicos.add(elemento);
        }
        break;
      }
    }
  });
  
  console.log(`Preparando ${elementosUnicos.size} elementos para seleção`);
  
  // Agora adiciona listeners a cada elemento único
  elementosUnicos.forEach((elemento, idx) => {
    // Remove listeners anteriores
    const novoElemento = elemento.cloneNode(true);
    elemento.parentNode.replaceChild(novoElemento, elemento);
    
    // Adiciona efeito visual
    novoElemento.style.cursor = "pointer";
    novoElemento.style.border = "2px solid transparent";
    novoElemento.style.borderRadius = "8px";
    novoElemento.style.transition = "border-color 0.2s, background-color 0.2s";
    
    // Hover para destacar
    novoElemento.addEventListener("mouseenter", function() {
      if (modoSelecaoAtivo) {
        this.style.borderColor = "#25D366";
        this.style.backgroundColor = "rgba(37, 211, 102, 0.1)";
      }
    });
    
    novoElemento.addEventListener("mouseleave", function() {
      this.style.borderColor = "transparent";
      this.style.backgroundColor = "";
    });
    
    // Click para selecionar
    novoElemento.addEventListener("click", function(e) {
      if (!modoSelecaoAtivo) return;
      
      e.preventDefault();
      e.stopPropagation();
      
      // Procura o nome dentro deste elemento
      const spanNoElemento = this.querySelector('span[dir="auto"]');
      let nome = "Desconhecido";
      
      if (spanNoElemento) {
        nome = spanNoElemento.textContent.trim();
      }
      
      console.log("✓ Contato clicado:", nome);
      
      // Envia para popup
      chrome.runtime.sendMessage({
        action: "contatoSelecionado",
        contato: nome
      }, (response) => {
        // Ignora erro se o popup foi fechado
        if (chrome.runtime.lastError) {
          // Não loga erro - é normal quando popup fecha
          return;
        }
        console.log("Contato enviado com sucesso");
      });
      
      // Animação visual
      this.style.backgroundColor = "#25D366";
      setTimeout(() => {
        this.style.backgroundColor = "rgba(37, 211, 102, 0.1)";
      }, 200);
    });
  });
  
  clickListenersAtivos = true;
}

// Função para desativar modo de seleção
function desativarModoSelecaoContatos() {
  console.log("Desativando modo de seleção de contatos");
  
  const conversas = document.querySelectorAll('[data-testid="chat-list-item"]');
  conversas.forEach((conversa) => {
    conversa.style.cursor = "default";
    conversa.style.border = "";
    conversa.style.backgroundColor = "";
  });
  
  clickListenersAtivos = false;
}

console.log("✓ Content Script pronto para comunicação");
