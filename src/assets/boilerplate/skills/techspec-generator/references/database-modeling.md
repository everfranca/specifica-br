# Modelagem de Banco de Dados

Referência técnica para modelagem de dados ao gerar Tech Specs.

## Sumário

1. [Princípios de Modelagem](#1-principios-de-modelagem)
2. [Tipos de Dados Específicos](#2-tipos-de-dados-especificos)
3. [Chaves Primárias e Estratégias](#3-chaves-primarias-e-estrategias)
4. [Chaves Estrangeiras e Relacionamentos](#4-chaves-estrangeiras-e-relacionamentos)
5. [Índices](#5-indices)
6. [Constraints e Integridade](#6-constraints-e-integridade)
7. [Migrations](#7-migrations)
8. [Padrões Avançados](#8-padroes-avancados)
9. [ORM Mapping](#9-orm-mapping)
10. [Checklist de Modelagem](#9-checklist-de-modelagem)

---

## 1. Princípios de Modelagem

### 1.1. Normalização

Aplicar conforme complexidade do domínio:

| Forma Normal | Regra | Exemplo de Violação |
|:---|:---|:---|
| **1NF** | Valores atômicos, sem arrays | Coluna "tags": "java,spring,api" |
| **2NF** | Sem dependências parciais | PK composta (order_id, item_id) mas nome_do_produto depende só de item_id |
| **3NF** | Sem dependências transitivas | customer_name em Order (depende de customer_id) |
| **BCNF** | Cada determinante é chave candidata | Manager → Department, mas Department → Manager também |

### 1.2. Denormalização Estratégica

**Quando denormalizar (e documentar justificativa):**
- Performance de leitura crítica (ex: total calculado em vez de sum())
- Dados históricos que não mudam (ex: preço no momento da compra)
- Reduzir JOINs em queries frequentes (ex: customer_name em Order para listagem)

**Sempre documentar:**
```
Denormalização: customer_name em orders
Justificativa: Listagem de pedidos evita JOIN com users table (query mais frequente)
Atualização: Trigger ou Application Event quando customer muda nome
Consistência: Eventual (aceitável para display)
```

### 1.3. Nomenclatura

**Verificar padrão do projeto antes de decidir:**

| Elemento | snake_case | PascalCase | camelCase |
|:---|:---|:---|:---|
| Tabelas | orders, order_items | Orders, OrderItems | orders, orderItems |
| Colunas | created_at, user_id | CreatedAt, UserId | createdAt, userId |
| PK | id | Id | id |
| FK | user_id | UserId | userId |
| Índice | idx_orders_user_id | IX_Orders_UserId | idx_orders_userId |

**Sempre alinhar com padrão existente no projeto.**

---

## 2. Tipos de Dados Específicos

### 2.1. Strings

| Tipo | Quando usar | Tamanho |
|:---|:---|:---|
| `VARCHAR(N)` | Texto com tamanho conhecido | email: 255, nome: 100, telefone: 20 |
| `TEXT` | Texto sem limite definido | descrição, comentário |
| `CHAR(N)` | Tamanho fixo | CEP: CHAR(8), UF: CHAR(2) |
| `UUID` | Identificadores únicos | `UUID` ou `VARCHAR(36)` dependendo do banco |

**Na TechSpec, sempre especificar tamanho:**
```
email (VARCHAR(255), Not Null): Email do usuário
description (TEXT, Nullable): Descrição opcional do pedido
zip_code (CHAR(8), Not Null): CEP sem formatação
```

### 2.2. Numéricos

| Tipo | Quando usar | Precisão |
|:---|:---|:---|
| `DECIMAL(P,S)` | Valores monetários | DECIMAL(10,2) para até 99.999.999,99 |
| `INTEGER` | Contadores, quantidades | INT para valores até ~2 bilhões |
| `BIGINT` | IDs de alta escala, timestamps | Para tabelas com milhões de registros |
| `SMALLINT` | Enums numéricos | Para status com poucos valores |
| `SERIAL` / `BIGSERIAL` | Auto-incremento | PK auto-incrementada (PostgreSQL) |
| `FLOAT` / `DOUBLE` | Científico, NÃO usar para dinheiro | - |

**Regra: NUNCA usar FLOAT para valores monetários.**

### 2.3. Temporais

| Tipo | Quando usar |
|:---|:---|
| `TIMESTAMP` / `TIMESTAMPTZ` | created_at, updated_at (com timezone) |
| `DATE` | birth_date, due_date (sem horário) |
| `TIME` | horário de funcionamento |
| `INTERVAL` | duração |

**Padrão de auditoria:**
```
created_at (TIMESTAMPTZ, Not Null, Default: NOW()): Momento de criação
updated_at (TIMESTAMPTZ, Nullable): Última atualização
deleted_at (TIMESTAMPTZ, Nullable): Soft delete (se aplicável)
```

### 2.4. Booleanos

```
is_active (BOOLEAN, Not Null, Default: true): Registro ativo
is_verified (BOOLEAN, Not Null, Default: false): Verificação pendente
```

### 2.5. JSON

**Quando usar:**
- Dados semi-estruturados que variam (ex: metadata, configurações)
- Dados que não precisam de queries por campo interno

**Quando NÃO usar:**
- Dados que são consultados frequentemente por campos internos
- Dados que têm relacionamentos

```
metadata (JSONB, Nullable): Metadados flexíveis da ordem
Exemplo: { "source": "mobile", "campaign": "summer2024" }
```

---

## 3. Chaves Primárias e Estratégias

### 3.1. Estratégias de PK

| Estratégia | Vantagens | Desvantagens | Quando usar |
|:---|:---|:---|:---|
| **UUID v4** | Globalmente único, não sequencial | 36 chars, indexação menos eficiente | Distribuído, APIs públicas |
| **UUID v7** | Ordenável por tempo, único | Mais novo, menos suporte | Melhor que v4 para indexação |
| **SERIAL/BIGSERIAL** | Eficiente, sequencial | Sequencial (expõe volume) | Sistemas monolíticos |
| **ULID** | Ordenável, único | Menos comum | Quando precisa ordenação + unicidade |

### 3.2. Especificação na TechSpec

```
PK Strategy: UUID v4 com gen_random_uuid()
Justificativa: Padrão do projeto (conforme AGENTS.md)
ORM: Prisma @id @default(uuid())
```

---

## 4. Chaves Estrangeiras e Relacionamentos

### 4.1. Padrões de FK

| Relacionamento | Tabela A | Tabela B | FK Location |
|:---|:---|:---|:---|
| 1:1 | User | UserProfile | user_id em UserProfile (Unique) |
| 1:N | User | Order | user_id em Order |
| N:N | User | Role | user_id + role_id em user_roles (junction) |

### 4.2. Comportamento de Delete

| Comportamento | Quando usar | Exemplo |
|:---|:---|:---|
| `ON DELETE CASCADE` | Filhos não fazem sentido sem pai | OrderItem quando Order é deletada |
| `ON DELETE RESTRICT` | Proteger dados referenciados | User com Orders existentes |
| `ON DELETE SET NULL` | Referência opcional | assigned_to quando User é deletado |
| `ON DELETE SET DEFAULT` | Valor padrão quando referência some | status → default status |

### 4.3. Especificação de Relacionamento

```
Order → User (N:1)
FK: user_id (UUID, Not Null, Indexed) REFERENCES users(id) ON DELETE RESTRICT

Order → OrderItem (1:N)
FK em OrderItem: order_id (UUID, Not Null) REFERENCES orders(id) ON DELETE CASCADE

User ↔ Role (N:N)
Junction: user_roles (user_id UUID REFERENCES users(id) ON DELETE CASCADE,
                       role_id UUID REFERENCES roles(id) ON DELETE CASCADE)
PK Composta: (user_id, role_id)
```

---

## 5. Índices

### 5.1. Tipos de Índice

| Tipo | Quando usar | Banco |
|:---|:---|:---|
| **B-tree** (default) | Igualdade, range, ordenação | Todos |
| **Hash** | Apenas igualdade exata | PostgreSQL |
| **GIN** | Full-text search, JSONB, arrays | PostgreSQL |
| **GiST** | Dados geoespaciais, range | PostgreSQL |
| **Partial** | Subset de dados | PostgreSQL, MySQL 8+ |
| **Composite** | Múltiplas colunas na mesma query | Todos |
| **Covering** | Query inteira resolvida pelo índice | PostgreSQL 11+, SQL Server |

### 5.2. Quando Criar Índices

**SEMPRE criar índice para:**
- Chaves estrangeiras (FK)
- Colunas em WHERE frequentes
- Colunas em ORDER BY
- Colunas em JOIN

**NUNCA criar índice para:**
- Tabelas pequenas (< 1000 registros)
- Colunas com baixa seletividade (booleano, status com 2-3 valores)
- Colunas que mudam frequentemente (write-heavy)

### 5.3. Especificação de Índice

```
Indexes:
- idx_orders_user_id ON orders(user_id)         -- FK index, listagem por usuário
- idx_orders_status ON orders(status)            -- Filtro por status
- idx_orders_created_at ON orders(created_at DESC) -- Ordenação por data
- idx_orders_user_status ON orders(user_id, status) -- Composite: user + status
```

**Sempre justificar: "qual query este índice otimiza?"**

---

## 6. Constraints e Integridade

### 6.1. Constraints Comuns

```sql
-- Unique
CONSTRAINT uq_users_email UNIQUE (email)

-- Check
CONSTRAINT chk_orders_total CHECK (total_amount >= 0)
CONSTRAINT chk_orders_quantity CHECK (quantity > 0)
CONSTRAINT chk_users_age CHECK (birth_date <= CURRENT_DATE - INTERVAL '18 years')

-- Not Null (explícito)
total_amount DECIMAL(10,2) NOT NULL
status VARCHAR(50) NOT NULL DEFAULT 'PENDING'
```

### 6.2. Enum vs VARCHAR

| Abordagem | Vantagens | Desvantagens |
|:---|:---|:---|
| **ENUM** | Validação no banco, eficiente | Adicionar valor requer ALTER TYPE |
| **VARCHAR + CHECK** | Flexível, fácil migração | Sem validação automática |
| **Lookup table** | Extensível sem migration | JOIN necessário |

**Recomendação:** Seguir padrão do projeto. Se não definido, VARCHAR com CHECK para enums estáveis, lookup table para enums dinâmicos.

---

## 7. Migrations

### 7.1. Padrões de Nomenclatura

| Ferramenta | Padrão | Exemplo |
|:---|:---|:---|
| Prisma | Timestamp automático | `20240301120000_create_orders` |
| Knex | Timestamp + nome | `20240301120000_create_orders_table.js` |
| EF Core | Timestamp + nome | `20240301120000_CreateOrdersTable.cs` |
| Flyway | V{version}__nome | `V1_0_0__create_orders_table.sql` |

### 7.2. Conteúdo da Migration na TechSpec

```
Migration: 20240301_create_orders_table.sql

UP:
CREATE TABLE orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  total_amount DECIMAL(10,2) NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'PENDING',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ
);

CREATE INDEX idx_orders_user_id ON orders(user_id);
CREATE INDEX idx_orders_status ON orders(status);

DOWN:
DROP TABLE IF EXISTS orders;
```

### 7.3. Seeding

**Quando especificar seed:**
- Dados iniciais necessários (roles, categorias, configurações)
- Dados de teste/desenvolvimento

```
Seed: prisma/seed.ts
Dados:
- 3 roles: ADMIN, MANAGER, CUSTOMER
- 5 categorias de produto
- 1 usuário admin (admin@example.com)
Ferramenta: Faker.js para dados de teste
```

---

## 8. Padrões Avançados

### 8.1. Soft Delete

```
deleted_at TIMESTAMPTZ NULLABLE  -- NULL = ativo, data = deletado

Queries: WHERE deleted_at IS NULL (sempre filtrar)
ORM: Global filter (Prisma middleware, EF Core query filter)
Limpeza: Job periódico para hard delete após N dias
```

**Quando usar:** Dados que podem precisar ser recuperados ou auditoria
**Quando NÃO usar:** Dados temporários, alta volumetria de delete, LGPD compliance

### 8.2. Optimistic Locking

```
version INTEGER NOT NULL DEFAULT 1

UPDATE orders SET status = 'PAID', version = version + 1
WHERE id = ? AND version = ?

Se 0 rows affected: concurrency conflict → retry ou erro
```

### 8.3. Partitioning

```
-- Partitioning por mês (para tabelas de alta volumetria)
CREATE TABLE order_events (
  id UUID,
  order_id UUID,
  event_type VARCHAR(50),
  payload JSONB,
  created_at TIMESTAMPTZ
) PARTITION BY RANGE (created_at);

CREATE TABLE order_events_2024_01 PARTITION OF order_events
  FOR VALUES FROM ('2024-01-01') TO ('2024-02-01');
```

### 8.4. Polimorfismo

```
-- Single Table Inheritance
payments (
  id UUID,
  type VARCHAR(50), -- 'credit_card', 'pix', 'boleto'
  amount DECIMAL(10,2),
  -- Credit card fields (nullable)
  card_last4 VARCHAR(4),
  -- PIX fields (nullable)
  pix_key VARCHAR(100),
  -- Boleto fields (nullable)
  boleto_barcode VARCHAR(44)
)

-- OU Class Table Inheritance
payments (id, type, amount)
credit_card_payments (payment_id FK, card_last4)
pix_payments (payment_id FK, pix_key)
```

---

## 9. ORM Mapping

### 9.1. Prisma

```prisma
model Order {
  id          String    @id @default(uuid())
  userId      String    @map("user_id")
  user        User      @relation(fields: [userId], references: [id], onDelete: Restrict)
  items       OrderItem[]
  totalAmount Decimal   @map("total_amount") @db.Decimal(10, 2)
  status      String    @default("PENDING")
  createdAt   DateTime  @map("created_at") @default(now()) @db.Timestamptz()
  updatedAt   DateTime? @map("updated_at") @db.Timestamptz()

  @@map("orders")
  @@index([userId])
  @@index([status])
}
```

### 9.2. Entity Framework Core

```csharp
public class OrderConfiguration : IEntityTypeConfiguration<Order>
{
  public void Configure(EntityTypeBuilder<Order> builder)
  {
    builder.ToTable("orders");
    builder.HasKey(o => o.Id);
    builder.Property(o => o.Id).ValueGeneratedOnAdd();
    builder.Property(o => o.TotalAmount).HasColumnType("DECIMAL(10,2)").IsRequired();
    builder.Property(o => o.Status).HasColumnType("VARCHAR(50)").IsRequired().HasDefaultValue("PENDING");
    builder.HasOne(o => o.User).WithMany(u => u.Orders).HasForeignKey(o => o.UserId).OnDelete(DeleteBehavior.Restrict);
    builder.HasIndex(o => o.UserId).HasDatabaseName("idx_orders_user_id");
    builder.HasIndex(o => o.Status).HasDatabaseName("idx_orders_status");
  }
}
```

---

## 10. Checklist de Modelagem

Antes de finalizar a seção de dados na TechSpec, verificar:

- [ ] Todas as entidades/tabelas listadas com colunas
- [ ] Tipos de dados específicos com tamanhos (VARCHAR(255), DECIMAL(10,2))
- [ ] PK definida com estratégia (UUID, SERIAL, etc.)
- [ ] Todas as FKs com onDelete behavior
- [ ] Índices justificados (qual query otimizam)
- [ ] Constraints de integridade (CHECK, UNIQUE, NOT NULL)
- [ ] Campos de auditoria (created_at, updated_at)
- [ ] Soft delete justificado (se aplicável)
- [ ] Nomenclatura consistente com padrão do projeto
- [ ] Migration necessária identificada
- [ ] Seeding necessário documentado
- [ ] Relacionamentos documentados (1:1, 1:N, N:N)
