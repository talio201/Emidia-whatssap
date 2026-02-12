// Content Script - Injeta código no WhatsApp Web
console.log("✓ Content Script carregado no WhatsApp Web");

// State
let isMonitoring = false;
let lastMessageCount = 0;

// Wait for WhatsApp Web to load
function waitForWhatsApp() {
  console.log('⏳ Aguardando WhatsApp Web carregar...');
  return new Promise((resolve) => {
    let attempts = 0;
    const checkInterval = setInterval(() => {
      attempts++;

      // Try multiple selectors
      const mainPanel = document.querySelector('[data-testid="conversation-panel-wrapper"]') ||
        document.querySelector('#app') ||
        document.querySelector('[data-testid="chat-list"]');

      console.log(`🔍 Tentativa ${attempts}: Elemento encontrado? ${!!mainPanel}`);

      if (mainPanel) {
        clearInterval(checkInterval);
        console.log('✅ WhatsApp Web detectado!');
        resolve(true);
      }

      // Timeout after 30 seconds
      if (attempts > 30) {
        clearInterval(checkInterval);
        console.log('⚠️ Timeout esperando WhatsApp Web, continuando mesmo assim...');
        resolve(false);
      }
    }, 1000);
  });
}

// Extract messages from DOM
function extractMessages() {
  const messages = [];

  try {
    const messageDivs = document.querySelectorAll('[data-testid="msg-container"]');

    messageDivs.forEach((msgDiv) => {
      try {
        const textEl = msgDiv.querySelector('.selectable-text');
        const timeEl = msgDiv.querySelector('[data-testid="msg-meta"]');
        const isOutgoing = msgDiv.closest('[data-testid="msg-container"]')?.classList.contains('message-out');

        if (textEl) {
          messages.push({
            text: textEl.textContent,
            time: timeEl ? timeEl.textContent : '',
            isOutgoing: isOutgoing || false,
            timestamp: Date.now()
          });
        }
      } catch (e) {
        // Skip malformed message
      }
    });
  } catch (e) {
    console.error('Erro ao extrair mensagens:', e);
  }

  return messages;
}

// Extract contacts list - FIXED to use span[title]
function extractContacts() {
  console.log("\n=== EXTRAINDO CONTATOS ===");
  const contatos = [];

  try {
    // WhatsApp Web stores contact names in span[title]
    const spanElements = document.querySelectorAll('span[title]');
    console.log(`🔍 Encontrados ${spanElements.length} elementos span[title]`);

    const seen = new Set();

    spanElements.forEach((span) => {
      try {
        const name = span.title.trim();

        // Filter out duplicates and empty titles
        if (name && name.length > 0 && !seen.has(name)) {
          seen.add(name);

          contatos.push({
            name: name,
            timestamp: Date.now()
          });
        }
      } catch (e) {
        // Skip
      }
    });

    console.log(`✅ Extraídos ${contatos.length} contatos únicos`);
    if (contatos.length > 0) {
      console.log(`📋 Primeiros 5: ${contatos.slice(0, 5).map(c => c.name).join(', ')}`);
    }
  } catch (e) {
    console.error("Erro ao extrair contatos:", e);
  }

  return contatos;
}

// Monitor for new messages using MutationObserver
function startMessageMonitoring() {
  if (isMonitoring) return;

  console.log('🔄 Iniciando monitoramento de mensagens...');
  isMonitoring = true;

  const targetNode = document.querySelector('#app');
  if (!targetNode) {
    console.error('Não foi possível encontrar #app');
    return;
  }

  const observer = new MutationObserver((mutationsList) => {
    for (const mutation of mutationsList) {
      if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
        // Check if new message was added
        const messages = extractMessages();

        if (messages.length > lastMessageCount) {
          const newMessages = messages.slice(lastMessageCount);
          console.log('📨 Nova(s) mensagem(ns):', newMessages);

          // Send to background worker
          chrome.runtime.sendMessage({
            action: 'getMessage',
            data: newMessages
          });

          lastMessageCount = messages.length;
        }
      }
    }
  });

  observer.observe(targetNode, {
    childList: true,
    subtree: true
  });

  console.log('✅ Monitoramento de mensagens ativo');
}

// Check authentication status
function checkAuthStatus() {
  const qrCanvas = document.querySelector('canvas[aria-label*="QR"]');
  const isAuthenticated = !qrCanvas;

  return {
    isAuthenticated,
    hasQR: !!qrCanvas
  };
}

// Initialize
async function init() {
  console.log('🚀 Inicializando integração WhatsApp Web...');

  await waitForWhatsApp();
  console.log('✅ WhatsApp Web carregado');

  const authStatus = checkAuthStatus();
  console.log('🔐 Status de autenticação:', authStatus);

  if (authStatus.isAuthenticated) {
    // Poll for contacts instead of fixed timeout
    let attempts = 0;
    const maxAttempts = 10;

    const pollContacts = setInterval(() => {
      attempts++;
      console.log(`📊 Tentativa ${attempts}/${maxAttempts} de extrair contatos...`);

      const contacts = extractContacts();

      if (contacts.length > 0 || attempts >= maxAttempts) {
        clearInterval(pollContacts);

        if (contacts.length > 0) {
          console.log(`✅ Sucesso! ${contacts.length} contatos encontrados`);
          chrome.runtime.sendMessage({
            action: 'getContacts',
            data: contacts
          });
        } else {
          console.warn('⚠️ Nenhum contato encontrado após 10 tentativas');
        }

        // Start monitoring
        startMessageMonitoring();
      }
    }, 1000); // Check every 1 second
  } else {
    console.log('⏳ Aguardando autenticação via QR Code...');

    // Poll for authentication
    const authCheckInterval = setInterval(() => {
      const status = checkAuthStatus();
      if (status.isAuthenticated) {
        clearInterval(authCheckInterval);
        console.log('✅ Autenticação detectada!');
        init(); // Re-initialize after auth
      }
    }, 3000);
  }
}

// Listen for messages from background
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'send_message') {
    console.log('📤 Solicitação para enviar mensagem:', request);
    // TODO: Implement message sending logic
    sendResponse({ status: 'received' });
  }
  return true;
});

// Start initialization
init().catch(console.error);
