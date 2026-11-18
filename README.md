# Plataforma Avaliativa

Sistema web full-stack desenvolvido para a E.E. Coronel Ary Gomes para gerenciar o fluxo completo de submissão, avaliação e acompanhamento de TCCs dos alunos de Desenvolvimento de Sistemas.

**Stack:** Node.js + Express · Prisma + PostgreSQL · JWT · Frontend em HTML/CSS/JS puro.

## Como funciona

| Perfil | O que faz |
|---|---|
| **Administrador** | Cadastra professores e alunos (e-mail + **senha provisória**), monta os **grupos**, cadastra os **critérios de avaliação** (documentos e apresentação) e cria as **atividades**. |
| **Professor** | 1) Abre os **documentos enviados**, dá as notas e comenta (nota do grupo). 2) Na **avaliação da apresentação**, dá a nota individual de cada aluno e comenta. 3) Publica as notas. |
| **Aluno** | Envia os documentos do grupo e acompanha as notas no **dashboard**. |

### Cálculo da nota
- **Nota do grupo** = soma das notas dos critérios de **documento** (vale para todos os integrantes).
- **Nota da apresentação** (individual) = soma de (nota × peso) dos critérios de **apresentação**, que têm cadastro próprio. Com mais de um professor na banca, vale a média das avaliações completas.
- **Nota final do aluno** = nota do grupo + nota da apresentação.

A regra fica em um único lugar: `src/utils/rubricCalculation.js`.

### Senha provisória
Professores e alunos são cadastrados com uma senha provisória. No primeiro acesso, o sistema obriga a criação de uma senha pessoal (o acesso fica bloqueado até a troca). O administrador pode redefinir uma senha provisória a qualquer momento.

## Instalação

```bash
npm install
cp .env.example .env        # ajuste DATABASE_URL, JWT_SECRET (32+ caracteres) e o admin inicial
npx prisma migrate deploy
npx prisma generate
npm run admin:create        # cria o administrador definido no .env
npm run dev                 # API em http://localhost:3000
```

Abra o `index.html` com o **Live Server** do VS Code em `http://127.0.0.1:5500` (endereço liberado no CORS; para outro endereço, ajuste `FRONTEND_URL` no `.env`).

Dados de teste (opcional, apenas desenvolvimento): `node src/scripts/seedDev.js`.

## Curso único
Todos os alunos pertencem à mesma turma e à mesma matéria: **Desenvolvimento de Sistemas**. Ao iniciar, o servidor cria (ou reaproveita) essa turma, a disciplina e o período letivo, e matricula automaticamente todos os alunos. Não há cadastro de turma nem matrícula manual.

## Roteiro de uso
1. **Admin › Professores e Alunos:** cadastre os professores e os alunos (o aluno pode já entrar em um grupo). Na lista de alunos, o seletor ao lado de cada nome muda o grupo dele.
2. **Admin › Grupos:** crie os grupos marcando os alunos de cada um. Cada aluno participa de um grupo só.
3. **Admin › 📄 Atividades — Documentos:** cadastre o que os grupos vão enviar (ex.: Documento do TCC), o prazo, os **critérios de avaliação do documento** e os **professores que corrigem os documentos** — tudo na mesma tela.
4. **Admin › 🎤 Avaliação da Apresentação:** seção **Critérios de Avaliação da Apresentação** — cadastro próprio, independente dos critérios dos documentos: nome, orientação ao avaliador, pontuação máxima, peso, ativo/inativo e ordem. Os critérios ativos aparecem automaticamente para a banca. Logo abaixo, marque os **professores da banca** de cada atividade.
5. **Aluno › Enviar Documentos:** escolhe os arquivos e clica em *Enviar documentos ao professor* (um clique: anexa e confirma).
6. **Professor › Documentos Enviados:** abre, baixa, dá as notas e comenta. Documentos anexados mas não confirmados pelo aluno também aparecem, marcados com aviso.
7. **Professor (banca) › Avaliação da Apresentação:** escolhe o projeto → vê o grupo e os integrantes → clica em **Avaliar** em cada aluno, dá a nota de cada critério, escreve observações e salva. Cada aluno tem a sua nota; cada professor da banca tem a sua avaliação (a nota da apresentação é a média da banca). Depois, *Publicar notas prontas*.
8. **Aluno › Minhas Notas:** confere nota do grupo, da apresentação, nota final e comentários.

Critérios dos documentos podem ser incluídos e excluídos até o primeiro lançamento de nota. Critérios da apresentação já usados não mudam de pontuação nem de peso; ao serem excluídos saem das telas, mas as notas já dadas continuam valendo. Notas publicadas ficam congeladas; alterá-las exige justificativa (registrada no histórico).

**Cálculo:** nota do grupo = soma das notas dos critérios dos documentos · nota individual da apresentação = soma de (nota × peso) dos critérios da apresentação (média da banca) · **nota final = grupo + apresentação**.
