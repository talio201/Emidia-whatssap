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
    // ...continuação do código...
  } catch (e) {
    console.error("Erro ao extrair contatos:", e);
  }
  return contatos;
}
