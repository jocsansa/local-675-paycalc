# Local 675 PayCalc

Crie o **675 Piecework Calculator** - uma aplicação completa de full-stack para cálculo de taxas de trabalho por peça (piecework) em drywall/boarding para Local 675.

## REQUISITOS PRINCIPAIS

### 1. ARQUITETURA DE DADOS
- Supabase/PostgreSQL com tabelas: users, agreements, rate_tables, rate_items, rate_rules, rate_tiers, jobs, job_areas, job_boarding_items, job_extra_items, job_premiums, calculation_results, reports, settings
- Nunca sobrescrever taxas antigas - manter histórico completo
- Versionamento de tabelas de taxa com datas efetivas
- Sistema genérico que suporte Local 675, outras uniões e jurisdições

### 2. TIPOS DE PROJETO
Suportar: Low Rise Residential (Standard, Townhouse, Stack, Back-to-Back, Steel Framed), High Rise (Residential, Apartment, Condominium), Commercial (Office, Retail, Restaurant, Industrial, Institutional)

### 3. RATE ENGINE (CRÍTICO)
- Centralizar todos os cálculos em um serviço reutilizável
- Funções: calculateBoarding(), calculateExtra(), calculatePremium(), calculateTieredRate(), calculateJobTotal()
- Retornar breakdown completo: base_total, premiums_total, extras_total, grand_total, rate_table_used, effective_date
- Cada linha de cálculo deve registrar: rate, unit, quantity, formula, subtotal, rate source, rate table version
- NUNCA inventar taxas - mostrar "RATE NOT CONFIGURED" se ausente

### 4. SISTEMA DE EXTRAS/PREMIUMS
- Sistema de premiums genérico: Fixed amount, Per sq ft, Per linear ft, Per sheet, Per item, Percentage, Tiered, Conditional
- Exemplos: Townhouse Premium, Fire Code Premium, Height Premium, Steel Frame Premium, High Rise Premium
- Extras: Resilient Channel, Corner Bead, Pot Lights (com tiered: primeiros 5 inclusos, adicionais com taxa), Sprinklers, Skylights, Shaftwall, etc

### 5. ENTRADA DE DADOS
- Sistema universal de entrada de placas: área, localização, material, espessura, dimensões da placa, quantidade
- Suportar entrada por número de placas OU por metragem quadrada
- Cálculo automático: Width × Height × Quantity = Square Feet
- Múltiplas áreas na mesma obra (Unit 101, Unit 102, Corridor, etc)
- Para High Rise: rastreamento por Piso/Unit/Área/Sala
- Para Commercial: Project Area, Floor, Room, Zone, Ceiling Height

### 6. FLUXO DE CRIAÇÃO DE JOB
1. Project Information
2. Select Project Type (e este determina as categorias de taxa disponíveis)
3. Select Agreement/Rate Table (aplica automáticamente a tabela correta para a data do job)
4. Boarding (múltiplas áreas com materiais/espessuras diferentes)
5. Extras (items adicionais com taxas dinâmicas)
6. Premiums (aplicar premiums baseado em regras)
7. Review
8. Calculate
9. Save
10. Generate Report

### 7. INTERFACE DE ADMINISTRAÇÃO DE TAXAS
Rate Manager com:
- Create/Edit/Deactivate Agreement
- Create/Edit/Deactivate Rate Table
- Create/Edit/Deactivate individual rates
- CSV Import/Export completo
- UI tipo spreadsheet com colunas: Project Type, Category, Item, Material, Thickness, Height, Unit, Rate, Calculation Type, Effective From, Effective To, Active, Notes
- Nunca deletar taxas históricas

### 8. MOBILE-FIRST
- Botões grandes
- Teclados numéricos
- Controles rápidos +/-
- Total fixo no rodapé
- Entrada rápida de quantidades
- Quick Calculator mode: selecionar Residential/High Rise/Commercial → adicionar Sheets, Sq Ft, RC, Corner Bead, Pot Lights rapidamente

### 9. RELATÓRIO
Título: "675 PIECEWORK CALCULATION REPORT"
- Project info (Job, Address, Project Type, Agreement, Rate Table, Effective Date, Contractor, Date)
- Boarding (tabela detalhada)
- Extras (tabela detalhada com fórmulas)
- Premiums (tabela detalhada)
- Final total
- Cálculo notes mostrando fórmulas usadas
- Disclaimer sobre verificação contra acordo coletivo atual

### 10. RECURSO "WHY?" - TRANSPARÊNCIA
Cada linha calculada tem botão "Why?" que mostra:
- Rate Table used
- Version
- Effective Date
- Category
- Item
- Height category
- Unit
- Rate value

### 11. DASHBOARD & FUNCIONALIDADES
- Jobs deste mês, total calculado, valor médio, jobs recentes
- Buscar jobs por: nome, endereço, contractor, tipo de projeto, agreement, data, piso, unit
- Duplicate Job (copia inputs, permite mudar nome/data/address, recalcula com tabela de taxa correta)
- Price Analysis: Total, Board Sq Ft, Total Sheets, Average $/Sheet, $/Sq Ft, $/1000 Sq Ft, Extras %, etc
- Sheet Breakdown tracker

