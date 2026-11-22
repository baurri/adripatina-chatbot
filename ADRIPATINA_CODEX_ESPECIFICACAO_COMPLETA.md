# adripatina — Especificação mestre de desenvolvimento para Codex

**Versão:** 1.0 — 22/11/2026  
**Objetivo:** construir a primeira versão operacional de um assistente de oficina de pintura e restauração de móveis, acessível pelo Telegram, com painel web administrativo, orçamentos financeiramente seguros e propostas PDF profissionais.  
**Idioma de interface:** português brasileiro (pt-BR). **Moeda:** BRL. **Fuso:** America/Sao_Paulo.  
**Status:** documento normativo do projeto. Quando uma decisão técnica não estiver definida, escolher a opção mais simples, segura e sustentável, registrar em `docs/DECISIONS.md` e manter configurável.

---

## 1. Contexto, usuários e princípios

A marca comercial é **adripatina** (preservar grafia minúscula na identidade). O principal usuário é um artesão de aproximadamente 65 anos, com cerca de 40 anos de experiência em pintura e restauração de móveis. Ele domina a execução técnica, mas encontra dificuldades para organizar serviços, precificar, controlar gastos, acompanhar clientes e administrar prazos. Prefere enviar áudios, mas também escreve. O usuário é autista; não presumir limitações universais a partir do diagnóstico. Projetar uma experiência previsível, respeitosa, sem infantilização e que possa ser ajustada a partir de testes com ele.

**Usuários e permissões:**
- **ARTESAO:** único operador da oficina no MVP; interage pelo Telegram por áudio, texto, fotos e botões. Pode criar e consultar clientes, serviços, despesas, pagamentos e rascunhos de orçamento. Pode solicitar PDFs comerciais, mas não editar parâmetros financeiros críticos nem aprovar exceções abaixo do piso.
- **ADMIN:** familiar responsável; usa painel web e comandos Telegram restritos. Define preços, coeficientes, estoque, metas, aprova exceções e orçamentos de maior risco, consulta relatórios e auditoria.
- **CLIENTE:** não acessa o sistema administrativo. Recebe PDF comercial encaminhado pelo artesão. Link de aceite digital é evolução futura, não necessário para o primeiro release.

**Princípios inegociáveis:**
1. Nunca tratar material já existente em estoque como gratuito. Separar custo de consumo de desembolso de caixa.
2. IA interpreta linguagem natural e ajuda a descrever serviços, **nunca** calcula preço final ou altera números financeiros por conta própria.
3. Uma pergunta curta por vez; permitir áudio, texto, botões, "não sei", "voltar", "corrigir", "cancelar", "continuar depois".
4. Não inventar preços de mercado, rendimento de produtos, horas ou disponibilidade de materiais. Defaults técnicos são hipóteses editáveis, com origem e status de calibração.
5. Não emitir proposta definitiva com lacunas essenciais ou terceiros sem cotação confirmada; fornecer estimativa preliminar rotulada quando apropriado.
6. Nunca enviar proposta a cliente externo sem aprovação/ação explícita do usuário autorizado. Envio ao próprio artesão no Telegram para conferência é permitido.
7. Proteger dados pessoais, credenciais, arquivos e informações de custos internos.
8. Código funcional e testado, sem placeholders críticos, integrações simuladas claramente separadas das reais e sem deploy sem autorização.

## 2. Escopo funcional

### 2.1 Serviços
- Pintura e repintura de móveis; pintura lisa (não assumir laqueação).
- Restauração de móveis antigos; lixamento, verniz, enceramento, consertos.
- Pátina, decapê e aplicação de folha de ouro.
- Reparos estruturais/marcenaria e tapeçaria podem ser terceirizados; cadastrar fornecedor, orçamento do terceiro, prazo, transporte e margem/taxa de coordenação configurável.
- Serviços compostos: várias técnicas e etapas no mesmo móvel, evitando duplicidade de preparação/lixamento/montagem.
- Execução em oficina residencial, sem aluguel comercial; alocar custos indiretos adequados (energia, água, desgaste de equipamentos, consumíveis e manutenção) sem dupla cobrança.

