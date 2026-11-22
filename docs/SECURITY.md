# Segurança e privacidade

## Autenticação e autorização
- **Telegram:** header `X-Telegram-Bot-Api-Secret-Token` comparado em tempo constante; remetente autorizado **somente** por `telegram_user_id` numérico ativo em `users` (username nunca concede acesso). Estranhos recebem negação genérica, sem dados. Só chats privados.
- **Comandos admin no Telegram:** papel ADMIN verificado por ID; alterações pedem confirmação por botão e geram auditoria. Exceções (abaixo do piso, não calibrado) apenas no painel com justificativa.
- **Painel/API:** toda rota `/api/v1/admin/*` exige JWT do Cloudflare Access verificado (JWKS, issuer, audience, RS256, exp) **e** e-mail na allowlist (`users.admin_email`, papel ADMIN). Bypass de desenvolvimento só em `local`/`test`, nunca em staging/produção.
- **CSRF:** mutações exigem JSON e mesma origem. **Rate limiting** por isolate (webhook e admin), complementar às regras da Cloudflare.

## Dados e arquivos
- R2 privado; nenhuma URL pública. Download de documentos apenas pelo painel autenticado (`cache-control: no-store`), com auditoria. Chaves R2 aleatórias.
- PDF comercial: tipo sem campos internos + checagem de termos confidenciais antes de salvar + metadados neutros. PDF interno nunca é enviado pelo fluxo do artesão.
- Envio de documento somente ao chat de usuário autorizado (artesão). **Nenhum envio automático a clientes.**
- Hash SHA-256 de PDFs conferido antes do envio (integridade). Snapshots e documentos imutáveis por trigger.

## IA e prompt injection
Conteúdo de áudio/foto/texto é tratado como **dado**. O prompt delimita a mensagem e proíbe preços; a saída é validada por Zod e campos de preço/custo são descartados. A IA não cria, exclui ou mescla registros.

## LGPD
- Finalidade: gestão de serviços da oficina. Minimização: só nome do cliente é necessário; contato opcional.
- Retenção: áudios e recibos com `retention_until` (padrão 180 dias, `MEDIA_RETENTION_DAYS`); o cron apaga do R2 e marca `deleted_at`.
- Logs estruturados sem PII (apenas IDs e nomes de erro). Auditoria redige campos sensíveis (`redact`).
- Exclusão sob pedido: remover anexos (R2 + `attachments`) e anonimizar `clients`; documentos fiscais/comerciais emitidos podem ter retenção legal — avaliar caso a caso.
- Backup: ver `OPERATIONS.md`.

## Segredos
Somente via `wrangler secret put` (staging/produção) ou `.dev.vars` local (ignorado pelo git). `.env.example` e `.dev.vars.example` não têm valores reais.
