# AGENTS.md - Guia para Agentes de Codificação

Este documento contém diretrizes e comandos essenciais para agentes de codificação que trabalham neste repositório.

---

## 1. Comandos de Build, Lint e Test

### Comandos Atualmente Disponíveis
```bash
# Teste (test runner nativo do Node.js, com cobertura)
npm test

# Testes em modo watch
npm run test:watch

# Build (configurado no tsconfig.json)
npm run build
# ou apenas a compilação TypeScript para ./dist
tsc
```

### Comandos Recomendados (para implementação)
```bash
# Lint (recomendado adicionar ESLint)
npm run lint

# Verificação de tipos
npm run typecheck
```

### Executando Testes Individuais
```bash
# Executar um arquivo de teste específico
node --test tests/utils/nome-do-servico.test.js

# Filtrar por nome de teste
node --test --test-name-pattern="descrição do teste" "tests/**/*.test.js"
```

## 2. Diretrizes de Estilo de Código

### Configuração do TypeScript
- **Target**: ES2020
- **Module**: CommonJS
- **Strict Mode**: Ativado
- **Saída**: ./dist
- **Fonte**: ./src

### Importações
```typescript
// Use import/export padrão
import { ModuleType } from 'module';
import OtherModule from 'other-module';

// Evite require() a menos que seja necessário
const fs = require('fs-extra'); // Aceitável para compatibilidade
```

### Formatação
- **Indentação**: 2 espaços
- **Aspas**: Sempre aspas simples para strings
- **Ponto e vírgula**: Obrigatório no final das linhas
- **Chaves**: Mesmo para blocos de uma linha

```typescript
// Bom
if (condition) {
  doSomething();
}

// Ruim
if (condition) doSomething();
```

### Nomenclatura

#### Arquivos e Diretórios
- Use **kebab-case** para nomes de arquivos e diretórios
```bash
# Bom
src/commands/gerar-prd.ts
specs/templates/prd-template.md

# Ruim
src/commands/gerarPrd.ts
src/commands/gerar_prd.ts
```

#### Variáveis e Funções
- Use **camelCase** para variáveis e funções
```typescript
// Bom
const userName = 'João';
function calcularTotal() {}

// Ruim
const user_name = 'João';
function CalcularTotal() {}
```

#### Classes e Interfaces
- Use **PascalCase** para classes e interfaces
```typescript
// Bom
class ProductManager {}
interface IUserRepository {}

// Ruim
class productManager {}
interface IUserRepository {}
```

#### Constantes
- Use **SCREAMING_SNAKE_CASE** para constantes
```typescript
// Bom
const MAX_RETRY_COUNT = 3;
const API_BASE_URL = 'https://api.example.com';

// Ruim
const maxRetryCount = 3;
const apiBaseUrl = 'https://api.example.com';
```

### Tipos

#### Declaração de Tipos
- Sempre declare tipos explicitamente quando possível
- Use interfaces para objetos e tipos para tipos primitivos/uniões
```typescript
// Bom
interface User {
  id: number;
  name: string;
  email: string;
}

type Status = 'active' | 'inactive' | 'pending';

function getUser(id: number): User {
  // ...
}

// Ruim
function getUser(id) {
  // ...
}
```

#### Tipos Genéricos
- Use genéricos quando apropriado para reutilização de código
```typescript
// Bom
interface ApiResponse<T> {
  data: T;
  success: boolean;
  error?: string;
}

// Ruim
interface ApiResponse {
  data: any;
  success: boolean;
  error?: string;
}
```

### Tratamento de Erros

#### Try/Catch
- Sempre trate erros de forma adequada
- Use tipos específicos de erro quando possível
```typescript
// Bom
try {
  const result = await riskyOperation();
  return result;
} catch (error) {
  if (error instanceof NetworkError) {
    console.error('Erro de rede:', error.message);
    throw new Error('Falha na conexão com o servidor');
  }
  throw error;
}

// Ruim
try {
  const result = await riskyOperation();
  return result;
} catch (error) {
  console.log(error);
}
```

#### Validação de Input
- Valide inputs externos (API, usuário, arquivo)
- Lance erros descritivos com mensagens em português
```typescript
// Bom
function validateUserInput(input: unknown): UserInput {
  if (typeof input !== 'object' || input === null) {
    throw new Error('Input deve ser um objeto válido');
  }
  
  const { name, email } = input as Record<string, unknown>;
  
  if (typeof name !== 'string' || name.trim().length === 0) {
    throw new Error('Nome é obrigatório e deve ser uma string válida');
  }
  
  // ...
}

// Ruim
function validateUserInput(input) {
  return input;
}
```

### Comentários e Documentação

