# Deploy em produção — VPS HostGator (Ubuntu)

Guia de referência pra subir o Oeste Freios numa VPS Ubuntu da HostGator. Depois da primeira vez,
atualizações usam só o `deploy/deploy.sh`.

## Arquitetura

```
Internet → nginx (443, TLS) → ┬─ / (estático)        → frontend/dist (Vite build)
                               └─ /api/*               → backend Node (systemd, porta 3000, loopback)
                                                              │
                                                              ├─ Postgres local (dados da aplicação:
                                                              │  usuários, sessões, configurações, auditoria)
                                                              └─ Firebird do cliente na nuvem (CHERP —
                                                                 OS, clientes, veículos, produtos reais)
```

- **Domínio**: `app.mecanicaoestefreios.com.br` (subdomínio, DNS já disponível).
- **CHERP/Firebird**: já roda no servidor de produção do cliente, na nuvem — não precisa de VPN, só
  das credenciais de acesso (host, porta, caminho do `.FDB`, usuário, senha) e garantir que o
  firewall do lado do cliente libera o IP da VPS na porta do Firebird (normalmente 3050).
- **Uploads** (logo da empresa, foto de perfil): salvos em disco em `backend/uploads/`, servidos pelo
  próprio backend em `/api/uploads/...` — precisa fazer parte do backup.
- **Cookie de sessão**: `secure: true` em produção (`NODE_ENV=production`) — só funciona com HTTPS.
  Não dá pra testar login em produção sem certificado válido primeiro.

## Pré-requisitos a confirmar antes de começar

- [ ] Acesso SSH à VPS (usuário com sudo).
- [ ] Domínio `mecanicaoestefreios.com.br` com acesso ao painel de DNS.
- [ ] Credenciais do Firebird de produção do cliente (host, porta, caminho do banco, usuário, senha,
      e a `CHAVE` do usuário CHERP que vai assinar as OS abertas pelo app — ver
      `FIREBIRD_OS_USUARIO_CHAVE` no `.env`).
- [ ] Confirmar com quem administra o servidor CHERP que o IP público da VPS pode acessar a porta do
      Firebird (3050) — sem isso o backend nunca conecta.

---

## 1. Acesso inicial e hardening básico

```bash
ssh root@SEU_IP_DA_VPS

# Atualiza o sistema
apt update && apt upgrade -y

# Cria o usuário que vai rodar a aplicação (nunca rodar como root)
adduser oestefreios
usermod -aG sudo oestefreios

# Copia sua chave SSH pro novo usuário (rode isso da sua máquina, não da VPS)
# ssh-copy-id oestefreios@SEU_IP_DA_VPS

# Desabilita login root por SSH e login por senha (só chave)
nano /etc/ssh/sshd_config
#   PermitRootLogin no
#   PasswordAuthentication no
systemctl restart sshd
```

A partir daqui, logue sempre como `oestefreios` (`ssh oestefreios@SEU_IP_DA_VPS`).

⚠️ **Cuidado ao testar o hardening**: depois de desabilitar `PermitRootLogin`, é tentador confirmar
que o bloqueio funciona tentando logar como root de propósito. Nas VPS da HostGator (e em geral em
imagens com `fail2ban` pré-instalado), 2-3 tentativas de login recusadas do mesmo IP em pouco tempo
podem acionar um jail que bane **todas as portas** desse IP por um tempo — inclusive a sua própria
sessão SSH. Se isso acontecer, o console web do painel da HostGator (fora da rede normal) continua
funcionando; espere alguns minutos e tente de novo pela rede normal.

```bash
# Verifica se já vem pré-instalado (comum em VPS da HostGator) antes de instalar
dpkg -l | grep -E 'fail2ban|unattended-upgrades'

# Se não estiver instalado:
sudo apt install -y unattended-upgrades fail2ban
sudo dpkg-reconfigure -plow unattended-upgrades
sudo systemctl enable --now fail2ban

# Confere se o jail do sshd já cobre a porta customizada (ajuste a porta se não cobrir)
sudo cat /etc/fail2ban/jail.local 2>/dev/null | grep -A3 '\[sshd\]'
```

## 2. Node.js

```bash
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs
node -v   # confirma v22.x
```

## 3. PostgreSQL (banco próprio da aplicação)

```bash
sudo apt install -y postgresql postgresql-contrib

sudo -u postgres psql <<'SQL'
CREATE USER oeste_freios WITH PASSWORD 'TROQUE_ESSA_SENHA';
CREATE DATABASE oeste_freios OWNER oeste_freios;
SQL
```

Guarde a senha — vai entrar no `DATABASE_URL` do `.env` (passo 6). Com 4GB de RAM não precisa
tunar `postgresql.conf` pra rodar isso — os defaults do Ubuntu servem bem pro tamanho do app.

