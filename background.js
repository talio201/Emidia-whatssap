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
  const url = chrome.runtime.getURL("popup.html");
  const tabs = await chrome.tabs.query({ url });
  if (tabs && tabs.length > 0) {
    chrome.tabs.update(tabs[0].id, { active: true });
    return;
  }
  chrome.tabs.create({ url });
});
