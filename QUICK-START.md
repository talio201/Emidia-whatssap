# 🚀 Guia Rápido - WhatsApp Web Extension v3.0

## ⚡ 30 Segundos de Uso

```
1. Clique na extensão
2. Contatos carregam automaticamente ✅
3. Escolha contatos (na aba 👥 ou com toggle 🟢)
4. Digite mensagem
5. Clique "Enviar Mensagem"
6. Pronto! 📤
```

---

## 🎮 As 4 Abas Explicadas

### 📊 PAINEL (Abre por padrão)
```
┌─ Status
│  • Contatos: 23
│  • Selecionados: 0
│  • Envios: 5
│
├─ Controles (Grid 2x2)
│  • 🔄 Carregar Agora
│  • 🟢 Modo WhatsApp (ON/OFF)
│  • 🗑️ Limpar Seleção
│  • 🧹 Limpar Histórico
│
└─ Dica: Use o toggle verde para clicar em contatos
```

**Quando usar:** Ver status, recarregar, limpar dados

---

### 👥 CONTATOS
```
┌─ 🔍 Busca
│  (Digite nome ou número)
│
└─ 📋 Lista
   • João Silva
   • Maria Santos
   • Tech Support
   (Clique para adicionar)
```

**Quando usar:** Procurar e selecionar contatos

---

### ✉️ ENVIAR
```
┌─ 📍 Destinatários
│  [João Silva ×] [Maria ×]
│
├─ 🎯 Selecionar
│  [Campo de busca / entrada]
│
├─ ✍️ Mensagem
│  [Textarea grande]
│
├─ 📎 Arquivo (Opcional)
│  [Upload]
│
└─ 🔘 Enviar
   [Enviar Mensagem] [Enviar Arquivo]
```

**Quando usar:** Preparar e enviar mensagens/arquivos

---

### 📋 HISTÓRICO
```
┌─ Últimos 50 envios
│  ┌─ João Silva | 30/01 14:23
│  │  "Olá, tudo bem?"
│  │  ✓ enviado
│  │
│  ├─ Maria Santos | 30/01 14:20
│  │  "Arquivo: documento.pdf"
│  │  ✓ enviado
│  │
│  └─ ...
```

**Quando usar:** Verificar o que foi enviado

---

## 🎯 Modo WhatsApp (Toggle)

### ✅ Ativado (Verde, pulsante)
- Contatos no WhatsApp Web ficam com **borda verde**
- Clique em um contato para adicionar
- Fundo fica levemente verde

### ❌ Desativado (Cinza)
- Contatos no WhatsApp retornam ao normal
- Modo de seleção desativado

```
🟢 MODO WHATSAPP
  [ATIVADO] "Clique nos contatos do WhatsApp"

🔘 MODO WHATSAPP  
  [DESATIVADO]
```

---

## 💭 Perguntas Comuns

### P: Contatos não aparecem?
**R:** 
- Certifique que está em `web.whatsapp.com`
- Clique no botão "🔄 Carregar Agora"
- Recarregue a página do WhatsApp

### P: Modo WhatsApp não funciona?
**R:**
- Ative o toggle (vire para verde)
- Vá para WhatsApp Web em outra janela
- Clique no contato (verá verde)
- Volta para a extensão - chip apareceu

### P: Posso enviar para vários contatos?
**R:** Sim! Clique vários contatos, todos aparecem como chips. Serão enviados com 5s de intervalo cada.

### P: Como limpar tudo?
**R:** Aba Painel → Botão "🗑️ Limpar Seleção"

### P: Onde vejo o que foi enviado?
**R:** Aba "📋 Histórico"

---

## 🎨 Dicas de Design

- **Verde** = ativo/WhatsApp
- **Chip com ×** = clique para remover
- **Toggle ON/OFF** = perfeito para modo WhatsApp
- **Abas sempre visíveis** = acesso rápido

---

## ⚠️ Limitações

- Máximo 50 registros de histórico
- Modo WhatsApp só funciona com conversas abertas
- Sem suporte a broadcast lists
- 5 segundos de delay entre envios (necessário)

---

## 📊 Status Indicadores

```
✅ Conectado        - Extension OK
❌ Sem conexão      - Check WhatsApp Web
⏳ Carregando...     - Aguarde
✓ Enviado 2/5       - Progresso
✅ Concluído        - Tudo OK
❌ Erro             - Veja o status
```

---

**Versão:** 3.0  
**Última atualização:** 30/01/2026  
**Status:** ✅ Funcional
