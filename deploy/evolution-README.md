# Evolution API da oficina

Versão fixada: **v2.3.7**, última versão estável publicada pela Evolution Foundation quando esta integração foi criada. A linha 2.4 ainda é pré-lançamento. Fonte: https://github.com/evolution-foundation/evolution-api/releases.

1. Copie `deploy/evolution.env.example` para `deploy/evolution.env` e troque as duas credenciais. A senha do PostgreSQL deve conter apenas letras e números, pois também entra na URL de conexão. No Windows de desenvolvimento, este arquivo já pode ser gerado localmente; ele não entra no Git.
2. No servidor da aplicação, rode `docker compose -p oeste-freios-evolution --env-file deploy/evolution.env -f deploy/evolution-compose.yml up -d --wait`.
3. Na aplicação, abra **Configurações > WhatsApp**. Informe `http://127.0.0.1:8080`, a chave `EVOLUTION_API_KEY` e o nome da instância. Salve, crie a instância e leia o QR Code com o número da oficina.
4. Configure e teste **Configurações > E-mail** antes de enviar por e-mail. A opção de envio automático começa desativada.

## O que preencher em Configurações > WhatsApp

| Campo | Valor |
| --- | --- |
| Endereço da Evolution API | `http://127.0.0.1:8080` se a Evolution e o backend rodam no mesmo servidor. É o endereço visto pelo **backend**, não pelo celular. Se rodarem em máquinas diferentes, use o endereço privado alcançável pelo backend. |
| Nome da instância | Um nome escolhido por você, por exemplo `oeste-freios`. Não é o número do telefone. |
| Chave da API | O valor que você definiu em `EVOLUTION_API_KEY` no arquivo `deploy/evolution.env`. Não use a senha `EVOLUTION_DB_PASSWORD`. |

Depois de preencher, clique em **Salvar conexão**, **Criar instância** e **Gerar QR Code**, nessa ordem. No celular da oficina, abra **WhatsApp > Aparelhos conectados > Conectar aparelho** e leia o código. Por fim, clique em **Verificar conexão**. A chave da API é definida por você na instalação da Evolution; ela não é obtida no WhatsApp.

A porta 8080 fica restrita ao loopback do servidor. O backend acessa a Evolution por essa porta; o navegador nunca recebe a chave. Faça backup dos volumes `evolution_instances` e `evolution_postgres` junto dos demais backups. Se o backend rodar em outra máquina ou contêiner, use endereço privado acessível a partir dele e mantenha a Evolution fora da internet pública.

## Desenvolvimento no Windows

Esta integração precisa de contêineres Linux. Se o Windows ainda não tiver WSL 2 e Docker Desktop:

1. Abra PowerShell **como administrador**, rode `wsl --install --no-distribution` e reinicie o Windows quando solicitado.
2. Instale [Docker Desktop para Windows](https://docs.docker.com/desktop/setup/install/windows-install/) no modo por usuário com backend WSL 2. Abra o Docker Desktop e espere o motor iniciar.
3. No PowerShell, dentro de `C:\oeste_freios`, rode:

   ```powershell
   docker compose -p oeste-freios-evolution --env-file deploy/evolution.env -f deploy/evolution-compose.yml up -d --wait
   docker compose -p oeste-freios-evolution --env-file deploy/evolution.env -f deploy/evolution-compose.yml ps
   ```

O backend local usa `http://127.0.0.1:8080` para falar com o contêiner. Copie **somente o valor** de `EVOLUTION_API_KEY` do arquivo `deploy/evolution.env` para a tela; não use a senha do banco. O PostgreSQL da Evolution roda dentro do Compose e é separado do PostgreSQL já usado pelo aplicativo.

## Deploy na VPS

Instale [Docker Engine e o plugin Compose](https://docs.docker.com/engine/install/ubuntu/) na VPS antes do primeiro deploy com WhatsApp. Crie `/opt/oeste-freios-app/shared/evolution.env` com credenciais próprias da produção e permissão `600` para o usuário `oestefreios`; não copie a chave local para lá. O `deploy/deploy.sh` detecta esse arquivo e atualiza os contêineres antes de publicar cada release, usando o projeto fixo `oeste-freios-evolution` para preservar os volumes. Se o arquivo não existir, o deploy do aplicativo continua sem subir a Evolution.

Após publicar a release, em **Configurações > WhatsApp** de produção preencha o endereço `http://127.0.0.1:8080`, o nome da instância e a chave da produção. Crie a instância, conecte o WhatsApp da oficina pelo QR Code e confirme o estado **Conectado**. Configure e teste o SMTP em **Configurações > E-mail**; depois faça um envio manual de teste pela OS antes de ativar os gatilhos automáticos. As tabelas de histórico e fila de mensagens são aplicadas pela migration do próprio deploy.

O envio pelo WhatsApp Web é não oficial. A integração pode perder a sessão ou deixar de funcionar após mudanças do WhatsApp. O registro **enviado à integração** não comprova entrega ao cliente.
