# Emidia-whatssap / WhatsApp Web Assistant - Extensão Chrome

![CI](https://github.com/OWNER/REPO/actions/workflows/ci.yml/badge.svg)

Uma extensão Chrome para adicionar funcionalidades extras ao WhatsApp Web, com backend Node.js para automação de mensageria transacional.

## 📋 Estrutura do Projeto

```
├── manifest.json       # Configuração principal da extensão
├── background.js       # Service Worker (background)
├── content.js          # Scripts que rodam no WhatsApp Web
├── popup.html          # Interface do popup
├── popup.js            # Lógica do popup
├── popup.css           # Estilos do popup
├── images/             # Ícones da extensão
├── server/             # Backend Node.js (WhatsApp)
│   ├── index.js        # API e automação WhatsApp
│   ├── package.json    # Dependências backend
│   └── ...
└── README.md           # Este arquivo
```

## 🚀 Como Usar

1. **Abrir Chrome** → `chrome://extensions/`
2. **Ativar "Modo do desenvolvedor"** (canto superior direito)
3. **Clicar em "Carregar extensão sem empacotar"**
4. **Selecionar a pasta** `Extensao-chrome`
5. **Pronto!** A extensão está instalada

## ✨ Funcionalidades Planejadas

- [ ] Auto-resposta automática
- [ ] Agendador de mensagens
- [ ] Backup de conversas
- [ ] Estatísticas de uso
- [ ] Modo escuro
- [ ] Notificações customizadas
- [x] Backend Node.js com anti-fingerprint e robustez

## 🔧 Desenvolvimento

Os arquivos principais são:

- **manifest.json**: Define permissões e configurações
- **background.js**: Roda em background, gerencia eventos globais
- **content.js**: Injeta código no WhatsApp Web
- **popup.html/js/css**: Interface do popup da extensão
- **server/**: Backend Node.js para automação WhatsApp

## 📝 Próximos Passos

1. Criar os ícones (16x16, 48x48, 128x128)
2. Implementar funcionalidades específicas
3. Adicionar testes
4. Publicar na Chrome Web Store
5. Documentar API backend

---

**Versão**: 1.0.0  
**Compatibilidade**: Chrome 88+