### 2.2 Fluxos do Telegram
- `/start`: identificação autorizada e apresentação breve.
- Menu com **Novo orçamento**, **Meus serviços**, **Registrar gasto**, **Registrar pagamento**, **Agenda**, **Ajuda**.
- Aceitar mensagem espontânea sem comando, por exemplo "Peguei uma cristaleira antiga para fazer pátina"; classificar intenção com confiança e pedir confirmação em casos ambíguos.
- Aceitar nota de voz: baixar arquivo do Telegram, transcrever, interpretar campos, guardar transcrição e referência do áudio conforme política de retenção, e perguntar somente o próximo dado necessário.
- Aceitar foto do móvel e recibos; IA pode sugerir categoria, condição e dados visuais, **nunca** estimar medidas precisas ou valores financeiros como fatos. Pedir confirmação.
- Autosave de estado e dados a cada passo; permitir retomar após interrupção, sem perda do progresso.
- Perguntar de forma curta e uma de cada vez: móvel, técnica, estado, dimensões ou faixa de tamanho, superfícies internas/externas, detalhes, reparos, terceirização, retirada/entrega, material disponível/compra, prazo, cliente, forma de pagamento.
- Resumo antes de calcular, mostrando suposições e lacunas.
- Apresentar orçamento mínimo/recomendado e sinal de confiança. Valores internos não aparecem em documento comercial.
- Perguntar antes de gerar PDF comercial definitivo; entregar documento no Telegram para compartilhamento manual pelo artesão.
- Registrar aprovação, início, andamento, conclusão, entrega e recebimentos; histórico de eventos.
- Exemplos de linguagem: "Já tenho tinta sobrando" => estoque reduz compra, não custo; "Gastei R$ 90 num verniz" => registrar compra, distinguir compra de consumo; "Recebi R$ 200 da dona Maria" => identificar serviço e confirmar vinculação.

### 2.3 Comandos ADMIN Telegram
- `/admin` resumo restrito; `/pendentes`; `/servicos`; `/caixa`; `/alertas`; `/custos`; `/ajuda_admin`.
- Comandos que alteram dados exigem confirmação explícita e trilha de auditoria; preferir links para formulário autenticado no painel para operações complexas.
- Verificar `telegram_user_id` contra allowlist persistida, nunca apenas username; negar acesso de forma genérica, sem revelar dados.

### 2.4 Painel web
- Autenticação via Cloudflare Access (JWT validado no Worker, assinatura/audience/issuer/exp), com allowlist de identidades administrativas; nenhuma rota de API administrativa aberta.
- Dashboard: orçamentos pendentes, serviços ativos, atrasados, recebíveis, gastos, receita, margem estimada/real, evolução mensal.
- CRUD de clientes, móveis, serviços, etapas, materiais, fornecedores, pagamentos, compras e estoque.
- Catálogo de materiais com unidade, embalagem, preço de reposição, preço histórico, rendimento, perdas, validade da referência, estoque estimado e alertas.
- Configuração: metas de renda, horas disponíveis, produtividade, custos fixos, reserva, impostos aplicáveis, margem, risco, frete, coeficientes por técnica e método de aplicação.
- Fila de revisão de orçamentos e aprovação de exceções; comparação de estimado vs. realizado; gestão de PDFs e versões.
- Relatórios e exportação CSV; interface responsiva, acessível, legível e simples.

### 2.5 Ciclo de vida
`RASCUNHO -> ESTIMATIVA -> AGUARDANDO_REVISAO -> APROVADO -> ENVIADO -> ACEITO -> EM_EXECUCAO -> CONCLUIDO -> ENTREGUE -> QUITADO`; também `RECUSADO`, `CANCELADO`, `EXPIRADO`. Separar status do **orçamento** do status da **ordem de serviço** e do status financeiro, evitando estados impossíveis. Validar transições no backend; registrar quem, quando e motivo.

## 3. Regras financeiras e prevenção de prejuízo