#### Idioma
- **Todos os comentários e documentação devem estar em português brasileiro**
- Seja claro e conciso

#### JSDoc
- Documente funções e classes com JSDoc
```typescript
/**
 * Calcula o total de uma compra aplicando descontos e impostos.
 * 
 * @param itens - Array de itens da compra
 * @param cupom - Código do cupom de desconto (opcional)
 * @returns Valor total da compra com descontos aplicados
 * @throws {Error} Quando itens inválidos são fornecidos
 */
function calcularTotalCompra(itens: Item[], cupom?: string): number {
  // ...
}
```

#### Comentários em Linha
- Use comentários para explicar o "porquê", não o "o quê"
```typescript
// Bom
// Usamos regex para validar CPF devido à complexidade da máscara
const isValidCPF = regex.test(cpf);

// Ruim
// Valida CPF
const isValidCPF = regex.test(cpf);
```

### Estrutura de Diretórios

#### Padrão do Projeto
```
src/
├── commands/          # Comandos da CLI
├── utils/             # Funções e serviços utilitários
│   ├── terminal/      # Primitivas de terminal (cor, glifo, banner, spinner)
│   ├── cabecalho/     # Estratégias das formas do cabeçalho de abertura
│   ├── layouts/       # Estratégias dos layouts de exibição
│   └── tool-adapters/ # Adapters de capacidades por ferramenta de IA
├── types/             # Definições de tipos TypeScript
├── assets/            # Arquivos estáticos incluídos no pacote (templates, boilerplate, JSON)
└── index.ts           # Ponto de entrada principal

specs/
├── core/             # Documentos CORE (visão de produto, arquitetura)
├── features/         # Especificações de funcionalidades
└── templates/        # Templates base (PRD, Tech Spec, Tasks)

tests/                # Suíte de testes (runner nativo do Node.js)
```

#### Convenções
- Cada funcionalidade deve ter seu próprio diretório em `specs/features/`
- Use templates consistentes para documentação
- Mantenha a estrutura de arquivos organizada; `utils/` admite subdiretórios quando houver uma família fechada de módulos coesos, mantida a nomenclatura kebab-case

### Boas Práticas

#### Performance
- Evite operações síncronas em I/O
- Use async/await para operações assíncronas
- Cache resultados quando apropriado

#### Segurança
- Nunca exponha credenciais ou informações sensíveis
- Valide todos os inputs externos
- Use variáveis de ambiente para configurações

#### Manutenibilidade
- Escreva código auto-documentado quando possível
- Siga o princípio da responsabilidade única
- Mantenha funções pequenas e focadas

## 3. Regras Específicas do Projeto

### Foco em SDD (Spec Driven Development)
- Este projeto é focado em desenvolvimento guiado por especificações
- Priorize a criação de documentação clara antes do código
- Use os templates fornecidos para PRD, Tech Spec e Tasks

### Integração com OpenCode
- O projeto é integrado com OpenCode para automação com IA
- Siga os protocolos definidos nos arquivos `.opencode/command/`, que é o diretório atual de comandos
- `.opencode/commands/`, criado por versões anteriores, é o layout legado e continua reconhecido pela detecção automática do projeto
- Mantenha a consistência com os padrões estabelecidos

### Distribuição via npm
- **Este projeto é distribuído como pacote npm**
- **NUNCA** faça referência a caminhos relativos que existem apenas no ambiente de desenvolvimento (ex: `src/assets/`, `src/templates/`)
- Arquivos estáticos (templates, configurações, etc.) devem ser incluídos no pacote via `package.json` e acessados usando caminhos relativos ao pacote instalado
- Use `__dirname`, `path.resolve()` ou APIs do npm para acessar arquivos do pacote durante a execução

### Ecossistema Brasileiro
- Todo o conteúdo deve ser em português brasileiro
- Considere as particularidades do mercado brasileiro
- Use exemplos e terminologia relevantes para o contexto local

## 4. Restrições Gerais

### Tomada de decisões
 - Não tome decisão sem antes aprovação do usuário, por exemplo: 
  1. `Qualquer o melhor caminho? A ou B`, 
  2. Sua resposta: `O caminho A possui XYZ, o caminho B possui WBG, temos um caminho C ... minha recomendação é B pelas motivações YYYYYYY. Qual caminho você quer seguir?


### Formatação
- Não incluir ícones na documentação
- Não incluir ícones no código
- Não incluir comentários no código
- Não leia arquivos em `@specs/prompts/`, este diretório contém prompts "rascunhos" do usuário. 



---

**Versão**: 1.1.0  
**Última Atualização**: 19/02/2026  

**Manutenção**: Mantenha este documento atualizado conforme novas diretrizes forem estabelecidas