### 12. AUTENTICAÇÃO & ROLES
- Supabase Auth
- Roles: Admin (gerencia taxas), Worker (calcula jobs), Estimator (cria/gerencia estimates)

### 13. PERSISTÊNCIA OFFLINE
- Local persistence para uso em sites com internet ruim
- PWA/offline mode se prático
- Sincronizar com Supabase quando conexão retornar

### 14. TESTES AUTOMATIZADOS
Testar: Low Rise, High Rise, Commercial, diferentes materiais, diferentes alturas, Resilient Channel, Corner Bead, Pot Lights com tiered, Sprinklers, Skylights, premiums, múltiplas áreas, múltiplos pisos, tabelas de taxa históricas/futuras, taxas faltantes, tiered rates, duplicate jobs

## PRINCÍPIO FINAL
"Eu digo à app que trabalho fiz. A app sabe qual acordo Local 675 aplica. A app sabe a taxa aplicável. A app calcula tudo. A app mostra exatamente como chegou ao número."

Construir uma APLICAÇÃO COMPLETAMENTE FUNCIONAL, não um protótipo estático. Começar com: database architecture → rate engine → job model → calculator → rate manager → dashboard → report → mobile optimization → testes completos.

---

## STATUS DO MVP

### Implementado

| Área | Onde |
| --- | --- |
| Schema Supabase (13 tabelas, RLS, roles) | `supabase/migrations/` |
| Rate engine puro + 26 testes | `src/lib/rate-engine.ts`, `src/lib/rate-engine.test.ts` |
| Camada de dados / CRUD | `src/lib/db.ts`, `src/lib/queries.ts` |
| Auth (sign in / sign up, guarda de rota, roles) | `src/lib/auth.tsx`, `src/routes/login.tsx` |
| Dashboard (mês, total, média, recentes) | `src/routes/index.tsx` |
| Fluxo de job em 5 passos + total fixo no rodapé | `src/routes/jobs/new.tsx` |
| Lista de jobs com busca, duplicar, excluir | `src/routes/jobs/index.tsx` |
| Relatório imprimível + "Why?" + disclaimer | `src/routes/jobs/$id.tsx` |
| Rate Manager (agreements, tabelas versionadas, CSV) | `src/routes/rates.tsx`, `src/lib/csv.ts` |
| Quick Calculator mobile | `src/routes/quick.tsx` |

### Fora do MVP (próximas fatias)

- Persistência offline / PWA e sincronização
- `rate_rules` com auto-aplicação condicional de premiums
- Tabela `reports` persistida (o relatório hoje é gerado a partir de `calculation_results`)
- Tela de gestão de usuários e roles (o schema já suporta; a UI ainda não)
- Editor visual de faixas (`rate_tiers`) — hoje via `included_qty` ou inserção direta

### Taxas do Local 675 (2025–2028)

Em **Rates**, o botão **Load Local 675 2025–2028** carrega o schedule publicado
como três rate tables, uma por ano do acordo, e o engine escolhe a que vigora na
data de cada job.

Fonte: *Residential Agreement* entre a Interior Systems Contractors Association
of Ontario e a Drywall Acoustic Lathing and Insulation Local 675, vigente de
**1 mai 2025 a 30 abr 2028**, Artigo 6 (Wages), páginas 7–13.
Os valores estão transcritos em [`src/data/local675-2025-2028.ts`](src/data/local675-2025-2028.ts)
e travados por testes.

Como o acordo precifica:

- **Boarding por altura de teto**, em faixas: até 8 ft, 8–9, 9–10, 10–11, 11–12.
  High rise não tem faixa igual ou abaixo de 8 ft.
- **Rates por 1000 sq ft**, não por sq ft (`calculation_type: per_1000_sq_ft`).
- **Sem distinção de material ou espessura** no boarding — Fire Code Type "C" é
  um *premium* somado por cima, não uma taxa de boarding separada.

Por isso o formulário mostra material/espessura apenas quando a tabela de taxas
carregada realmente precifica por eles.

### Outro acordo ou jurisdição

1. **Rates → novo Agreement**.
2. **Novo Rate Table** com versão e data de vigência.
3. **CSV template** → planilha com todas as linhas e a coluna `rate` **vazia**.
4. Preencher a partir do acordo e **importar**.

Linhas com `rate` vazia ou não numérica são recusadas na importação e reportadas.
Qualquer combinação sem taxa configurada aparece como `RATE NOT CONFIGURED` e soma $0 —
nunca um valor estimado.

### Comandos

O lockfile do projeto é o `bun.lock` — instale com **bun** para que a trava de
supply-chain do `bunfig.toml` (`minimumReleaseAge`) seja aplicada. Lockfiles de
outros gerenciadores estão no `.gitignore` para não divergirem.

```sh
bun install        # ou: npx bun install
```

```sh
bun run dev        # dev server (porta 8080)
bun run test       # testes do rate engine
bun run typecheck  # tsc --noEmit
bun run build      # build de produção
```

---

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/3ee89942-e468-4087-9fa4-9e699200e417).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
