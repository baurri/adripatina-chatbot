# adripatina - preparação do ambiente LOCAL no Windows 11 (PowerShell).
# Não cria nenhum recurso na Cloudflare e não faz deploy.
# Uso:  powershell -ExecutionPolicy Bypass -File scripts\setup-windows.ps1

$ErrorActionPreference = "Stop"
Set-Location (Split-Path $PSScriptRoot -Parent)

Write-Host "1/6 Verificando Node.js..."
$nodeVersion = (node -v) 2>$null
if (-not $nodeVersion) { throw "Instale o Node.js 22 LTS ou superior: https://nodejs.org" }
$major = [int]($nodeVersion.TrimStart('v').Split('.')[0])
if ($major -lt 22) { throw "Node $nodeVersion é antigo. Use Node 22.13+ (necessário para node:sqlite nos testes)." }
Write-Host "   Node $nodeVersion OK"

Write-Host "2/6 Verificando pnpm..."
$pnpm = (Get-Command pnpm -ErrorAction SilentlyContinue)
if (-not $pnpm) {
  Write-Host "   pnpm não encontrado. Instalando pnpm 9 globalmente via npm..."
  npm install -g pnpm@9.15.9
}
pnpm -v

Write-Host "3/6 Instalando dependências..."
pnpm install

Write-Host "4/6 Criando arquivos locais (se não existirem)..."
if (-not (Test-Path ".dev.vars")) {
  Copy-Item ".dev.vars.example" ".dev.vars"
  $secret = -join ((48..57) + (97..122) | Get-Random -Count 40 | ForEach-Object { [char]$_ })
  (Get-Content ".dev.vars") -replace "troque-por-um-segredo-local-longo", $secret | Set-Content ".dev.vars" -Encoding utf8
  Write-Host "   .dev.vars criado com segredo local aleatório"
}
if (-not (Test-Path "db\seeds\0002_local_dev_users.sql")) {
  Copy-Item "db\seeds\0002_local_dev_users.sql.example" "db\seeds\0002_local_dev_users.sql"
  Write-Host "   db\seeds\0002_local_dev_users.sql criado - edite com os IDs numéricos do Telegram"
}

Write-Host "5/6 Banco D1 local (migrations + catálogo de demonstração)..."
pnpm db:migrate:local
pnpm db:seed:local
pnpm exec wrangler d1 execute DB --local --file db/seeds/0002_local_dev_users.sql

Write-Host "6/6 Rodando verificações (lint, typecheck, testes, build)..."
pnpm check

Write-Host ""
Write-Host "Pronto! Próximos passos:"
Write-Host "  pnpm demo        -> demonstração completa no terminal (gera out\Proposta-*.pdf)"
Write-Host "  pnpm dev         -> API + painel em http://127.0.0.1:8787 (Telegram simulado)"