### 3.1 Parâmetros iniciais PROVISÓRIOS
- Renda líquida mensal **mínima** desejada: **R$ 3.000**.
- Renda líquida mensal **ideal**: **R$ 4.000**.
- Trabalho regular: **6 horas/dia, segunda a sexta**. Sábado ocasional de até 4 horas é capacidade extra e não integra base regular.
- Aproximação inicial: **130 horas disponíveis/mês**, aproveitamento produtivo **75%**, **97,5 horas produtivas/mês**.
- Custos fixos atribuíveis à oficina: **R$ 400/mês** (hipótese a validar).
- Reserva geral para meses fracos/incertezas: **15%** (hipótese a validar).
- Fórmula provisória: `hora_objetivo = ((renda_mensal_alvo + custos_fixos_mensais) * (1 + reserva_geral)) / horas_produtivas`.
- Resultado aproximado: mínimo **R$ 40,10/h**; ideal **R$ 51,90/h**. **Não** usar R$ 40 e R$ 52 como números exatos internos.
- **Importante:** renda desejada não é necessariamente lucro líquido contábil após tributos. Parametrizar tratamento tributário e margem comercial; não afirmar conformidade fiscal sem conhecer enquadramento.
- Reserva geral e custos fixos já entram na taxa horária; não adicionar novamente por serviço. Risco extraordinário de um serviço pode ser adicionado **separadamente**, documentado e não sobreposto.
- Persistir valores monetários em **centavos inteiros** ou decimal exato, jamais ponto flutuante binário para dinheiro; percentuais/áreas com decimal controlado. Arredondar apenas nos pontos de negócio definidos e testar consistência.

### 3.2 Regra crítica FIN-ESTOQUE-001
**Todo material efetivamente consumido entra no custo do serviço, mesmo que esteja em casa, tenha sido comprado há anos, seja sobra de outra obra, esteja parcialmente usado ou não demande nova compra.**

Manter separadamente:
- `consumption_cost`: quantidade prevista consumida × custo unitário de reposição (preço atual de referência).
- `purchase_cash_outlay`: desembolso estimado para adquirir embalagens necessárias considerando estoque utilizável.
- `historical_purchase_cost`: valor registrado na compra (controle histórico/contábil, sem confundir com reposição).
- `inventory_available`: estoque estimado utilizável, sujeito a confirmação e validade.

**Exemplo obrigatório:** meia lata disponível de tinta cujo preço atual da lata cheia é R$ 120, e serviço consumirá meia lata: **R$ 60 de consumo** no orçamento, **R$ 0 de compra**. Considerar volume real da embalagem, rendimento e perdas; exemplo meramente ilustrativo.

Pergunta ao artesão: **"Você já tem esse material ou precisa comprar?"**, nunca **"Quer cobrar esse material?"**. Resposta "já tenho" muda necessidade de compra, não o custo do serviço. Se custo de reposição desconhecido, marcar pendência; **não** atribuir zero. Materiais com preço de referência antigo recebem alerta. Despesas de compra e consumo devem usar registros separados para evitar dupla contagem nos relatórios de lucro e caixa.

### 3.3 Precificação determinística
Calcular por etapas deduplicadas:
1. **Geometria**: tipo, medidas, faces, portas/gavetas, área tratada; quando incerto, intervalo/estimativa e confirmação.
2. **Receita técnica**: etapas de preparação, reparos, fundo, aplicação, acabamento, limpeza e montagem; técnicas combinadas compartilham etapas comuns quando apropriado.
3. **Método de aplicação**: pincel/trincha, rolo, pistola/compressor; produtividade, preparação, limpeza e perdas específicas, configuráveis. Pincel geralmente detalhes, rolo superfícies planas, pistola grandes superfícies lisas, mas sempre permitir correção pelo artesão.
4. **Mão de obra**: horas ativas de cada etapa × taxa horária; secagem/cura afeta prazo e capacidade, mas não deve automaticamente virar hora ativa faturada.
5. **Materiais**: área × demãos ÷ rendimento × fator de perdas; considerar fundos, tintas, vernizes, lixas, massas, solventes, folhas metálicas e consumíveis conforme receita. Formulação inicial: `litros = area_m2 * demaos / rendimento_m2_por_litro_por_demao / (1 - fracao_perda)`, com validação de denominadores e unidades.
6. **Terceiros**: valor confirmado de cotação + logística e taxa de coordenação/margem configurada, sem duplicar mão de obra própria.
7. **Despesas específicas**: transporte, embalagens, estacionamento etc., apenas quando aplicáveis.
8. **Tributos e taxas**: somente quando configurados com base no regime real; explicitar base de cálculo.
9. **Risco específico**: condicionado à incerteza concreta, nunca repetir reserva geral.
10. **Piso e recomendado**: calcular separadamente com hora mínima e ideal, e margem adicional explícita quando houver. Não aplicar margem em duplicidade. Registrar fórmula, versão e componentes.