## 4. nginx + certbot

```bash
sudo apt install -y nginx certbot python3-certbot-nginx
sudo systemctl enable --now nginx
```

## 5. DNS

No painel de DNS do domínio `mecanicaoestefreios.com.br`, crie:

| Tipo | Nome | Valor          |
|------|------|----------------|
| A    | app  | IP da VPS      |

Espera propagar (`dig app.mecanicaoestefreios.com.br` até devolver o IP certo) antes do passo 8.

## 6. Clonar o projeto

```bash
sudo mkdir -p /opt/oeste-freios
sudo chown oestefreios:oestefreios /opt/oeste-freios
cd /opt
git clone https://github.com/filiperodrigues07/oestefreios.git oeste-freios
cd oeste-freios
```

Se o repositório for privado, configure um deploy key ou um token de acesso pessoal antes do clone.

## 7. Variáveis de ambiente de produção

```bash
cp backend/.env.production.example backend/.env
nano backend/.env
```

Preencha (ver comentários no próprio arquivo):
- `FIREBIRD_*` — credenciais reais do CHERP do cliente.
- `DATABASE_URL` — usuário/senha criados no passo 3.
- `JWT_SECRET`, `JWT_REFRESH_SECRET`, `SETTINGS_ENCRYPTION_KEY` — gerar cada um com:
  ```bash
  openssl rand -base64 48
  ```
- `DEV_ADMIN_EMAIL` / `DEV_ADMIN_PASSWORD` — vira o admin real do sistema no seed (passo 8.3);
  troque a senha pela tela do app assim que logar a primeira vez.

```bash
chmod 600 backend/.env
```

## 8. Instalar, buildar e preparar o banco

```bash
cd /opt/oeste-freios
npm ci
npm run build

# 8.1 — schema (tabelas, índices). migrate.js/seed.js precisam rodar de DENTRO de backend/
# (o dotenv carrega o .env relativo ao diretório atual, não à raiz do monorepo).
cd backend
node dist/database/postgres/migrate.js

# 8.2 — cria a pasta de uploads (logo, avatar) ANTES de subir o serviço — o systemd
# (passo 9) usa ReadWritePaths apontando pra ela, e falha ao iniciar se não existir.
mkdir -p uploads/avatars uploads/branding

# 8.3 — roles, permissões e o admin definido no .env
#       (NODE_ENV=production no .env garante que a conta de teste "mecanico@dev.local"
#        com senha pública no repositório NUNCA é criada — só o admin real)
node dist/database/postgres/seed.js
cd ..
```

## 9. systemd — backend como serviço

```bash
sudo cp deploy/systemd/oeste-freios-backend.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now oeste-freios-backend
sudo systemctl status oeste-freios-backend
```

Logs: `sudo journalctl -u oeste-freios-backend -f`

## 10. nginx + HTTPS

```bash
sudo cp deploy/nginx/app.mecanicaoestefreios.com.br.conf /etc/nginx/sites-available/
```

Como ainda não existe certificado, **comente** as duas linhas `ssl_certificate*` no arquivo antes de
habilitar (senão o nginx recusa subir por apontar pra um certificado que não existe ainda):

```bash
sudo nano /etc/nginx/sites-available/app.mecanicaoestefreios.com.br.conf
# comente ssl_certificate e ssl_certificate_key
```

```bash
sudo ln -s /etc/nginx/sites-available/app.mecanicaoestefreios.com.br.conf /etc/nginx/sites-enabled/
sudo mkdir -p /var/www/certbot
sudo nginx -t && sudo systemctl reload nginx

# Emite o certificado — o certbot edita o arquivo sozinho e descomenta as linhas ssl_certificate*
sudo certbot --nginx -d app.mecanicaoestefreios.com.br

sudo nginx -t && sudo systemctl reload nginx
```

O certbot já configura renovação automática via timer systemd (`certbot.timer`) — confirmar com
`systemctl list-timers | grep certbot`.

## 11. Firewall (ufw)

⚠️ **Confirme a porta do SSH antes de habilitar** (`grep ^Port /etc/ssh/sshd_config` — nesta VPS é
`22022`, não a 22 padrão). Habilitar o `ufw` sem liberar a porta certa te tranca pra fora do
servidor até reiniciar via console web.

```bash
sudo ufw allow 22022/tcp comment 'SSH'
sudo ufw allow 80/tcp comment 'HTTP'
sudo ufw allow 443/tcp comment 'HTTPS'
sudo ufw show added   # confere as 3 regras antes de habilitar
sudo ufw enable
sudo ufw status verbose
```

Depois de habilitar, **teste a conexão SSH numa aba nova antes de fechar a atual** — se der
timeout, você ainda tem a sessão original aberta pra corrigir (`sudo ufw disable` desfaz na hora).

