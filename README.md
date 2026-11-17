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
- **Nota da apresentação** = soma das notas dos critérios de **apresentação** (individual).
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

## Roteiro de uso
1. **Admin › Professores e Alunos:** cadastre os professores e os alunos (já escolhendo a turma) e vincule cada professor à turma.
2. **Admin › Grupos:** crie os grupos da turma e adicione os alunos.
3. **Admin › Critérios de Avaliação:** crie um conjunto, cadastre os critérios de documento e de apresentação e clique em *Publicar*.
4. **Admin › Atividades:** crie a atividade (entrega em grupo) e selecione os critérios publicados.
5. **Aluno › Enviar Documentos:** qualquer integrante inicia o envio, anexa os arquivos e confirma.
6. **Professor › Documentos Enviados:** abra, baixe os arquivos, dê as notas e comente.
7. **Professor › Avaliação da Apresentação:** avalie cada aluno, conclua e publique.
8. **Aluno › Minhas Notas:** confere nota do grupo, da apresentação, nota final e comentários.