A definição exata de margem (markup sobre custo vs. margem sobre preço) deve ser explícita e testada. Orçamento abaixo do piso exige bloqueio e aprovação administrativa justificada, com log. Não permitir desconto que torne preço inferior ao piso sem autorização registrada.

### 3.4 Dados técnicos iniciais
Criar catálogo de técnicas e métodos com **valores de demonstração claramente rotulados como NÃO CALIBRADOS**, editáveis pelo admin. Exemplos apenas para testes: pincel perda 8%, velocidade 3 m²/h, setup 0,25 h; rolo perda 12%, velocidade 5 m²/h, setup 0,3 h; pistola perda 35%, velocidade 9 m²/h, setup 1,1 h. Não assumir que representam a realidade da oficina. **Bloquear emissão comercial definitiva enquanto parâmetros essenciais de determinada técnica estiverem não calibrados ou sem revisão do administrador**, salvo aprovação explícita e registrada.

### 3.5 Caixa, resultado e rentabilidade
- Distinguir compras, consumo, adiantamentos, recebimentos, contas a pagar, saldo do serviço e estoque.
- `resultado_economico_estimado = receita_contratada - custo_consumido_materiais - mao_obra_valorizada - terceiros - despesas_especificas - tributos/taxas aplicáveis`, com apresentação clara da interpretação de mão de obra própria e renda do artesão.
- Fluxo de caixa considera efetivas entradas e saídas, sem tratar material estocado como nova saída de caixa.
- Evitar misturar custo gerencial de reposição com custo contábil histórico nos relatórios.
- Sinalizar entrada/adiantamento recomendado para cobrir compras, terceirização e logística iniciais, configurável; não prometer prazo se insumos/terceiros não confirmados.

## 4. Orçamentos PDF — identidade adripatina

### 4.1 Documento comercial
- A4, visual limpo e profissional, nome **adripatina** com grafia oficial; logotipo opcional, paleta e tipografia configuráveis.
- Número único e legível (`AP-AAAA-NNNN` ou sequência transacional equivalente), emissão, validade, dados comerciais da oficina **somente quando fornecidos**, cliente, descrição do móvel, fotos opcionais, escopo, etapas, acabamentos, preço final, prazo, condições de pagamento, exclusões, observações e aceite/assinatura opcional.
- Permitir detalhamento comercial por categoria (serviços, materiais e insumos, transporte) sem revelar custo interno, hora técnica, markup, risco, lucro, preço de fornecedor ou estoque.
- Não mostrar dados pessoais desnecessários, nem inventar CNPJ, endereço, telefone ou garantia.
- Etiquetar estimativas preliminares como **NÃO DEFINITIVAS** e não confundir com propostas aprovadas.
- PDF gerado no Worker com biblioteca compatível com runtime Workers (ex.: `pdf-lib`, validando compatibilidade), sem Chromium/headless/browser local.
- Gerar a partir de **snapshot imutável** de orçamento aprovado; salvar PDF privado em R2, metadados/hash/versão no D1. Revisão cria nova versão, sem alterar a anterior. Não expor URLs públicas permanentes.
- Prévia e confirmação antes de emitir versão final; enviar documento ao chat autorizado do artesão para encaminhamento manual via WhatsApp/Telegram. Não enviar diretamente a contatos externos automaticamente.

### 4.2 Documento interno
- Disponível somente para ADMIN: premissas, custos de reposição, estoque, desembolso de compras, horas, margem, terceiros, risco, versão das fórmulas, lacunas e aprovações.
- Pode ser PDF interno separado ou tela exportável, mas nunca usar o documento interno como anexo do fluxo de envio ao cliente.
- Testes garantem ausência de campos confidenciais no PDF comercial, inclusive metadados e nomes de arquivo.

## 5. Arquitetura proposta

**Infraestrutura contratada:** usuário já tem **Cloudflare Workers Paid**. Priorizar serviços Cloudflare para minimizar integrações e manutenção; consumo de Workers AI, R2 e outros serviços pode gerar cobrança conforme uso. Não presumir franquias/preços atuais sem consultar documentação oficial. Criar telemetria de consumo e orçamento de IA, sem prometer bloqueio de cobrança Cloudflare a partir de limites locais.

