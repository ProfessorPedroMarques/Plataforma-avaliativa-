# Publicação gratuita — Render + Neon

A plataforma fica num **único endereço** (telas + API) no **Render** e o banco PostgreSQL no **Neon**.
Os arquivos enviados pelos alunos ficam **dentro do banco** (o disco do plano gratuito do Render é apagado a cada reinício).

| O quê | Onde | Plano |
|---|---|---|
| Servidor + telas | Render — Web Service, região **Ohio** | gratuito |
| Banco PostgreSQL | Neon — região **AWS US East 2 (Ohio)** | gratuito (1 GB, sem expiração) |

> Nunca cole a connection string do banco, a senha do administrador ou o `JWT_SECRET` em chats, e-mails ou no GitHub.
> Eles ficam só nas configurações do Render.

---

## 1. Neon (banco de dados)
1. Em **neon.com**, crie o projeto com região **AWS US East 2 (Ohio)** e **somente "Banco de dados Postgres"** ativado.
2. No painel do projeto, clique em **Connect** (Conectar).
3. Deixe **"Connection pooling" desligado** e copie a **connection string**. Ela tem este formato:
   `postgresql://USUARIO:SENHA@ep-xxxx.us-east-2.aws.neon.tech/neondb?sslmode=require`
4. Guarde esse texto num lugar seguro (vai ser colado no Render no passo 2.4).

## 2. Render (servidor + telas)
1. Em **render.com**, entre com **"Sign in with GitHub"** e autorize o acesso ao repositório `Plataforma-avaliativa-`.
2. Clique em **New +** → **Blueprint** e escolha o repositório. O Render lê o arquivo `render.yaml` e já preenche tudo.
3. Confirme o serviço **avaliacao-pei-ary-gomes** (plano *Free*, região *Ohio*).
4. Preencha as variáveis que ele pedir:

   | Variável | O que colocar |
   |---|---|
   | `DATABASE_URL` | a connection string do Neon (passo 1.3) |
   | `BOOTSTRAP_ADMIN_NAME` | nome do administrador (ex.: `Administrador`) |
   | `BOOTSTRAP_ADMIN_EMAIL` | e-mail de login do administrador |
   | `BOOTSTRAP_ADMIN_PASSWORD` | senha do administrador — **mínimo de 12 caracteres** |

   `JWT_SECRET` é gerada sozinha; as demais já vêm preenchidas.
5. Clique em **Apply** (Aplicar) e acompanhe os **Logs**. A publicação está certa quando aparecem:
   - `All migrations have been successfully applied.`
   - `ADMINISTRADOR CONFIGURADO`
   - `Servidor: ...` e `Banco de dados: conectado`
6. Abra o endereço mostrado no topo (algo como `https://avaliacao-pei-ary-gomes.onrender.com`) e entre com o e-mail e a senha do administrador.

**Se a opção Blueprint não aparecer ou pedir pagamento:** use **New +** → **Web Service**, escolha o repositório e preencha manualmente:
Language `Node` · Branch `main` · Region `Ohio` · Build Command `npm ci && npm run build:render` · Start Command `npm start` · Instance Type `Free` ·
Health Check Path `/api/health` · variáveis da tabela acima + `JWT_SECRET` (texto aleatório de 40+ caracteres), `JWT_EXPIRES_IN=8h`, `FILE_STORAGE=database`, `MAX_UPLOAD_MB=20`, `NODE_VERSION=22`.

## 3. Depois de publicado
- **Atualizações:** todo merge no `main` publica a nova versão sozinho (leva alguns minutos).
- **Primeiro acesso do dia mais lento:** no plano gratuito o servidor "dorme" sem uso e leva cerca de 1 minuto para acordar.
- **O banco de produção começa vazio:** cadastre professores, alunos, grupos e atividades pelo administrador. Os dados de teste do seu computador não vão para o Neon.
- **Senha do administrador:** pode ser trocada pela própria plataforma (*Alterar senha*); novas publicações **não** a sobrescrevem.
  Para redefinir com a do Render, rode `npm run admin:create -- --reset` com a `DATABASE_URL` do Neon.
- **Espaço:** 1 GB no Neon para dados e arquivos. Com o limite de 20 MB por arquivo, dá algumas centenas de envios.

## Desenvolvimento local (continua igual)
`npm run dev` no backend e o `index.html` pelo Live Server (porta 5500), ou abra direto `http://localhost:3000`, que agora também entrega as telas.
Arquivos enviados antes desta versão estão na pasta `uploads`; para copiá-los para o banco: `npm run files:to-db`.
