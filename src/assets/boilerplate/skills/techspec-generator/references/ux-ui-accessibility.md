# Usabilidade, Acessibilidade e Design de Interfaces

Referência técnica para design de frontend, usabilidade e acessibilidade ao gerar Tech Specs.

## Sumário

1. [Princípios de Usabilidade](#1-principios-de-usabilidade)
2. [Acessibilidade (a11y)](#2-acessibilidade-a11y)
3. [Design de Componentes](#3-design-de-componentes)
4. [Estados de UI](#4-estados-de-ui)
5. [Formulários](#5-formularios)
6. [Layout e Responsividade](#6-layout-e-responsividade)
7. [Performance Percebida](#7-performance-percebida)
8. [Interações e Feedback](#8-interacoes-e-feedback)
9. [Checklist de UI/UX para TechSpec](#9-checklist-de-uiux-para-techspec)

---

## 1. Princípios de Usabilidade

### 1.1. Heurísticas de Nielsen (Aplicadas à TechSpec)

| Heurística | O que especificar | Exemplo |
|:---|:---|:---|
| **Visibilidade do estado** | Loading, progresso, sucesso, erro | Skeleton screen durante carregamento |
| **Correspondência com o mundo real** | Linguagem do usuário, não técnica | "Seu pedido foi enviado" vs "Status: SHIPPED" |
| **Controle do usuário** | Undo, cancelar, voltar | Botão "Cancelar pedido" com confirmação |
| **Consistência** | Seguir design system existente | Usar componentes do shadcn-vue do projeto |
| **Prevenção de erros** | Validação antes do submit | Desabilitar botão se formulário inválido |
| **Reconhecimento vs recall** | Mostrar opções, não exigir memorização | Dropdown com sugestões de busca |
| **Flexibilidade** | Atalhos para usuários avançados | Keyboard shortcuts (Ctrl+N para novo) |
| **Design minimalista** | Apenas informação necessária | Formulário em etapas (wizard) para dados longos |
| **Recuperação de erros** | Mensagens claras com ação de correção | "Email inválido. Verifique se digitou corretamente." |
| **Ajuda e documentação** | Tooltips, empty states com orientação | "Nenhum pedido encontrado. Clique aqui para criar." |

### 1.2. O que Especificar na TechSpec (Frontend)

Para cada tela/view/componente da feature:

```
Tela: [Nome da Tela]
Rota: /orders/new
Componentes: OrderForm, ProductSearch, CartSummary, AddressForm
Design System: shadcn-vue (conforme padrão do projeto)
Layout: DashboardLayout > PageContainer > OrderForm

Estados:
- Empty: "Adicione produtos ao seu pedido"
- Loading: Skeleton nos cards de produto
- Error: Toast de erro + botão "Tentar novamente"
- Success: Redirect para /orders/{id} com toast "Pedido criado!"

Validações:
- Produto: obrigatório, quantidade >= 1
- Endereço: CEP válido (busca automática via API)
- Submit: desabilitado até formulário válido

Acessibilidade:
- Formulário com fieldset e legend
- Labels visíveis para todos os inputs
- Erros com aria-describedby
- Focus no primeiro campo inválido após submit
```

---

## 2. Acessibilidade (a11y)

### 2.1. WCAG 2.1 - Nível AA (Mínimo Esperado)

**Princípio: Perceptível**
| Critério | O que especificar | Como verificar |
|:---|:---|:---|
| Texto alternativo | Imagens com `alt` descritivo | Screen reader lê descrição |
| Mídia time-based | Legendas em vídeos (se aplicável) | Legendas sincronizadas |
| Contraste | Mínimo 4.5:1 para texto normal, 3:1 para texto grande | Ferramenta de contraste |
| Texto redimensionável | Funciona até 200% zoom | Zoom do navegador |
| Conteúdo adaptável | Layout responsivo sem perda de informação | Testar em mobile |

**Princípio: Operável**
| Critério | O que especificar | Como verificar |
|:---|:---|:---|
| Teclado | Todos os controles acessíveis via Tab | Navegar sem mouse |
| Tempo suficiente | Sem time limits ou com opção de estender | Usuário controla tempo |
| Flash | Sem conteúdo que pisca > 3x/segundo | Sem risco de convulsão |
| Navegação | Skip links, landmarks, breadcrumbs | Tab pula para conteúdo |
| Input modal | Focus trap em modais/diálogos | Tab não sai do modal |

**Princípio: Compreensível**
| Critério | O que especificar | Como verificar |
|:---|:---|:---|
| Idioma | `<html lang="pt-BR">` | Screen reader usa idioma correto |
| Previsível | Navegação consistente, sem mudanças inesperadas | Mesmo padrão em todas as páginas |
| Assistência | Labels, instruções, sugestões de erro | Formulário guiado |

**Princípio: Robusto**
| Critério | O que especificar | Como verificar |
|:---|:---|:---|
| Compatível | HTML semântico, ARIA correto | Validação W3C + screen reader |

### 2.2. ARIA Patterns Essenciais

**Landmarks:**
```html
<header role="banner">
<nav role="navigation" aria-label="Menu principal">
<main role="main">
<aside role="complementary">
<footer role="contentinfo">
```

**Formulários acessíveis:**
```html
<label for="email">Email</label>
<input id="email" type="email" name="email" autocomplete="email"
       aria-required="true"
       aria-describedby="email-error"
       placeholder="usuario@exemplo.com…" />
<span id="email-error" role="alert">Email inválido. Verifique se digitou corretamente.</span>
```

**Estados dinâmicos:**
```html
<button aria-expanded="false" aria-controls="dropdown-menu">
  Opções
</button>
<div id="dropdown-menu" role="listbox">
  <div role="option" aria-selected="true">Opção 1</div>
</div>
```

**Loading/Progresso:**
```html
<div role="status" aria-live="polite">
  <div class="skeleton-card" aria-hidden="true">
    <!-- Skeleton visual placeholder -->
  </div>
  <span class="sr-only">Carregando pedidos…</span>
</div>
<div role="progressbar" aria-valuenow="60" aria-valuemin="0" aria-valuemax="100">
  60%
</div>
```

**Modais:**
```html
<div role="dialog" aria-modal="true" aria-labelledby="dialog-title">
  <h2 id="dialog-title">Confirmar exclusão</h2>
  <button>Cancelar</button>
  <button>Confirmar</button>
</div>
```

### 2.3. Especificação na TechSpec

```
Acessibilidade:
- Nível WCAG: AA (mínimo)
- HTML semântico com landmarks (nav, main, aside)
- Todos os inputs com label visível e aria-describedby para erros
- Focus trap em modais (Dialog component do shadcn)
- Navegação por teclado: Tab para campos, Enter para submit, Esc para fechar modal
- aria-live="polite" para feedback de ações (toast)
- Skip link para pular navegação
- Contraste: seguir tokens do design system (≥ 4.5:1)
- Testar com: VoiceOver (Mac) ou NVDA (Windows)
```

---

## 3. Design de Componentes

### 3.1. Hierarquia de Componentes

```
Layout (global)
└── Page (route-specific)
    ├── Header (page title, actions)
    ├── Content (main content area)
    │   ├── Section (logical group)
    │   │   ├── Card (container)
    │   │   │   ├── Form (data entry)
    │   │   │   │   ├── Field (input + label + error)
    │   │   │   │   └── Actions (submit, cancel)
    │   │   │   └── Display (read-only data)
    │   │   └── Table (list data)
    │   └── EmptyState (no data)
    └── Footer (pagination, summary)
```

### 3.2. Composição com Design System

**Verificar biblioteca de UI existente no projeto:**

| Biblioteca | Componente de Botão | Componente de Input |
|:---|:---|:---|
| shadcn-vue | `<Button variant="default">` | `<Input />` |
| shadcn-ui | `<Button>` | `<Input />` |
| MUI | `<Button variant="contained">` | `<TextField>` |
| PrimeVue | `<Button label="OK">` | `<InputText>` |
| Vuetify | `<v-btn color="primary">` | `<v-text-field>` |

**Na TechSpec, especificar:**
```
Biblioteca UI: shadcn-vue (padrão do projeto, conforme package.json)
Componentes utilizados:
- Button (submit, cancel, delete)
- Input (text fields)
- Select (dropdown de status)
- Dialog (confirmação de exclusão)
- Table (listagem de pedidos)
- Toast (feedback de ações)
- Card (container de seções)
```

### 3.3. Componentes por Feature

Para cada feature, especificar componentes necessários:

```
Novos componentes:
- OrderForm.vue (formulário de criação de pedido)
  Props: customerId, products[]
  Events: submit(orderData), cancel()
  Dependências: ProductSearch, CartSummary, AddressForm

- ProductSearch.vue (busca de produtos com autocomplete)
  Props: []
  Events: select(product)
  State: loading, results[], searchTerm

- OrderStatusBadge.vue (badge de status com cor)
  Props: status (PENDING | PAID | CANCELLED)
  Render: cor condicional (PENDING=yellow, PAID=green, CANCELLED=red)

Componentes reutilizados:
- Card (shadcn) para containers
- Table (shadcn) para listagens
- Dialog (shadcn) para confirmações
- Toast (shadcn) para feedback
```

---

## 4. Estados de UI

### 4.1. Estados Obrigatórios

Para cada tela/componente que faz requisição:

| Estado | O que mostrar | Implementação |
|:---|:---|:---|
| **Initial** | Tela inicial sem dados carregados | Buscar dados no mount |
| **Loading** | Indicador visual de carregamento | Skeleton screen (preferido) ou Spinner |
| **Empty** | Estado quando não há dados | Ilustração + mensagem + CTA |
| **Success** | Dados carregados com sucesso | Renderizar dados |
| **Error** | Falha ao carregar dados | Mensagem + botão retry |
| **Partial** | Alguns dados carregados, outros não | Mostrar disponíveis, loading nos outros |

### 4.2. Skeleton Screens

```
Loading state: Skeleton screen
- Usar componente Skeleton do shadcn
- Replicar layout da tela final com placeholders
- Animação sutil (pulse)
- Timeout: após 10s, mostrar mensagem "Carregando..."
- Após 30s: mostrar error state com retry
```

### 4.3. Empty States

```
Empty state para listagens:
- Ícone/ilustração representativa
- Título: "Nenhum pedido encontrado"
- Descrição: "Crie seu primeiro pedido para começar."
- CTA: Botão "Criar Pedido" → navega para /orders/new
- Secondary action (opcional): Link para documentação/ajuda
```

### 4.4. Exemplo Completo de Especificação de Tela

Para cada tela, especificar todos os estados integrados:

```
Tela: Listagem de Pedidos
Rota: /orders
Componente: OrderListPage

Estados de UI:
- Initial → Loading: Skeleton com aria-live="polite" e aria-hidden nos placeholders
- Loading → Success: Renderizar tabela de pedidos
- Loading → Error: "Falha ao carregar pedidos." + botão retry
- Success + vazio → Empty: "Nenhum pedido encontrado." + CTA "Criar Pedido"

Formulário de busca (se aplicável):
- Input com autocomplete="off", debounce 300ms, placeholder "Busque por nome, ID…"
- Resultados atualizam com aria-live="polite"

Acessibilidade:
- Skip link para pular navegação
- Tabela com <thead>/<tbody> semânticos
- Ações com <button>, não <div onClick>
- Paginação com <nav aria-label="Paginação">
```

---

## 5. Formulários

### 5.1. Padrão de Formulário

```
Formulário: OrderForm
Framework: useForm (Vue Use) ou React Hook Form (conforme projeto)
Validação: Zod schema (conforme projeto)

Campos:
| Campo | Tipo | Validação | autocomplete | Máscara |
|:---|:---|:---|:---|:---|
| email | email | obrigatório, formato email | email | - |
| phone | tel | obrigatório, 11 dígitos | tel | (00) 00000-0000 |
| zip_code | text | obrigatório, 8 dígitos | postal-code | 00000-000 |
| quantity | number | obrigatório, >= 1, <= 999 | off | - |
| password | password | obrigatório, min 8 chars | off | - |
| notes | textarea | opcional, max 500 chars | off | - |

Nota: Use `autocomplete="off"` em campos não-auth (como notas, CPF) para evitar trigger de password managers.

Comportamento:
- Validação: inline em blur (não em tempo real, para não irritar)
- Submit: validar tudo antes, scroll para primeiro erro
- Submitting: botão com loading state, desabilitado
- Success: redirect + toast
- Error: toast com mensagem específica
```

### 5.2. Feedback de Validação

```
Estados de campo:
- Pristine: sem indicação visual (ainda não interagiu)
- Valid: borda verde (sutil), ícone check
- Invalid: borda vermelha, mensagem de erro abaixo do campo
- Disabled: visualmente distinto, sem interação

Mensagem de erro:
- Posição: abaixo do campo, alinhado à esquerda
- Cor: vermelho (conforme token do design system)
- Texto: específico ("Email é obrigatório" vs "Campo obrigatório")
- Icone: indicação visual além de cor
```

---

## 6. Layout e Responsividade

### 6.1. Breakpoints

| Breakpoint | Largura | Layout | Colunas |
|:---|:---|:---|:---|
| **Mobile** | < 640px | Stack vertical | 1 coluna |
| **Tablet** | 640px - 1024px | Hybrid | 2 colunas |
| **Desktop** | 1024px+ | Layout completo | 3-4 colunas |

### 6.2. Padrões de Layout

**List page:**
```
Desktop: Table com colunas expandidas + ações inline
Tablet: Card list (cada item = card)
Mobile: Card list simplificada + swipe actions
```

**Form page:**
```
Desktop: 2 colunas (formulário + preview/summary)
Tablet: 1 coluna com sections collapsíveis
Mobile: Wizard (uma seção por vez)
```

**Detail page:**
```
Desktop: Header com ações + tabs (info, histórico, documentos)
Tablet: Header com ações em menu dropdown + tabs
Mobile: Header sticky + scroll vertical
```

### 6.3. Design Tokens

```
Spacing: { xs: 4px, sm: 8px, md: 16px, lg: 24px, xl: 32px, 2xl: 48px }
Typography: { sm: 12px, base: 14px, lg: 16px, xl: 20px, 2xl: 24px, 3xl: 32px }
BorderRadius: { sm: 4px, md: 8px, lg: 12px, full: 9999px }
Shadows: { sm: "0 1px 2px rgba(0,0,0,0.05)", md: "0 4px 6px rgba(0,0,0,0.07)" }
```

*(Verificar tokens do design system do projeto antes de definir)*

---

## 7. Performance Percebida

### 7.1. Técnicas

| Técnica | Quando usar | O que especificar |
|:---|:---|:---|
| **Skeleton screen** | Carregamento de dados | Mostrar skeleton com mesmo layout |
| **Optimistic update** | Ações rápidas (like, favoritar) | Atualizar UI antes da resposta, reverter se falhar |
| **Lazy loading** | Imagens, componentes pesados | `loading="lazy"` em imagens, dynamic import |
| **Code splitting** | Páginas pesadas | Import dinâmico por rota |
| **Prefetching** | Links que usuário provavelmente clicará | `<Link prefetch>` ou hover prefetch |
| **Debounced search** | Campos de busca com API | 300ms debounce, cancelar request anterior |
| **Progressive loading** | Listagens longas | Infinite scroll ou "Carregar mais" |

### 7.2. Na TechSpec

```
Performance de UI:
- Listagem: paginação com "Carregar mais" (lazy loading)
- Imagens de produto: loading="lazy" + placeholder blur
- Busca de produtos: debounce 300ms + cancelar request anterior
- Criação de pedido: optimistic lock (desabilitar botão, mostrar loading)
- Componentes pesados: dynamic import (lazy) para formulário
```

---

## 8. Interações e Feedback

### 8.1. Toast Notifications

```
Tipos:
- Success: "Pedido criado com sucesso!" (verde, auto-dismiss 5s)
- Error: "Falha ao criar pedido. Tente novamente." (vermelho, manual dismiss)
- Warning: "Estoque baixo para item X" (amarelo, auto-dismiss 7s)
- Info: "Pedido em processamento" (azul, auto-dismiss 5s)

Posição: bottom-right (padrão shadcn)
Stack: Máximo 3 toasts visíveis, substituir mais antigo
```

### 8.2. Confirmações

```
Ações destrutivas (delete, cancel):
- Dialog de confirmação com título e descrição clara
- Botão primário: vermelho com texto da ação ("Excluir pedido")
- Botão secundário: "Cancelar" (fecha dialog)
- Input de confirmação para ações críticas ("Digite EXCLUIR para confirmar")
```

### 8.3. Microinterações

```
Animações (se aplicável):
- Transição de página: fade-in (200ms)
- Abertura de modal: scale + fade (150ms)
- Hover em cards: elevação de shadow (150ms)
- Toggle de status: cor transiciona (200ms)
- Feedback de clique: ripple ou scale sutil (100ms)

Preferir animações de 150-200ms. Nada > 300ms (lento).
```

---

## 9. Checklist de UI/UX para TechSpec

Antes de finalizar a seção de frontend na TechSpec, verificar:

### Usabilidade
- [ ] Estados de UI definidos (loading, error, empty, success)
- [ ] Feedback visual para todas as ações do usuário
- [ ] Navegação clara (breadcrumbs, rotas, links)
- [ ] Prevenção de erros (validação inline, botões desabilitados)
- [ ] Linguagem do usuário (não técnica)
- [ ] Consistência com design system existente

### Acessibilidade
- [ ] HTML semântico com landmarks
- [ ] Labels visíveis para todos os inputs
- [ ] Navegação por teclado (Tab, Enter, Esc)
- [ ] Contraste adequado (≥ 4.5:1)
- [ ] aria-describedby para erros de validação
- [ ] aria-live para conteúdo dinâmico
- [ ] Focus trap em modais
- [ ] Skip link disponível
- [ ] Testado com screen reader (ou plano para testar)

### Componentes
- [ ] Biblioteca UI existente mapeada
- [ ] Novos componentes especificados (props, events, state)
- [ ] Componentes reutilizados identificados
- [ ] Composição hierárquica documentada

### Formulários
- [ ] Campos com tipos e validações
- [ ] Feedback de validação (inline em blur)
- [ ] Máscaras de input (se aplicável)
- [ ] Submit com loading state
- [ ] Error handling com mensagem específica

### Performance
- [ ] Lazy loading especificado (imagens, componentes)
- [ ] Debounce em campos de busca
- [ ] Paginação ou infinite scroll
- [ ] Code splitting por rota (se aplicável)
- [ ] Skeleton screens para loading