**Stack preferencial:**
- Monorepo TypeScript (`pnpm` workspaces).
- Backend API + webhook Telegram: Cloudflare Workers, Hono, Zod, Drizzle ORM/D1, Wrangler.
- Painel: React + Vite + TypeScript, acessível em rota/domínio separado, servido por Workers Static Assets ou solução Cloudflare equivalente suportada.
- Dados: D1 (SQLite) com migrations versionadas.
- Arquivos: R2 privado para fotos, áudios, comprovantes e PDFs; retenção e exclusão configuráveis.
- IA: Workers AI por adaptadores independentes para STT (transcrição), extração de intenção/entidades e análise opcional de imagem; escolher modelos atuais **somente após verificar disponibilidade, suporte de idioma, limites e preços**. Nunca hardcode modelo supostamente disponível. Fallback manual/texto quando IA indisponível.
- Filas: Cloudflare Queues se disponíveis/necessárias, ou processamento assíncrono confiável com retries, DLQ e idempotência; Cron Triggers para lembretes. Se filas gerarem custo ou complexidade extra, implementar inicialmente padrão outbox D1 + Cron, com migração documentada.
- PDF: `pdf-lib` ou equivalente comprovadamente compatível com Workers.
- Testes: Vitest para motor puro, integração com D1 local/miniflare ou ambiente Workers de teste; Playwright para painel quando viável.
- CI: GitHub Actions com lint, typecheck, unit tests, integration tests, build e auditoria básica de dependências.

### 5.1 Estrutura de pastas sugerida
```text
adripatina/
  apps/
    worker/                 # Hono API, Telegram webhook, cron, auth
    admin-web/              # React/Vite painel
  packages/
    domain/                 # entidades, estados e invariantes
    pricing/                # motor financeiro puro e testes
    conversations/          # máquina de estados, prompts e schemas
    pdf/                    # geração e templates
    shared/                 # tipos, validações e utils
  db/
    migrations/
    seeds/
  docs/
    ARCHITECTURE.md
    DECISIONS.md
    OPERATIONS.md
    FINANCIAL_RULES.md
    AI_COSTS.md
    SECURITY.md
    TEST_PLAN.md
  scripts/
  .github/workflows/
  .env.example
  wrangler.jsonc
  package.json
  pnpm-workspace.yaml
  README.md
```

## 6. Banco de dados D1 — entidades mínimas

Definir chaves UUID/ULID ou equivalentes estáveis, timestamps UTC, `created_by`, versionamento otimista onde aplicável, índices, integridade referencial e migrations. No mínimo:

- `users`: id, role, telegram_user_id único, admin_identity, ativo, preferências.
- `clients`: id, nome, contato, notas, consentimento/necessidade de dados.
- `furniture_items`: id, client_id, tipo, dimensões, condição, fotos, observações.
- `jobs`: id, client_id, furniture_id, status, datas, descrição, entrega, endereço opcional.
- `job_steps`: id, job_id, tipo, técnica, horas_estimadas, horas_reais, dependências, estado.
- `techniques`: id, nome, receita/versionamento, calibrado.
- `application_methods`: id, produtividade, perda, setup, cleanup, calibrado.
- `material_catalog`: id, nome, unidade_base, volume_embalagem, preço_reposição_centavos, preço_atualizado_em, rendimento, perdas, validade, calibrado.
- `inventory_lots` / `stock_movements`: lote, material, quantidade, custo_historico, entrada/consumo/ajuste, origem, vínculo com job, estado do material.
- `material_consumptions`: job_id, material_id, quantidade, custo_reposicao_unitario_snapshot, custo_total_centavos, fonte estoque/compra.
- `purchases`: material_id, quantidade_embalagens, valor_pago, data, comprovante, fornecedor, job opcional.
- `suppliers` e `subcontract_quotes`: escopo, custo, prazo, status confirmado, validade.
- `quotes`: job_id, status, versão, piso_centavos, recomendado_centavos, preço_final_centavos, confiança, premissas, versão motor, aprovado_por.
- `quote_lines`: tipo, descrição, quantidade, unidade, valores internos, valores comerciais, ordem.
- `quote_snapshots`: JSON validado imutável de cada emissão, com hash.
- `quote_documents`: versão, chave R2, hash, data, tipo comercial/interno, número.
- `payments`: job_id, valor_centavos, data, tipo entrada/parcela/estorno, método, referência.
- `expenses`: job_id opcional, categoria, valor, data, comprovante; evitar duplicar compras já lançadas.
- `conversation_sessions` e `conversation_messages`: estado, contexto estruturado, intenção, dedupe de update, última pergunta, confiança, transcrição, status.
- `attachments`: chave R2, MIME, tamanho, proprietário, classificação, retenção.
- `settings_versions`: parâmetros financeiros e técnicos com vigência, origem, aprovação.
- `approval_requests`: objeto, tipo, justificativa, aprovador, decisão, data.
- `audit_events`: ator, ação, entidade, antes/depois redigidos, data, request id.
- `scheduled_reminders` e `outbox_events`: retries, idempotência, entrega, erros.
- `ai_usage`: provedor/modelo, tarefa, tokens/neurons ou métricas fornecidas, custo estimado, resultado, data; nunca armazenar segredos.