A porta 3000 (backend) **não** deve ficar acessível de fora — ele só escuta em `127.0.0.1` via
nginx, então nem precisa de regra específica bloqueando; só confirme que não tem nada abrindo
`3000` pra fora.

## 12. Teste ponta a ponta

- Abra `https://app.mecanicaoestefreios.com.br` — deve carregar o login, com cadeado válido.
- Logue com o admin criado no passo 8.3, troque a senha.
- Em Configurações > Firebird, teste a conexão com o CHERP — confirma que a VPS realmente alcança
  o servidor do cliente.
- Abra uma OS de teste, confirme que lista clientes/veículos reais do CHERP.

## 13. Backups

Banco (dono do cron é o usuário `postgres`, que já tem permissão de leitura no banco):

```bash
sudo mkdir -p /var/backups/oeste-freios
sudo chown postgres:postgres /var/backups/oeste-freios
sudo -u postgres crontab -e
```

Adicione (backup diário às 3h, mantém 14 dias):

```cron
0 3 * * * pg_dump -U postgres oeste_freios | gzip > /var/backups/oeste-freios/db-$(date +\%F).sql.gz && find /var/backups/oeste-freios -name 'db-*.sql.gz' -mtime +14 -delete
```

Arquivos locais (uploads e PDFs privados de boletos) — backup separado (não ficam no Postgres), dono do cron é o
`oestefreios` (só ele tem permissão de leitura em `/opt/oeste-freios`):

```bash
sudo mkdir -p /var/backups/oeste-freios-uploads
sudo chown oestefreios:oestefreios /var/backups/oeste-freios-uploads
crontab -e   # como oestefreios
```

```cron
30 3 * * * tar czf /var/backups/oeste-freios-uploads/arquivos-$(date +\%F).tar.gz -C /opt/oeste-freios/backend uploads storage/cobrancas && find /var/backups/oeste-freios-uploads -name 'arquivos-*.tar.gz' -mtime +14 -delete
```

O diretório `storage/cobrancas` precisa existir (o deploy o cria). Substitua o cron antigo de
`uploads-*.tar.gz` pelo novo; não rode os dois como se fossem backups completos. Confira o conteúdo
com `tar tzf /var/backups/oeste-freios-uploads/arquivos-AAAA-MM-DD.tar.gz` e faça uma restauração
de teste em diretório isolado, verificando ao menos um PDF e uma logo. Os backups antigos de uploads
devem ser preservados até o novo procedimento estar validado.

Considere copiar `/var/backups/oeste-freios*` pra fora da VPS periodicamente (outro storage, S3,
etc.) — backup só na mesma máquina não protege contra perda do servidor inteiro.

## 14. Atualizações futuras

```bash
cd /opt/oeste-freios
./deploy/deploy.sh
```

O script faz `git pull`, reinstala dependências, builda os dois workspaces, roda migrations
pendentes e reinicia o serviço. Pede sudo pra reiniciar o systemd/testar o nginx.

---

## Checklist de segurança final

- [ ] Login root por SSH desabilitado, só chave.
- [ ] `backend/.env` com `chmod 600`, nunca commitado.
- [ ] `JWT_SECRET` / `JWT_REFRESH_SECRET` / `SETTINGS_ENCRYPTION_KEY` gerados com `openssl rand`,
      não os valores de exemplo.
- [ ] `NODE_ENV=production` confirmado (senão a conta de teste "Mecânico" com senha pública seria
      criada, e o cookie de sessão não fica `secure`).
- [ ] HTTPS válido (cadeado verde), renovação automática do certbot confirmada.
- [ ] Firewall (`ufw`) ativo, só 22/80/443 liberados.
- [ ] Backup diário do Postgres, uploads e PDFs de boletos rodando e testado (restaurar um dump de teste ao
      menos uma vez pra confirmar que o backup funciona de verdade).
- [ ] Confirmado com o cliente que o firewall do servidor CHERP libera o IP da VPS.

## Troubleshooting rápido

| Sintoma | Onde olhar |
|---|---|
| Site não carrega / 502 | `sudo systemctl status oeste-freios-backend`, `sudo journalctl -u oeste-freios-backend -n 50` |
| Login não persiste (cai sempre) | Confirmar HTTPS válido — cookie `secure` não é salvo em HTTP |
| "Não foi possível conectar ao Firebird" | Testar `telnet HOST_CHERP 3050` da própria VPS; se não conectar, é firewall do lado do cliente |
| nginx não sobe depois de editar config | `sudo nginx -t` mostra a linha exata do erro |
| Migration falha | Conferir `DATABASE_URL` no `.env` e se o Postgres está no ar (`sudo systemctl status postgresql`) |
