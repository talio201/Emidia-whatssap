# Changelog - WhatsApp Web Extension v2.0

## 🎉 Novo - Funcionalidades Implementadas

### 1. **Múltiplos Contatos com Interface de Chips**
- Agora é possível adicionar vários contatos para envio em lote
- Contatos aparecem como "chips" (tags removíveis) na tela de envio
- Clique no "×" em cada chip para remover o contato
- Display mostra quantidade de destinatários

**Como usar:**
1. Clique em um contato na lista OR digite o nome/número no campo "Para:"
2. O contato aparecerá como um chip abaixo do campo de entrada
3. Repita para adicionar mais contatos
4. Clique em "Enviar Mensagem" para enviar para todos

### 2. **Modo Seleção Direta no WhatsApp**
- Novo botão "🟢 Modo WhatsApp" na tela de envio
- Quando ativado, clique diretamente nos contatos no WhatsApp Web
- O nome é automaticamente adicionado aos contatos selecionados
- O botão fica verde (pulsante) quando ativo

**Como usar:**
1. Clique no botão verde "🟢 Modo WhatsApp"
2. O botão ficará mais iluminado e pulsante
3. Vá para a lista de contatos do WhatsApp Web
4. Clique nos contatos que deseja selecionar
5. Volte à extensão - os contatos aparecerão como chips
6. Clique novamente no botão para desativar o modo

### 3. **Intervalo de 5 Segundos Entre Envios**
- Mensagens/arquivos agora são enviados com 5 segundos de intervalo entre cada contato
- Evita bloqueio por spam e garante entrega confiável
- Barra de status mostra progresso: "✓ Enviado 2/5"

**Benefícios:**
- Reduz risco de bloqueio temporário do WhatsApp
- Garante que cada mensagem é processada
- Permite melhor rastreamento de entregas

### 4. **Histórico Persistente de Envios**
- Todos os envios são registrados automaticamente
- Último envio para cada contato é armazenado em localStorage
- Máximo de 50 registros são mantidos para economizar espaço

**Como acessar:**
1. Clique em "📋 Ver Histórico" na tela inicial
2. Veja data/hora, contato e mensagem enviada
3. Ordem: mais recentes primeiro

**Dados armazenados por envio:**
- Contato
- Data e hora (formato brasileiro: DD/MM/YYYY HH:MM:SS)
- Primeiros 100 caracteres da mensagem/arquivo
- Status (enviado/falha)

## 📁 Arquivos Modificados

### popup.js (Versão 2.0)
**Novidades:**
- Classe `GerenciadorHistorico` para gerenciar localStorage
- Array `contatosSelecionados` para rastrear múltiplos contatos
- Função `adicionarContato()` adiciona chip sem substituir anterior
- Função `removerContato()` remove chips individuais
- Função `atualizarChips()` renderiza interface de chips
- Função `renderizarHistorico()` exibe registro de envios
- Modo WhatsApp com `modoWhatsAppAtivo` flag
- Listener global para receber contatos clicados no WhatsApp
- Loop async para envios com delay de 5000ms

### popup.html
**Novidades:**
- `contatosSelecionadosDiv` container para chips
- `chipContatos` div contém os chips renderizados
- `btnModoWhatsApp` botão verde WhatsApp
- `input-contato-wrapper` novo layout para input + botão
- `telaHistorico` nova tela para visualizar histórico
- `btnVerHistorico` botão "Ver Histórico" na tela inicial
- `btnVoltarHistorico` botão voltar da tela de histórico