Criar schema real normalizado, índices e constraints; esta lista é conceitual, não obrigação de uma tabela por item se houver solução melhor justificada.

## 7. API e contratos

Exemplos de rotas sob `/api/v1` (autenticação e RBAC em todas as rotas administrativas):
- `POST /telegram/webhook` (verificação do header secreto do Telegram, deduplicação por update_id, tratamento rápido e confiável).
- `GET/POST/PATCH /clients`, `/jobs`, `/materials`, `/inventory`, `/suppliers`.
- `POST /quotes/draft`, `POST /quotes/:id/recalculate`, `POST /quotes/:id/submit-review`, `POST /quotes/:id/approve`, `POST /quotes/:id/issue`.
- `GET /quotes/:id/internal`, `GET /quotes/:id/documents`, `POST /quotes/:id/send-to-artisan`.
- `POST /jobs/:id/purchases`, `/expenses`, `/payments`, `/time-entries`.
- `GET /dashboard/summary`, `/reports/cashflow`, `/reports/profitability`.
- `GET/PATCH /settings`, `/settings/history`, `/audit-events`, `/ai-usage`.
- `GET /health` sem segredos, e endpoint de prontidão autenticado se expuser detalhes.

Usar Zod para entrada/saída, validação de status, valores monetários e limites; paginação; tratamento de erros consistente; IDs não sequenciais quando expostos; proteção CSRF quando aplicável; rate limiting por usuário e por operação; idempotência para ações financeiras.

## 8. IA e segurança do fluxo conversacional

### 8.1 Pipeline
`Telegram update -> validar remetente/segredo -> deduplicar -> obter mídia (se houver) -> STT/visão quando habilitado -> extrair intenção e entidades com schema Zod -> checar confiança -> validar domínio -> persistir -> responder uma pergunta -> calcular por motor determinístico quando pronto`.

- Prompts de sistema restringem IA a extração, classificação, resumo e redação; qualquer sugestão de preço vinda da IA é descartada.
- A IA retorna JSON estruturado validado; dados incompletos permanecem `unknown`, não zero.
- Confirmação humana para despesas, pagamentos, exclusão, mudança de cliente, envio de documentos e aprovações.
- Conteúdo de áudio/foto/recibo é dado não confiável, nunca instrução de sistema; proteção contra prompt injection.
- Limitar duração/tamanho de áudio e imagens, validar MIME, transcodificação somente se necessária e suportada; se formato não suportado, pedir texto ou áudio alternativo sem perder sessão.
- Definir timeout, retries com backoff, circuit breaker/fallback para falhas da IA; mensagens claras, sem perder dados.
- Privacidade: minimizar conteúdo enviado à IA, configurar retenção de mídias, permitir exclusão de dados e não registrar dados pessoais completos em logs.
- Implementar teto operacional configurável para novas requisições de IA e alerta de consumo; explicar que limite interno **não é garantia de teto na fatura**.

### 8.2 Exemplos de conversa
**Novo orçamento:** "Vou pintar um guarda-roupa de três portas" -> bot registra tipo/quantidade, pergunta técnica -> condição -> dimensões -> faces -> material/terceiros -> cliente -> resumo -> estimativa -> revisão -> PDF.

**Estoque:** "Já tenho o verniz" -> bot: "Ótimo, você não precisa comprar agora. Vou incluir o valor do verniz usado no orçamento, porque ele tem custo de reposição." -> custo de consumo permanece > 0.

**Despesa:** "Comprei uma lata de tinta por noventa reais" -> bot identifica material/quantidade, pergunta a qual serviço ou estoque geral se aplica, pede confirmação e registra compra sem criar segunda despesa idêntica.

