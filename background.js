// Service Worker - Background Script
console.log("WhatsApp Web Assistant - Background Service Worker iniciado");

// Listener para mensagens do content script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "getMessage") {
    console.log("Mensagem recebida:", request.data);
    sendResponse({ status: "sucesso", data: request.data });
  }
});

// Monitorar instalação/atualização
chrome.runtime.onInstalled.addListener(() => {
  console.log("Extensão instalada/atualizada com sucesso!");
});

// Abrir a UI em uma aba ao clicar no ícone
chrome.action.onClicked.addListener(async () => {
  try {
    const url = chrome.runtime.getURL("popup.html");
    // Se já existir uma janela popup com o mesmo URL, foca nela
    const windows = await chrome.windows.getAll({ populate: false });
    for (const w of windows) {
      try {
        const winTabs = await chrome.tabs.query({ windowId: w.id });
        if (winTabs && winTabs.length) {
          for (const t of winTabs) {
            if (t.url === url) {
              chrome.windows.update(w.id, { focused: true });
              chrome.tabs.update(t.id, { active: true });
              return;
            }
          }
        }
      } catch (e) {
        // ignore per-window errors
      }
    }

    // Cria uma nova janela popup com tamanho de tela maior
    const width = Math.min(1200, Math.round(screen.availWidth * 0.9));
    const height = Math.min(900, Math.round(screen.availHeight * 0.9));
    const left = Math.max(0, Math.round((screen.availWidth - width) / 2));
    const top = Math.max(0, Math.round((screen.availHeight - height) / 2));

    chrome.windows.create({ url, type: 'popup', width, height, left, top });
  } catch (err) {
    console.error('Erro ao abrir popup como janela:', err);
    const url = chrome.runtime.getURL("popup.html");
    chrome.tabs.create({ url });
  }
});