### popup.css
**Novidades:**
- `.input-contato-wrapper` - flex layout para input e botão
- `.btn-modo-whatsapp` - estilo WhatsApp verde (#25D366)
- `.btn-modo-whatsapp.ativo` - animação pulse quando ativo
- `.chip` - tag removível com estilo moderno
- `.chip-remove` - botão × para remover chip
- `.chipContatos` - flex layout para múltiplos chips
- `.item-historico` - card para cada registro de envio
- `.item-historico-header` - contato + data/hora
- `.item-historico-msg` - preview da mensagem
- `.lista-historico` - container da lista

### content.js
**Novidades:**
- `modoSelecaoAtivo` flag para rastrear modo ativo
- `contatosClicados` Set para rastrear seleções
- `ativarModoSelecaoContatos()` - add event listeners e estilos visuais
- `desativarModoSelecaoContatos()` - remove estilos e listeners
- Handler para `ativarModoSeleção` message do popup
- Click listener em contatos com verificação de modo ativo
- Visual feedback (borda verde, fundo verde ao hover)
- Envia `contatoSelecionado` message de volta para popup

## 🔄 Fluxo de Uso Completo

### Cenário 1: Enviar para múltiplos contatos (da lista)
```
Tela Inicial
  ↓ "Carregar Contatos"
Tela Contatos (lista de contatos)
  ↓ Clica em contato 1
Tela Envio (contato 1 aparece como chip)
  ↓ Clica em outro contato
Tela Envio (contatos 1 e 2 como chips)
  ↓ Digita mensagem
  ↓ Clica "Enviar Mensagem"
Envio sequencial com 5s de delay entre cada
```

### Cenário 2: Enviar usando Modo WhatsApp
```
Tela Envio
  ↓ Clica "🟢 Modo WhatsApp" (fica verde/pulsante)
Clica em contatos no WhatsApp Web
  ↓ Cada clique adiciona como chip e torna contato verde
Desativa "🟢 Modo WhatsApp" quando terminar
  ↓ Digita mensagem
  ↓ Clica "Enviar Mensagem"
Envio sequencial com 5s de delay
```

### Cenário 3: Visualizar histórico
```
Tela Inicial
  ↓ Clica "📋 Ver Histórico"
Tela Histórico
  ↓ Vê lista de envios (mais recentes primeiro)
  ↓ Data/hora, contato, primeiros 100 chars da msg
Clica "Voltar" para sair
```

## 🛠️ Detalhes Técnicos

### Storage (localStorage)
```json
{
  "whatsapp_historico_envios": [
    {
      "id": 1701234567890,
      "contato": "João Silva",
      "mensagem": "Olá, tudo bem? Esta é a primeira...",
      "status": "enviado",
      "data": "08/12/2023 14:30:45"
    }
  ]
}
```

### Message Protocol (popup ↔ content.js)
```javascript
// Ativar modo seleção
{
  action: "ativarModoSeleção",
  ativo: true
}

// Contato selecionado no WhatsApp
{
  action: "contatoSelecionado",
  contato: "João Silva"
}

// Enviar mensagem
{
  action: "enviarMensagem",
  contato: "João Silva",
  mensagem: "Olá!"
}
```

### Delay de Envio
- Loop async/await para cada contato
- 5000ms (5 segundos) entre envios
- Último contato não aguarda delay
- Mensagem de status atualizada em tempo real

## ⚠️ Limitações Conhecidas

1. **Limite de 50 registros**: Histórico mantém apenas últimos 50 envios
2. **Modo WhatsApp só funciona com conversas abertas**: Contatos precisam estar visíveis na lista de conversas
3. **Sem suporte a broadcast lists**: Apenas contatos individuais
4. **Storage limitado**: localStorage tem limite de ~5MB por domínio

## 🚀 Futuras Melhorias Possíveis

- [ ] Integração com Google Contacts
- [ ] Agendamento de envios para hora específica
- [ ] Templates de mensagens reutilizáveis
- [ ] Suporte a envio para broadcast lists
- [ ] Exportar histórico como CSV
- [ ] Estatísticas de envios (gráficos)
- [ ] Sincronização com cloud storage

## 📝 Notas de Desenvolvimento

- Todas as funções possuem logs via `console.log()`
- Tratamento de erros com try/catch em operações críticas
- Validações de entrada (campo vazio, contato duplicado)
- IDs únicos com `Date.now()` para cada seleção
- CSS animations para melhor UX (slideIn 0.2s, pulse 1s)

## 🎓 Como Instalar

1. Clone/baixe os arquivos
2. Abra `chrome://extensions/`
3. Ative "Modo do desenvolvedor" (canto superior direito)
4. Clique "Carregar extensão sem empacotamento"
5. Selecione a pasta do projeto
6. Extensão estará pronta em `web.whatsapp.com`

---

**Versão:** 2.0  
**Data:** Dezembro 2024  
**Status:** Funcional ✅