**Pagamento:** "A dona Ana pagou duzentos reais" -> identificar cliente/serviço, confirmar valor, registrar entrada e recalcular saldo.

## 9. Cron, notificações e agenda

- Resumo diário opcional com tarefas do dia, serviços atrasados, orçamentos aguardando resposta e pagamentos pendentes; horário configurável.
- Prazo estimado deve considerar horas ativas, disponibilidade semanal, etapas de secagem/cura, dependências de terceiros e folgas; não prometer datas sem dados suficientes.
- Notificações idempotentes, sem spam; preferências de horário e silenciamento.
- Sábado ocasional não entra automaticamente no planejamento padrão.

## 10. Segurança, privacidade e operação

- Segredos via `wrangler secret` / ambiente seguro, nunca no repositório. `.env.example` sem valores reais.
- Validar token de Cloudflare Access do painel no servidor; não confiar em headers sem verificação criptográfica e contexto de rede apropriado.
- Webhook Telegram com secret token, allowlist de IDs, anti-replay/dedupe e rate limiting.
- R2 privado, acesso a objetos por autorização e URLs assinadas curtas quando necessárias; verificar ownership.
- LGPD: finalidade, minimização, retenção, exclusão, backups, logs redigidos e orientação para dados de clientes.
- Cuidado com fotos de documentos e recibos; limitar armazenamento e acesso.
- Backup/exportação periódica de D1 e inventário de R2; documentar recuperação e restauração.
- Observabilidade: logs estruturados sem PII, métricas de erros, latência, falhas de IA, custos e geração de PDFs.
- Ambientes `local`, `staging`, `production` separados. Nenhum deploy/compra/ativação de recurso pago sem aprovação.
- Scripts de setup Windows 11 (PowerShell), pnpm, Wrangler, migrations locais, seeds, execução de testes e túnel de desenvolvimento para webhook quando necessário.

## 11. Testes obrigatórios e critérios de aceite

**Financeiro**
1. Estoque suficiente => compra = 0, consumo > 0, orçamento inclui consumo.
2. Estoque parcial => compra só da quantidade/embalagem faltante, consumo integral valorizado.
3. Material comprado anos atrás => usar preço atual de reposição no orçamento, preservar custo histórico separado.
4. Preço de material ausente => pendência/bloqueio de proposta definitiva; jamais custo zero.
5. Registro de compra não duplica custo de consumo no resultado econômico.
6. Reserva geral/custos fixos não são adicionados duas vezes.
7. Técnicas compostas não duplicam lixamento/preparação comum.
8. Secagem não conta automaticamente como hora ativa.
9. Terceirização sem cotação confirmada bloqueia proposta definitiva.
10. Desconto abaixo do piso bloqueado sem aprovação admin auditável.
11. Pagamentos parciais, estornos e saldo corretos; centavos exatos.
12. Recalcular orçamento após alteração de parâmetro não altera snapshots/PDFs já emitidos.

**Conversação**
13. Áudio interpretado com sucesso segue mesmo fluxo do texto.
14. Falha de transcrição preserva sessão e permite reenvio/texto.
15. Mensagem ambígua gera uma pergunta curta, não um registro financeiro indevido.
16. "Não sei" mantém campo pendente e não vira zero.
17. Sessão interrompida pode ser retomada.
18. Duplicata de update Telegram não cria registros duplicados.

**Documentos e acesso**
19. PDF comercial não contém hora técnica, margem, custo de fornecedor, estoque, riscos internos ou segredos, nem em metadados.
20. PDF tem número, versão, validade, escopo, preço, condições e marca adripatina.
21. PDF emitido é imutável; revisão gera nova versão.
22. Sem autorização, ninguém baixa documento privado nem consulta cliente de terceiros.
23. Admin Telegram autenticado por ID; username não concede acesso.
24. Não existe envio automático de proposta a cliente sem ação explícita.
25. Painel bloqueia API admin sem JWT Cloudflare Access válido.
26. Falha de Workers AI não impede consulta de serviços nem registro por texto estruturado.

**Entrega**
27. `pnpm install`, lint, typecheck, testes, build e migrations locais documentados e executáveis.
28. Fluxo demonstrável ponta a ponta com dados fictícios: criar cliente, móvel, orçamento, aprovar, emitir PDF, registrar pagamento, consultar saldo.
29. Documentação de decisões, limites e custos, variáveis de ambiente, segurança e deploy manual.
30. Sem segredos hardcoded, dados reais inventados ou integrações pagas acionadas sem aprovação.

