// Service Worker - Background Script with WebSocket
console.log("WhatsApp Web Assistant - Background Service Worker iniciado");

let ws = null;
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 5;
const RECONNECT_DELAY = 3000;

// Connect to WebSocket server
function connectWebSocket() {
  if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) {
    return;
  }

  try {
    ws = new WebSocket('ws://localhost:3001');

    ws.onopen = () => {
      console.log('✅ WebSocket conectado ao servidor');
      reconnectAttempts = 0;

      // Notify server about extension connection
      ws.send(JSON.stringify({
        type: 'extension_connected',
        timestamp: Date.now()
      }));
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log('📨 Mensagem do servidor:', data);

        // Forward to content script if needed
        if (data.type === 'send_message') {
          chrome.tabs.query({ url: 'https://web.whatsapp.com/*' }, (tabs) => {
            if (tabs[0]) {
              chrome.tabs.sendMessage(tabs[0].id, data);
            }
          });
        }

        // Store in chrome.storage
        if (data.type === 'sync_data') {
          chrome.storage.local.set({ [data.key]: data.value });
        }
      } catch (e) {
        console.error('Erro ao processar mensagem WebSocket:', e);
      }
    };

    ws.onerror = (error) => {
      console.error('❌ Erro WebSocket:', error);
    };

    ws.onclose = () => {
      console.log('⚠️ WebSocket desconectado');
      ws = null;

      // Reconnect with exponential backoff
      if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
        reconnectAttempts++;
        const delay = RECONNECT_DELAY * Math.pow(2, reconnectAttempts - 1);
        console.log(`🔄 Tentando reconectar em ${delay}ms (tentativa ${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})`);
        setTimeout(connectWebSocket, delay);
      }
    };
  } catch (e) {
    console.error('Erro ao criar WebSocket:', e);
  }
}

// Start WebSocket connection
connectWebSocket();

// Listener para mensagens do content script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "getMessage") {
    console.log("Mensagem recebida do content script:", request.data);

    // Forward to WebSocket server
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({
        type: 'new_message',
        data: request.data,
        timestamp: Date.now()
      }));
    }

    sendResponse({ status: "sucesso", data: request.data });
  }

  if (request.action === "getContacts") {
    console.log("Contatos recebidos:", request.data);

    // Send contacts to server via WebSocket
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({
        type: 'sync_contacts',
        contacts: request.data,
        timestamp: Date.now()
      }));
    }

    // Store locally
    chrome.storage.local.set({ contacts: request.data });
    sendResponse({ status: "sucesso" });
  }

  return true; // Keep channel open for async response
});

// Monitorar instalação/atualização
chrome.runtime.onInstalled.addListener(() => {
  console.log("Extensão instalada/atualizada com sucesso!");

  // Open WhatsApp Web tab if not already open
  chrome.tabs.query({ url: 'https://web.whatsapp.com/*' }, (tabs) => {
    if (tabs.length === 0) {
      chrome.tabs.create({ url: 'https://web.whatsapp.com' });
    }
  });
});

// Abrir a UI em uma aba ao clicar no ícone
chrome.action.onClicked.addListener(async () => {
  try {
    // Check if WhatsApp Web is open
    const tabs = await chrome.tabs.query({ url: 'https://web.whatsapp.com/*' });

    if (tabs.length > 0) {
      // Focus existing WhatsApp Web tab
      await chrome.tabs.update(tabs[0].id, { active: true });
      await chrome.windows.update(tabs[0].windowId, { focused: true });
    } else {
      // Open new WhatsApp Web tab
      await chrome.tabs.create({ url: 'https://web.whatsapp.com' });
    }
  } catch (err) {
    console.error('Erro ao abrir WhatsApp Web:', err);
  }
});