## 12. Plano de implementação em fases (executar progressivamente)

**P0 — Fundação e segurança financeira**
Monorepo, D1 migrations, catálogo/seed demonstrativo, motor puro de precificação, FIN-ESTOQUE-001, cálculos monetários exatos, testes, CLI/fixture demonstrativo. Concluir e testar antes de adicionar IA.

**P1 — Telegram texto + domínio**
Webhook seguro, usuários autorizados, estado conversacional, CRUD mínimo de clientes/jobs, despesas/compras/pagamentos, orçamento por texto, autosave, retomada, comandos admin iniciais, dedupe.

**P2 — Painel web**
Cloudflare Access, dashboard, CRUD, parâmetros, catálogo, estoque, aprovações, auditoria, relatórios básicos.

**P3 — PDF adripatina**
Template comercial, snapshot imutável, numeração, R2, geração, versão, envio para artesão, testes de privacidade. Considerar esta fase obrigatória para MVP comercial.

**P4 — Áudio, fotos e Workers AI**
Adapters de IA, transcrição, extração estruturada, análise opcional de imagem, monitoramento de custos, fallback, testes com áudio brasileiro informal. Prioridade de usabilidade alta; sem isso o MVP ainda não está pronto para o tio.

**P5 — Agenda e operação**
Lembretes, estimado vs. real, calibração, backups, staging, hardening, roteiro de testes com cinco serviços históricos e publicação somente após aprovação.

**Nota:** P0–P5 são marcos de execução, mas o objetivo é entregar **todas as fases** do MVP em um único projeto, não encerrar após P0. Não iniciar deploy de produção nem uso pago sem autorização. Pode avançar automaticamente entre fases **locais e gratuitas** após testes, relatando pendências; parar apenas em bloqueios reais ou ações externas/financeiras.

## 13. Instruções operacionais ao Codex

1. Inspecionar repositório antes de modificar; se vazio, inicializar estrutura proposta.
2. Criar `docs/IMPLEMENTATION_PLAN.md` com checklist rastreável, dependências e riscos; **implementar código de fato**, não somente planejar.
3. Documentar decisões em `docs/DECISIONS.md`; qualquer default inventado deve ser `demo_only`/`uncalibrated` e não pode habilitar emissão comercial definitiva silenciosamente.
4. Criar interfaces de provedor e implementações `mock` para testes; não fingir que chamadas reais foram feitas.
5. Trabalhar em incrementos pequenos, executar testes, corrigir erros e registrar evidências em `docs/TEST_RESULTS.md`.
6. Se a execução não puder concluir todas as fases em uma sessão, deixar estado reproduzível, checklist atualizado e próximo passo exato; nunca declarar completo o que não foi implementado.
7. Não instalar dependências de procedência duvidosa, não solicitar segredos em texto aberto e não publicar sem autorização.
8. Entregar README de setup no Windows 11, comandos `pnpm` e Wrangler, instruções para configurar Telegram BotFather, Cloudflare Access, D1, R2 e Workers AI **sem executar mudanças externas**.
9. Antes de escolher nomes de modelos Workers AI ou afirmar preços/limites, conferir documentação oficial atual quando houver acesso à internet; se não houver, deixar configuração e TODO explícitos.
10. Ao final, informar arquivos criados, módulos completos, testes executados, pendências reais, custo esperado de operação (com hipóteses) e sequência de ativação segura.

## 14. Critérios de produto para a primeira utilização real

Antes de seu tio usar o sistema com clientes reais:
- Admin cadastra e valida preços atuais, rendimentos, tempos e técnicas mais frequentes.
- Executar comparação com **cinco serviços históricos** e revisar diferenças com o artesão.
- Validar transcrição de áudios reais com consentimento e correção humana.
- Revisar identidade comercial da adripatina (logotipo, contatos, textos, política de validade e pagamento).
- Testar um orçamento completo em staging, com PDF e conferência financeira.
- Habilitar revisão administrativa obrigatória de propostas inicialmente.

**Definição de sucesso:** o artesão consegue enviar áudio, responder perguntas simples, obter um orçamento com todos os materiais valorizados (inclusive estoque), registrar trabalho e recebimentos e receber um PDF profissional da **adripatina**, sem precisar fazer contas ou navegar por planilhas.
