# Avaliação com Claude real — 2026-11-24T03:31

Motor: agente (D-075) · Bot: claude-haiku-5-5 · Adriano simulado: claude-haiku-5-5 · Avaliador: claude-sonnet-5-5

Conferências objetivas: **91/96**

| Critério | Média (1–5) |
|---|---|
| entendimento | 3.83 |
| naturalidade | 3.30 |
| acessibilidade | 3.35 |
| uma_pergunta_por_vez | 3.78 |
| sem_invencao | 3.17 |
| eficiencia | 3.43 |
| conclusao | 4.57 |

## Problemas por classe

- baixa:tom: 23
- media:jargao: 17
- media:inventou: 11
- media:fluxo_confuso: 9
- media:pergunta_repetida: 9
- media:perdeu_informacao: 7
- alta:inventou: 7
- baixa:fluxo_confuso: 7
- baixa:texto_longo: 7
- baixa:pergunta_repetida: 6
- baixa:jargao: 5
- media:nao_entendeu: 5
- media:tom: 4
- baixa:perdeu_informacao: 3
- alta:perdeu_informacao: 3
- baixa:inventou: 3
- media:uma_pergunta_por_vez: 3
- baixa:nao_entendeu: 3
- media:pergunta_desnecessaria: 2
- baixa:pergunta_desnecessaria: 2
- baixa:pergunta_dupla: 2
- media:pergunta_dupla: 1
- baixa:travou: 1
- baixa:insistencia: 1
- alta:travou: 1
- alta:jargao: 1
- alta:pergunta_repetida: 1
- baixa:pressao: 1
- media:pergunta_ignorada: 1
- baixa:promessa_leve: 1
- media:pergunta_confusa: 1
- alta:nao_entendeu: 1
- baixa:pergunta_multipla: 1

## real-adriano-roberto-jo — Conversa real do Adriano: mesinha + 2 móveis do Seu Roberto e da Dona Jo

Notas: entendimento 4 · naturalidade 3 · acessibilidade 3 · uma_pergunta_por_vez 3 · sem_invencao 3 · eficiencia 3 · conclusao 4 · 98s

- ✅ 3 peças (mesinha + 2 aparadores)
- ✅ 2 aparadores reconhecidos
- ✅ técnica verniz em todos
- ✅ cliente Seu Roberto/Dona Jo
- ❌ aparadores só no tampo — [null,{"part":"tampo"}]
- ✅ medida/porte de todas as peças
- ✅ orçamento calculado para todos os serviços

> O fluxo chegou ao valor fechado e ao PDF, mas com perguntas repetidas sobre o que ele já tinha dito, mensagens com duas perguntas, menção a frete e jargão de prejuízo. O preço saltou de 510 para 717 por causa das 4 horas, sem explicar bem. O banco falhou em salvar o tampo dos aparadores.

- [media] (pergunta_desnecessaria) turno 3: Pergunta o tipo de móvel dos tampos, mas deixa ele contar tudo de uma vez; aceitável, porém o bot ignorou o 'mais outros dois móveis' sem pedir de forma mais simples. Também insiste em pedir foto em toda mensagem.
- [media] (pergunta_dupla) turno 6: Faz duas perguntas na mesma mensagem (é conserto como colar/massa? e quanto tempo leva?). Também pergunta tempo que ele já tinha dado (3 a 5 dias, material) e repete o convite de foto.
- [media] (jargao) turno 9: Usa 'Abaixo de R$ 416 você fica no prejuízo' e 'sugerido' sem explicar; pergunta horas e menciona frete, algo que ele nunca falou (ele busca e entrega). Duas questões na mesma mensagem.
- [baixa] (pergunta_repetida) turno 10: Pergunta horas da rachadura depois de ele já ter dito '2 dias só nisso'; ele precisou converter para 4 horas.
- [media] (fluxo_confuso) turno 12: Ele já havia aceitado 510, o preço muda sem clareza do porquê (4 horas elevam de 510 para 717, salto grande) e o texto é cheio de números; pede novo acordo.
- [baixa] (perdeu_informacao) turno 14: Pergunta prazo e início que ele já tinha dito (terça, 3 a 5 dias) nas mensagens anteriores.
- [media] (perdeu_informacao) turno 19: Banco falhou em registrar aparadores só no tampo ([null, {part:tampo}]) apesar do bot dizer que anotou; a conta pode estar errada. Também não registrou que ele vê a rachadura ao pegar a peça.
- [baixa] (tom) turno 22: Resposta um pouco seca no final, mas aceitável.

<details><summary>Conversa</summary>

```
1. ADRIANO (áudio): E aí, tudo bem? Então, terça eu vou buscar um trabalho do seu Roberto e da Dona Jo. É uma mesinha de centro que tem que lixar inteira e passar verniz, e tem mais outros dois móveis que é só o tampo. Queria saber quanto cobrar nisso aí.
2. BOT: 🎧 Ouvi: "E aí, tudo bem? Então, terça eu vou buscar um trabalho do seu Roberto e da Dona Jo. É uma mesinha de centro que tem que lixar inteira e passar verniz, e tem mais outros dois móveis que é só o tampo. Queria saber quanto cobrar nisso aí."
3. BOT: Anotei a mesinha de centro do Seu Roberto e da Dona Jo: lixar inteira e verniz, e você busca ✅

Pra anotar os dois tampos, qual é o móvel de cada um? Tipo cômoda, aparador, mesa...

📸 Se tiver foto da peça, manda que ajuda!
4. ADRIANO (áudio): Ah, são duas aparadoras. Os dois são aparador, só o tampo, lixar e envernizar. Os tampos tão melhores, não tão ruins quanto a mesinha. Cada tampo tem 1,20 por 40. A mesinha é redonda, 80 cm de diâmetro e 45 de altura, tampo meio danificado, tem que acertar uns detalhes ainda. Vou usar pincel. Verniz eu já tenho. Acho que leva uns 3 a 5 dias e o material dá uns 70 reais. Eu busco e entrego eu mesmo. Me fala aí quanto ficaria o orçamento.
5. BOT: 🎧 Ouvi: "Ah, são duas aparadoras. Os dois são aparador, só o tampo, lixar e envernizar. Os tampos tão melhores, não tão ruins quanto a mesinha. Cada tampo tem 1,20 por 40. A mesinha é redonda, 80 cm de diâmetro e 45 de altura, tampo meio danificado, tem que acertar uns detalhes ainda. Vou usar pincel. Verniz eu já tenho. Acho que leva uns 3 a 5 dias e o material dá uns 70 reais. Eu busco e entrego eu mesmo. Me fala aí quanto ficaria o orçamento."
6. BOT: Anotei os dois aparadores (só tampo, 1,20 x 0,40, lixar e verniz) e a mesinha redonda de 80 cm ✅

Pra mesinha, esse "acertar uns detalhes" é conserto mesmo, tipo colar ou massa? Quanto tempo você acha que leva?

📸 Se tiver foto da peça, manda que ajuda!
7. ADRIANO (áudio): Ah, é uma rachadura pequena no tampo, uns detalhes de massa e lixar nessa parte, nada de colar peça. Acho que uns 2 dias só nisso, mas eu vejo quando pegar ela. Pode fazer a conta pra mim aí, por favor.
8. BOT: 🎧 Ouvi: "Ah, é uma rachadura pequena no tampo, uns detalhes de massa e lixar nessa parte, nada de colar peça. Acho que uns 2 dias só nisso, mas eu vejo quando pegar ela. Pode fazer a conta pra mim aí, por favor."
9. BOT: Fiz as contas 🧮

• Mesinha de centro do Seu Roberto e Dona Jo: R$ 335,00
• Os 2 aparadores (só tampo): R$ 175,00
💰 Total sugerido: R$ 510,00. Abaixo de R$ 416,00 você fica no prejuízo.

Ainda não entrou o frete, e preciso saber quantas horas você acha que leva o conserto da rachadura. Quantas horas seriam?
   [botões: 👍 Concordo | ➖ Dar desconto | ➕ Acrescentar]
10. ADRIANO (áudio): Ah, das horas da rachadura eu não sei dizer certo, mas acho que umas 4 horas no total, contando massa e lixar. Quando pegar a mesinha eu vejo melhor. Esse valor de 510 tá bom pra mim, pode seguir.
11. BOT: 🎧 Ouvi: "Ah, das horas da rachadura eu não sei dizer certo, mas acho que umas 4 horas no total, contando massa e lixar. Quando pegar a mesinha eu vejo melhor. Esse valor de 510 tá bom pra mim, pode seguir."
12. BOT: Opa, a conta mudou. Os 510 foram antes de entrar as 4 horas da rachadura. Com elas, a sugestão sobe pra R$ 717,00 no total (mesinha R$ 542,00 e os 2 aparadores R$ 175,00), e abaixo de R$ 577,00 fica no prejuízo.

Você quer fechar em 717 ou prefere outro valor?
   [botões: 👍 Concordo | ➖ Dar desconto | ➕ Acrescentar]
13. ADRIANO: [tocou: 👍 Concordo]
14. BOT: Show, fechou o valor ✅

Pra eu fechar o PDF, preciso do prazo: a partir de quando você consegue começar, e quantos dias leva o trabalho todo?
15. ADRIANO (áudio): Terça eu busco, e acho que leva uns 3 a 5 dias pra fazer tudo. Começo logo que pegar, então pode colocar que começo na terça mesmo.
16. BOT: 🎧 Ouvi: "Terça eu busco, e acho que leva uns 3 a 5 dias pra fazer tudo. Começo logo que pegar, então pode colocar que começo na terça mesmo."
17. BOT: [PDF enviado: Proposta-AP-2026-0001-v1.pdf]
18. BOT: 📲 Pra mandar pro cliente: segure o PDF ☝️ → Compartilhar → WhatsApp.
19. BOT: Fechado em R$ 717,00 ✅ Anotei o início na terça e 3 a 5 dias de trabalho.

Te mandei o PDF aqui no Telegram pra você repassar ao cliente. Quando o Seu Roberto e a Dona Jo responderem, me avisa 👍
20. ADRIANO (áudio): Beleza, valeu! Então tá fechado, né? Quando o Seu Roberto e a Dona Jo responderem eu te falo. Obrigado!
21. BOT: 🎧 Ouvi: "Beleza, valeu! Então tá fechado, né? Quando o Seu Roberto e a Dona Jo responderem eu te falo. Obrigado!"
22. BOT: Valeu, Adriano! Tá fechado sim 👍 Quando eles responderem, me fala.
```

</details>

## admin-mesinha-criados — Administrador: mesinha + 2 criados-mudos, medidas todas de uma vez

Notas: entendimento 3 · naturalidade 3 · acessibilidade 3 · uma_pergunta_por_vez 4 · sem_invencao 2 · eficiencia 2 · conclusao 4 · 124s

- ✅ 3 peças
- ✅ 2 criados-mudos
- ✅ cliente Dona Carla
- ✅ medidas das 3 peças
- ✅ sem frete (cliente traz e busca)
- ❌ PDF gerado após o desconto

> O bot entendeu as peças e o desconto, mas repetiu perguntas que ele já tinha respondido e incluiu os R$ 70 de material, que ele já tinha, inflando o total. Barrou o PDF pedindo prazo e terminou com mensagem cortada. O valor com 10% de desconto foi obtido, mas o PDF não saiu, o que ele nem queria mais.

- [media] (pergunta_repetida) turno 6: Pergunta se os criados-mudos são só lixar e envernizar o tampo, o que ele já tinha dito no turno 1.
- [media] (pergunta_repetida) turno 9: Repete as perguntas sobre o serviço (tampo, lixar, envernizar), que ele já tinha respondido, e arrasta a conversa.
- [baixa] (pergunta_desnecessaria) turno 12: Pergunta se o verniz é por fora ou por dentro numa mesinha de centro redonda, algo já claro, além de perguntar sobre o estado do tampo que ele já tinha descrito.
- [alta] (perdeu_informacao) turno 15: Diz que os R$ 70 de material não entraram na conta, mas ele já tinha dito que tem o material. A pergunta induz a acrescentar o valor sem necessidade, e o preço sobe de R$ 663 para R$ 733.
- [media] (jargao) turno 15: Fala em 'prejuízo' e traz um mínimo calculado sem explicar de onde vem, além de mostrar muitos números.
- [alta] (inventou) turno 19: Soma R$ 70 de material no preço da mesinha, mas ele disse que já tem o material. O desconto é aplicado depois sobre esse total inflado, o que confunde o valor justo.
- [media] (tom) turno 24: Pergunta de novo 'fecha assim ou quer outro valor' e confirma o valor depois de ele ter dito que era só para ver.
- [media] (fluxo_confuso) turno 26: Insiste em perguntar o prazo antes do PDF, mesmo ele pedindo o PDF, e trava o pedido.
- [baixa] (travou) turno 30: A última mensagem foi cortada no meio da frase ('é só me ').

<details><summary>Conversa</summary>

```
1. ADRIANO (áudio): e aí, beleza? preciso de um orçamento. é uma mesinha de centro com o tampo um pouco danificado, precisa lixar, acertar uns detalhes e envernizar. e mais dois criados-mudos, mas só o tampo deles. vou levar uns 3 a 5 dias pra fazer tudo, e o material deve dar uns 70 reais.
2. BOT: 🎧 Ouvi: "e aí, beleza? preciso de um orçamento. é uma mesinha de centro com o tampo um pouco danificado, precisa lixar, acertar uns detalhes e envernizar. e mais dois criados-mudos, mas só o tampo deles. vou levar uns 3 a 5 dias pra fazer tudo, e o material deve dar uns 70 reais."
3. BOT: Anotei: mesinha de centro com tampo danificado, lixar, acertar detalhes e envernizar. E dois criados-mudos, só o tampo. ✅

De quem são essas peças? 📝

📸 Se tiver foto da peça, manda que ajuda!
4. ADRIANO (áudio): é da dona Carla. a mesinha é redonda, 2 metros de largura. os criados-mudos têm 80 cm de largura e 40 de altura, os dois iguais. a cliente deixa em casa e busca depois de pronto. pincel e uma faca pra raspar, já trnho o material. só falta o valor, aí depois vejo o desconto com ela
5. BOT: 🎧 Ouvi: "é da dona Carla. a mesinha é redonda, 2 metros de largura. os criados-mudos têm 80 cm de largura e 40 de altura, os dois iguais. a cliente deixa em casa e busca depois de pronto. pincel e uma faca pra raspar, já trnho o material. só falta o valor, aí depois vejo o desconto com ela"
6. BOT: Anotei tudo ✅ A mesinha é redonda, de 2 m, com a Dona Carla, e os dois criados-mudos têm 80 x 40 cm.

Nos criados-mudos, o trabalho é só lixar e envernizar o tampo, ou tem mais alguma coisa? 🪵
7. ADRIANO (áudio): só lixar e envernizar o tampo mesmo, nada mais. os dois são iguais, então é o mesmo serviço nos dois. e a mesinha é o que falei, lixar, acertar uns detalhes e envernizar.
8. BOT: 🎧 Ouvi: "só lixar e envernizar o tampo mesmo, nada mais. os dois são iguais, então é o mesmo serviço nos dois. e a mesinha é o que falei, lixar, acertar uns detalhes e envernizar."
9. BOT: Anotado: os dois criados-mudos levam verniz só no tampo, e a mesinha é redonda, de 2 m, com lixa, detalhes e verniz. ✅

Como tá o tampo dos criados-mudos: bom, só com riscos, ou com algum reparo? 🪵
10. ADRIANO (áudio): Os criados-mudos tão bem, só com riscos mesmo, nada de reparo. Só lixar e envernizar o tampo. A mesinha tem o tampo um pouco danificado, mas é só lixar e acertar uns detalhes.
11. BOT: 🎧 Ouvi: "Os criados-mudos tão bem, só com riscos mesmo, nada de reparo. Só lixar e envernizar o tampo. A mesinha tem o tampo um pouco danificado, mas é só lixar e acertar uns detalhes."
12. BOT: Anotei: os criados-mudos estão só com riscos, sem conserto, só verniz no tampo. ✅

Falta uma coisa da mesinha: o verniz é só por fora ou por dentro também? 🪵
13. ADRIANO (áudio): Por fora mesmo, só o tampo de cima. Por dentro e as pernas não precisa nada. Já tenho o material, então é isso. Quanto fica o valor? Depois vejo o desconto com a dona Carla.
14. BOT: 🎧 Ouvi: "Por fora mesmo, só o tampo de cima. Por dentro e as pernas não precisa nada. Já tenho o material, então é isso. Quanto fica o valor? Depois vejo o desconto com a dona Carla."
15. BOT: Fiz as contas das duas peças da Dona Carla:

• Mesinha redonda: R$ 488,00
• Dois criados-mudos (o par, só tampo): R$ 175,00

💰 Sugestão do total: R$ 663,00. Abaixo de R$ 535,00 você fica no prejuízo.

Os seus R$ 70 de material da mesinha não entraram na conta. Quer que eu inclua, ou fica assim? 🤔
   [botões: 👍 Concordo | ➖ Dar desconto | ➕ Acrescentar]
16. ADRIANO: [tocou: ➕ Acrescentar]
17. BOT: Opa, qual valor você quer acrescentar? É o R$ 70 do material ou outro valor? 🤔
18. ADRIANO: É o R$ 70 do material mesmo, pode incluir. Mas o material eu já tenho, então é só isso, sem nada a mais.
19. BOT: Pronto, incluí os R$ 70 de material na mesinha. ✅

• Mesinha redonda da Dona Carla: R$ 558,00
• Dois criados-mudos (o par, só tampo): R$ 175,00

💰 Total sugerido: R$ 733,00. Abaixo de R$ 605,00 você fica no prejuízo.

Você concorda com esse valor, ou quer dar um desconto? 🤔
   [botões: 👍 Concordo | ➖ Dar desconto | ➕ Acrescentar]
20. ADRIANO: [tocou: ➖ Dar desconto]
21. BOT: Beleza! Quanto você quer dar de desconto, em reais ou em porcentagem? 🤔
22. ADRIANO (áudio): Quero dar 10% de desconto no total, pode ser? Ainda não falei com a dona Carla, então isso é só pra gente ver o valor.
23. BOT: 🎧 Ouvi: "Quero dar 10% de desconto no total, pode ser? Ainda não falei com a dona Carla, então isso é só pra gente ver o valor."
24. BOT: Com 10% de desconto no total, fica R$ 659,70 (de R$ 733,00). ✅

Ainda tá acima do mínimo, então não tem prejuízo. Fecha assim pra você ver com a Dona Carla, ou quer outro valor? 💰
25. ADRIANO: Fecha assim, pode gerar o PDF. Ainda não falei com a dona Carla, então depois eu vejo com ela. Obrigado.
26. BOT: Show, o valor com o desconto ficou fechado pras duas peças. Antes de gerar o PDF, falta o prazo: quando você consegue começar e quanto tempo leva? 📅
27. ADRIANO: Não, não precisa do PDF agora não. Eu ainda não sei o prazo. Pode deixar aí que eu vejo com a dona Carla e te falo depois. Obrigado.
28. BOT: Beleza, sem PDF por enquanto. 👍 Fica tudo guardado aqui, com o valor com desconto nas duas peças. Quando tiver o prazo, é só me falar. 🪵
29. ADRIANO: Beleza, então fica guardado assim. Quando eu falar com a dona Carla e tiver o prazo, te aviso. Obrigado.
30. BOT: Show, Adriano! Quando tiver o prazo, é só me chamar. 👋
```

</details>

## admin-comoda-carla — Cômoda da Dona Carla (pátina), gavetão, correção e logística do cliente

Notas: entendimento 4 · naturalidade 4 · acessibilidade 4 · uma_pergunta_por_vez 4 · sem_invencao 3 · eficiencia 3 · conclusao 4 · 63s

- ✅ 1 serviço
- ✅ cômoda
- ✅ pátina
- ❌ 5 gavetas (4 + gavetão) — {"type":"comoda","descriptors":[],"attributes":{"drawers_count":4},"drawers":4}
- ✅ gavetão nas observações
- ✅ estilete nas observações
- ✅ pincel
- ✅ sem frete
- ✅ medidas 1 m × 0,8 m

> Conversa chegou ao valor, ao PDF e ao fechamento, e o tom foi simples e amigável. As falhas: o gavetão não foi guardado na contagem de gavetas (a conferência falhou) embora o bot dissesse que anotou, e a confirmação do valor foi pedida duas vezes. Além disso, 'acho que combinei' do frete virou fato firme.

- [media] (perdeu_informacao) turno 6: Disse que anotou 4 gavetas e o gavetão, mas o banco guardou só 4 gavetas (drawers_count 4). O gavetão não entrou na contagem, então o valor pode estar sem ele.
- [media] (pergunta_repetida) turno 11: Pediu de novo a confirmação do valor que ele já tinha aceitado no turno 7, repetindo os mesmos botões. Gerou uma troca a mais e o fechamento ficou mais longo.
- [baixa] (inventou) turno 11: Afirma 'a Dona Carla traz e busca' como fato, mas o Adriano disse 'acho que combinei assim'. Era incerto e foi tratado como certo. Também fixou 'segunda ou terça' sem deixar claro que é uma estimativa.
- [baixa] (jargao) turno 8: 'Valor combinado' e 'prazo pro PDF' soam um pouco burocráticos. Também não respondeu a pergunta do Adriano sobre o prazo de secagem entre as demãos, que ele mencionou no turno 9, e a explicação do turno 11 não a recupera.
- [baixa] (tom) turno 15: 'Quando ela responder, me avisa' pode soar como cobrança leve, mas não chega a pressionar. A mensagem de fechamento também repete informações já ditas e ficou um pouco longa.

<details><summary>Conversa</summary>

```
1. ADRIANO (áudio): Oi, tudo bem? Então, chegou uma cômoda da dona Carla pra eu fazer pátina. Ela tem uns 80 centímetros de largura por 1 metro de altura. Quero ver quanto cobrar nela.
2. BOT: 🎧 Ouvi: "Oi, tudo bem? Então, chegou uma cômoda da dona Carla pra eu fazer pátina. Ela tem uns 80 centímetros de largura por 1 metro de altura. Quero ver quanto cobrar nela."
3. BOT: Anotei: cômoda da Dona Carla, pátina, 80 cm de largura por 1 m de altura ✅

Qual o estado dela: está boa, precisa de reparos ou está bem danificada?

📸 Se tiver foto da peça, manda que ajuda!
4. ADRIANO (áudio): Ela tá boazinha. Só precisa fazer por fora mesmo, sem conserto nenhum. Não tenho foto agora, depois eu mando se precisar. Ela tem 4 gaveta e 1 gavetão, isso conta na pátina? Vou aplicar com pincel e estilete pra raspar. Ela traz e busca quando tiver pronta, acho que combinei assim com a dona Carla.
5. BOT: 🎧 Ouvi: "Ela tá boazinha. Só precisa fazer por fora mesmo, sem conserto nenhum. Não tenho foto agora, depois eu mando se precisar. Ela tem 4 gaveta e 1 gavetão, isso conta na pátina? Vou aplicar com pincel e estilete pra raspar. Ela traz e busca quando tiver pronta, acho que combinei assim com a dona Carla."
6. BOT: Conta sim, as gavetas entram no trabalho. Anotei 4 gavetas e o gavetão, e a cômoda da Dona Carla ficou assim 🪵

💰 Sugestão: R$ 539,00. Abaixo de R$ 437,00 você fica no prejuízo.
⏱️ Uns 9 horas, cerca de 3 dias de trabalho.

Você concorda com esse valor, ou quer dar um desconto ou acrescentar algo?
   [botões: 👍 Concordo | ➖ Dar desconto | ➕ Acrescentar]
7. ADRIANO: [tocou: 👍 Concordo]
8. BOT: Show, a cômoda da Dona Carla tá com o valor combinado ✅ Falta só o prazo pro PDF: quando você consegue começar ela?
9. ADRIANO (áudio): Começo essa semana, acho que segunda ou terça. Ela deve ficar pronta em uns 3 dias de trabalho, mas depende de secar entre as demãos. Pode colocar assim aí.
10. BOT: 🎧 Ouvi: "Começo essa semana, acho que segunda ou terça. Ela deve ficar pronta em uns 3 dias de trabalho, mas depende de secar entre as demãos. Pode colocar assim aí."
11. BOT: Pela conta, o valor continua R$ 539,00 com as horas e os materiais da peça. Ela começa segunda ou terça e leva uns 3 dias de trabalho, e a Dona Carla traz e busca.

Você confirma o valor de R$ 539,00 pra fechar o PDF?
   [botões: 👍 Concordo | ➖ Dar desconto | ➕ Acrescentar]
12. ADRIANO: [tocou: 👍 Concordo]
13. BOT: [PDF enviado: Proposta-AP-2026-0001-v1.pdf]
14. BOT: 📲 Pra mandar pro cliente: segure o PDF ☝️ → Compartilhar → WhatsApp.
15. BOT: Fechou! ✅ A cômoda da Dona Carla ficou em R$ 539,00, com início essa semana e uns 3 dias de trabalho.

Te mandei o PDF aqui. Quando ela responder, me avisa.
```

</details>

## abreu-isa-casal — Mesa de cabeceira do Seu Abreu e da Dona Isa (casal), cor e tempo estimado

Notas: entendimento 4 · naturalidade 3 · acessibilidade 3 · uma_pergunta_por_vez 2 · sem_invencao 3 · eficiencia 4 · conclusao 4 · 40s

- ✅ 1 serviço (casal = 1 cliente)
- ✅ cor azul marinho anotada
- ❌ tempo estimado anotado — "lixar e pintar de azul marinho; pintar de azul marinho, lixar antes"
- ✅ segundo dono não se perdeu
- ✅ porte médio usado

> A conversa chegou ao valor e ao fechamento com PDF, entendendo bem peça, cliente casal, cor e porte médio. Falhas: pergunta dupla no orçamento, jargão e formatação no turno 6, estimativa de 3 dias que contradiz os 3 a 5 do Adriano, resposta ambígua sobre o prazo para o cliente e o tempo estimado não foi gravado corretamente no banco.

- [media] (jargao) turno 6: Usa 'prejuízo' e 'Sugestão' em formato de relatório com markdown (**), além de mensagem com várias informações; o aviso do piso é seco e técnico para o Adriano.
- [media] (uma_pergunta_por_vez) turno 6: Pergunta duas coisas na mesma mensagem: se concorda/desconto/acréscimo e quando ele consegue começar.
- [media] (inventou) turno 6: Informa 'uns 3 dias de trabalho' sendo que o Adriano disse de 3 a 5 dias; o tempo dele não foi respeitado na estimativa.
- [baixa] (tom) turno 11: Mensagem de fechamento afirma 'Fechado' e pede para avisar quando o cliente responder, algo um pouco burocrático; mas ok.
- [media] (fluxo_confuso) turno 14: A resposta é ambígua: diz 'pode falar sim' e depois diz que não garante a semana exata; Adriano entende que pode prometer a semana seguinte ao cliente.
- [alta] (perdeu_informacao) turno 16: O tempo estimado de 3 a 5 dias não ficou registrado corretamente no banco (conferência falhou), e o resumo gravado do serviço ficou repetitivo/confuso, apesar de o bot dizer que anotou.
- [baixa] (tom) turno 16: Despedida abrupta 'Valeu, Adriano! 👋' sem lembrar de avisar quando o cliente responder.

<details><summary>Conversa</summary>

```
1. ADRIANO (áudio): e aí, dá pra fazer um orçamento novo? é a mesa de cabeceira do seu Abreu e da dona Isa, eles querem lixar e pintar de azul marinho. a mesa tá boa, só por fora, sem conserto nenhum
2. BOT: 🎧 Ouvi: "e aí, dá pra fazer um orçamento novo? é a mesa de cabeceira do seu Abreu e da dona Isa, eles querem lixar e pintar de azul marinho. a mesa tá boa, só por fora, sem conserto nenhum"
3. BOT: Anotei: mesa de cabeceira do Seu Abreu e Dona Isa, pintura azul marinho, só por fora, sem conserto ✅

Qual o tamanho dela, mais ou menos? Pode mandar em cm ou dizer pequena, média ou grande 📏

📸 Se tiver foto da peça, manda que ajuda!
4. ADRIANO (áudio): Ah, é tamanho médio. Não sei a medida exata não, mas dá pra ver que não é grande nem pequena. Ela tá boa, só pintura mesmo. Pincel, sem busca nem entrega, eles vêm pegar com a mesa pronta. Acho que leva de 3 a 5 dias pra fazer tudo.
5. BOT: 🎧 Ouvi: "Ah, é tamanho médio. Não sei a medida exata não, mas dá pra ver que não é grande nem pequena. Ela tá boa, só pintura mesmo. Pincel, sem busca nem entrega, eles vêm pegar com a mesa pronta. Acho que leva de 3 a 5 dias pra fazer tudo."
6. BOT: Pronto, fiz a conta da mesa de cabeceira do Seu Abreu e Dona Isa 🧮

💰 Sugestão: **R$ 484,00**
⚠️ Abaixo de R$ 389,78 você fica no prejuízo.
⏱️ Dá uns 3 dias de trabalho.

Concorda com esse valor, quer dar um desconto ou acrescentar algo? Também me diz quando você consegue começar.
   [botões: 👍 Concordo | ➖ Dar desconto | ➕ Acrescentar]
7. ADRIANO (áudio): Ó, achei o valor razoável pelo que a gente falou. Não é serviço grande, mas também não é pouca coisa, com lixa, fundo e pintura caprichada. Pode fechar como tá. Só não dá pra começar já, tenho uma peça na frente que termina semana que vem, então consigo pegar essa mesa depois disso.
8. BOT: 🎧 Ouvi: "Ó, achei o valor razoável pelo que a gente falou. Não é serviço grande, mas também não é pouca coisa, com lixa, fundo e pintura caprichada. Pode fechar como tá. Só não dá pra começar já, tenho uma peça na frente que termina semana que vem, então consigo pegar essa mesa depois disso."
9. BOT: [PDF enviado: Proposta-AP-2026-0001-v1.pdf]
10. BOT: 📲 Pra mandar pro cliente: segure o PDF ☝️ → Compartilhar → WhatsApp.
11. BOT: Fechado por R$ 484,00 ✅ Te mandei o PDF aqui no Telegram pra você repassar ao cliente.

O prazo que ficou anotado: começa depois da peça que termina semana que vem, e leva de 3 a 5 dias. Quando o cliente responder, me avisa 👍
12. ADRIANO (áudio): Beleza, valeu! Então tá fechado. Só uma coisa: a peça que termina semana que vem, quando eu falar com o cliente, já posso dizer que começo na semana seguinte mesmo?
13. BOT: 🎧 Ouvi: "Beleza, valeu! Então tá fechado. Só uma coisa: a peça que termina semana que vem, quando eu falar com o cliente, já posso dizer que começo na semana seguinte mesmo?"
14. BOT: Pode falar, sim, que a mesa entra na fila depois da peça atual. Só não tenho como garantir a semana exata daqui, isso depende de como a peça atual andar 😉

Se quiser, me diz a data que você prefere e eu anoto no prazo.
15. ADRIANO: Entendi, então posso falar pra eles que começo na semana seguinte. Pode anotar isso. Valeu!
16. BOT: Anotado ✅ A mesa do Seu Abreu e Dona Isa começa na semana seguinte ao fim da peça atual, e leva de 3 a 5 dias.

Valeu, Adriano! 👋
```

</details>

## licele-cama — Cama queen da Dona Licele (medida do colchão é só referência)

Notas: entendimento 4 · naturalidade 3 · acessibilidade 3 · uma_pergunta_por_vez 4 · sem_invencao 4 · eficiencia 2 · conclusao 5 · 74s

- ✅ 1 serviço
- ✅ cama
- ✅ Dona Licele
- ✅ verniz

> Objetivo atingido: orçamento mostrado, ele concordou, PDF gerado e data anotada como 'semana que vem'. Mas o bot fez perguntas desnecessárias (por dentro/fora, conserto, frete já dito), alongando a conversa, e repetiu a pergunta da data quase igual. Não inventou fatos relevantes, mas tom e eficiência ficaram medianos.

- [media] (pergunta_repetida) turno 11: Perguntou 'por fora ou por dentro' numa cama, pergunta sem sentido, sendo que ele já tinha dito lixar a cama inteira. Gerou nova rodada.
- [media] (pergunta_repetida) turno 14: Perguntou sobre conserto depois que ele já tinha dito que eram só riscos superficiais no verniz velho.
- [media] (pergunta_repetida) turno 17: Perguntou quem leva e traz a cama, mas ele já tinha dito desde o início que não precisa de frete.
- [baixa] (fluxo_confuso) turno 8: Sugeriu 'porte médio' por conta própria e pediu confirmação, jargão de porte e rodadas extras; ele só confirmou.
- [media] (jargao) turno 20: Mensagem do orçamento com 'prejuízo' em tom de alerta, e mistura de estimativa e horas/dias sem explicar; ainda usa formato carregado. Aceitável, mas denso.
- [media] (nao_entendeu) turno 22: Ele respondeu 'Beleza, Adriano. Quando você consegue começar...' (transcrição confusa, ecoando a pergunta). O bot repetiu a pergunta quase igual em vez de entender que era eco.
- [baixa] (tom) turno 30: Enviou PDF e fechou antes de confirmar a data; disse 'dia a definir', correto, mas texto fechou com 'Quando ela responder, me avisa', leve cobrança.
- [baixa] (texto_longo) turno 4: Repete todo o áudio transcrito a cada turno, dobrando o número de mensagens.

<details><summary>Conversa</summary>

```
1. ADRIANO: E aí, tudo bem? Queria registrar um serviço aqui, é um móvel da dona Licele. Vou te mandar os detalhes, pode ser?
2. BOT: Opa, tudo bem sim! 😄 Pode mandar os detalhes da peça da Dona Licele, um de cada vez se preferir. Qual é o móvel?
3. ADRIANO (áudio): É uma cama queen. Vou lixar e envernizar a cama inteira, cabeceira e peseira. Tem uns riscos nela. Não sei a medida da estrutura, só sei que é queen. Vai ser pincel e não precisa de frete.
4. BOT: 🎧 Ouvi: "É uma cama queen. Vou lixar e envernizar a cama inteira, cabeceira e peseira. Tem uns riscos nela. Não sei a medida da estrutura, só sei que é queen. Vai ser pincel e não precisa de frete."
5. BOT: Anotei: cama queen da Dona Licele, lixar e envernizar inteira (cabeceira e peseira), pincel, sem frete, com uns riscos. 🛏️

Pra cama queen, você considera porte grande? Se tiver foto, manda que ajuda 📸
6. ADRIANO (áudio): Porte grande não, é queen normal mesmo. Foto eu não tenho agora, mas os riscos são superficiais, tem uns arranhões no verniz velho. Não sei a medida exata da estrutura, então se precisar disso pode deixar em aberto que eu confirmo depois.
7. BOT: 🎧 Ouvi: "Porte grande não, é queen normal mesmo. Foto eu não tenho agora, mas os riscos são superficiais, tem uns arranhões no verniz velho. Não sei a medida exata da estrutura, então se precisar disso pode deixar em aberto que eu confirmo depois."
8. BOT: Anotei: cama queen normal, riscos superficiais, sem medida da estrutura por enquanto. 🛏️

Então fica porte médio, certo?
9. ADRIANO (áudio): Isso, porte médio. Pode deixar a medida em aberto que eu confirmo depois. Só uma coisa: o verniz velho tem arranhão, então vou lixar bem antes de envernizar, tá certo? Pode seguir.
10. BOT: 🎧 Ouvi: "Isso, porte médio. Pode deixar a medida em aberto que eu confirmo depois. Só uma coisa: o verniz velho tem arranhão, então vou lixar bem antes de envernizar, tá certo? Pode seguir."
11. BOT: Anotei: lixar bem o verniz velho antes de envernizar ✅ Pra cama, é só por fora mesmo ou por dentro também?
12. ADRIANO (áudio): Isso mesmo, por fora. Pode lixar bem o verniz velho antes de envernizar. A medida fica em aberto e eu confirmo depois.
13. BOT: 🎧 Ouvi: "Isso mesmo, por fora. Pode lixar bem o verniz velho antes de envernizar. A medida fica em aberto e eu confirmo depois."
14. BOT: Anotado: cama queen da Dona Licele, só por fora, lixar bem e envernizar, pincel, medida em aberto. 🛏️

Ela precisa de algum conserto, ou é só lixar e envernizar mesmo?
15. ADRIANO (áudio): Só lixar e envernizar mesmo. Os riscos são só arranhão no verniz velho, nada de conserto. Pode seguir com isso.
16. BOT: 🎧 Ouvi: "Só lixar e envernizar mesmo. Os riscos são só arranhão no verniz velho, nada de conserto. Pode seguir com isso."
17. BOT: Anotado: cama sem conserto, só lixar e envernizar. ✅ Falta só saber quem leva e traz a cama. Ela traz e busca, ou você vai buscar e entregar?
18. ADRIANO (áudio): Ela traz e busca, eu não preciso buscar nem entregar. Sem frete mesmo. Pode seguir com o orçamento.
19. BOT: 🎧 Ouvi: "Ela traz e busca, eu não preciso buscar nem entregar. Sem frete mesmo. Pode seguir com o orçamento."
20. BOT: Fechou! Cama queen da Dona Licele, lixar e envernizar, sem frete.

💰 Minha sugestão: **R$ 417,00**
⚠️ Abaixo de R$ 341,94 você fica no prejuízo.
⏱️ Umas 6 horas, cerca de 3 dias de trabalho.

Você concorda, quer dar desconto ou acrescentar algo? 🤝
   [botões: 👍 Concordo | ➖ Dar desconto | ➕ Acrescentar]
21. ADRIANO: [tocou: 👍 Concordo]
22. BOT: Show! Antes de fechar, quando você consegue começar a cama? 📅
23. ADRIANO (áudio): Beleza, Adriano. Quando você consegue começar, não precisa ser data certa, pode falar tipo 'semana que vem' ou 'não sei ainda' que eu anoto.
24. BOT: 🎧 Ouvi: "Beleza, Adriano. Quando você consegue começar, não precisa ser data certa, pode falar tipo 'semana que vem' ou 'não sei ainda' que eu anoto."
25. BOT: Beleza! Então pode ser simples: quando você consegue começar a cama? Pode ser "semana que vem" ou "ainda não sei", que eu anoto. 📅
26. ADRIANO (áudio): Ah, então vou ver com a agenda aqui. Acho que consigo começar semana que vem, mas ainda não sei o dia certo. Anota aí.
27. BOT: 🎧 Ouvi: "Ah, então vou ver com a agenda aqui. Acho que consigo começar semana que vem, mas ainda não sei o dia certo. Anota aí."
28. BOT: [PDF enviado: Proposta-AP-2026-0001-v1.pdf]
29. BOT: 📲 Pra mandar pro cliente: segure o PDF ☝️ → Compartilhar → WhatsApp.
30. BOT: Fechado! Anotei começar semana que vem, dia a definir. ✅

Te mandei o PDF aqui no Telegram, de R$ 417,00 pra Dona Licele. Quando ela responder, me avisa.
31. ADRIANO (áudio): Valeu, Adriano! Recebi o PDF. Vou mandar pra Dona Licele pelo WhatsApp. Quando ela responder eu te falo.
32. BOT: 🎧 Ouvi: "Valeu, Adriano! Recebi o PDF. Vou mandar pra Dona Licele pelo WhatsApp. Quando ela responder eu te falo."
33. BOT: Beleza! Quando a Dona Licele responder, me avisa. 👍
```

</details>

## preco-material-solvente — Preço de material na hora do orçamento: 'duas latas por 150' e 'não uso solvente'

Notas: entendimento 5 · naturalidade 4 · acessibilidade 3 · uma_pergunta_por_vez 4 · sem_invencao 4 · eficiencia 5 · conclusao 5 · 39s

- ✅ verniz = R$ 75 por lata (150 ÷ 2)
- ✅ embalagem 900 ml
- ✅ solvente continua sem preço (não usa)
- ✅ solvente fora deste orçamento
- ✅ orçamento calculado

> Conversa eficiente que chega ao objetivo. O assistente entendeu o preço das duas latas (R$ 75 cada), registrou que não há solvente, calculou R$ 285, o Adriano concordou e o PDF foi gerado. Pontos fracos: o turno 9 tem jargão e informação densa sobre prejuízo e horas, e há redundância no fechamento. A data de início foi aceita como 'não sei ainda' sem insistência.

- [media] (jargao) turno 9: Usa 'prejuízo' e apresenta o piso de R$ 231,00 e '5 horas, ou 2 dias de trabalho' sem explicar de onde vêm. A informação é seca e pode confundir o Adriano. Também mostra a sugestão de valor logo de cara, sem contexto.
- [baixa] (texto_longo) turno 9: A mensagem junta preço do verniz, sugestão, limite mínimo, tempo e pergunta com três opções. Está carregada para quem prefere conversa simples.
- [baixa] (fluxo_confuso) turno 11: Condiciona o PDF à data de início ('Pra sair o PDF, quando você consegue começar'), mas o PDF saiu mesmo sem data definida, o que é inconsistente. A data não é necessária para o orçamento.
- [baixa] (tom) turno 16: Repete 'Fechado ✅' após 'Fechou então!' e avisa duas vezes que o PDF foi enviado (turnos 14-16). Ficou redundante. A promessa 'eu atualizo o prazo' é aceitável, pois ele avisa depois.

<details><summary>Conversa</summary>

```
1. ADRIANO (áudio): e aí, beleza? to com uma mesa da dona Ana aqui pra envernizar. ela ta boa, so precisa dar o verniz por fora. mede 1 metro por 60 cm de tampo e 75 de altura. sem conserto nenhum, so o acabamento mesmo. pincel e sem frete
2. BOT: 🎧 Ouvi: "e aí, beleza? to com uma mesa da dona Ana aqui pra envernizar. ela ta boa, so precisa dar o verniz por fora. mede 1 metro por 60 cm de tampo e 75 de altura. sem conserto nenhum, so o acabamento mesmo. pincel e sem frete"
3. BOT: Anotei a mesa da Dona Ana: verniz por fora, sem conserto, pincel, 100 x 60 x 75 cm ✅

Essa mesa vai ser buscada ou entregue por você, ou ela leva e traz?

📸 Se tiver foto da peça, manda que ajuda!
4. ADRIANO (áudio): Ela leva e traz, não precisa buscar nem entregar. Sem frete. Foto eu não tenho agora, depois eu mando se precisar. Pode seguir aí.
5. BOT: 🎧 Ouvi: "Ela leva e traz, não precisa buscar nem entregar. Sem frete. Foto eu não tenho agora, depois eu mando se precisar. Pode seguir aí."
6. BOT: Anotado: a Dona Ana leva e traz, sem frete ✅

Antes de fechar o valor, preciso do preço do verniz. Quanto custa a lata e de quantos ml ela é?
7. ADRIANO (áudio): Comprei duas latas de 900 ml, deu 150 reais no total. Solvente eu não usei nesse trabalho, só o verniz mesmo.
8. BOT: 🎧 Ouvi: "Comprei duas latas de 900 ml, deu 150 reais no total. Solvente eu não usei nesse trabalho, só o verniz mesmo."
9. BOT: Anotei: verniz 900 ml por R$ 75, sem solvente. Pra mesa da Dona Ana, minha sugestão é R$ 285,00 ✅

Abaixo de R$ 231,00 você fica no prejuízo. Leva umas 5 horas, ou 2 dias de trabalho.

Você concorda com esse valor, quer dar um desconto ou acrescentar algo? 🤝
   [botões: 👍 Concordo | ➖ Dar desconto | ➕ Acrescentar]
10. ADRIANO: [tocou: 👍 Concordo]
11. BOT: Fechou então! 🤝 Pra sair o PDF, quando você consegue começar a mesa da Dona Ana?
12. ADRIANO (áudio): Começo essa semana, depois de terminar uma coisa que já está na oficina. Não sei o dia certo ainda, te falo quando definir.
13. BOT: 🎧 Ouvi: "Começo essa semana, depois de terminar uma coisa que já está na oficina. Não sei o dia certo ainda, te falo quando definir."
14. BOT: [PDF enviado: Proposta-AP-2026-0001-v1.pdf]
15. BOT: 📲 Pra mandar pro cliente: segure o PDF ☝️ → Compartilhar → WhatsApp.
16. BOT: Fechado ✅ O PDF da mesa da Dona Ana, R$ 285,00, já foi pra você aqui no Telegram. Pode repassar pra ela.

Quando você definir o dia de começar, me avisa que eu atualizo o prazo.
```

</details>

## pagamento-gasto — Pagamento e gasto no dia a dia

Notas: entendimento 5 · naturalidade 4 · acessibilidade 5 · uma_pergunta_por_vez 4 · sem_invencao 5 · eficiencia 4 · conclusao 5 · 23s

- ✅ pagamento de R$ 200
- ✅ gasto de R$ 90

> Conversa eficiente: pagamento de R$ 200 e gasto de R$ 90 registrados corretamente, sem invenção e com linguagem simples. Os únicos deslizes são pequenos: o bot insiste em puxar o orçamento da cristaleira quando o objetivo era só registrar. O encerramento foi cordial e adequado.

- [baixa] (pergunta_desnecessaria) turno 5: Depois de anotar o pagamento, oferece calcular o orçamento, embora o objetivo fosse só registrar pagamento e gasto. A pergunta também não leva em conta que o Adriano já tinha dito que mandaria o gasto depois.
- [baixa] (insistencia) turno 9: Volta a puxar o orçamento da cristaleira (medidas e trabalho) logo após anotar o gasto, o que é uma leve pressão sobre um assunto que não era o objetivo.
- [baixa] (tom) turno 3: A mensagem mistura confirmação do pagamento com aviso sobre o gasto, deixando o fluxo um pouco carregado. A frase 'Confirma no botão aí' soa mecânica.

<details><summary>Conversa</summary>

```
1. ADRIANO (áudio): E aí, beleza? Então, rapaz, a dona Maria pagou duzentos reais da cristaleira hoje, de entrada. Anota aí pra mim, por favor, que depois eu quero passar o gasto de noventa reais que fiz com verniz numa loja também hoje.
2. BOT: 🎧 Ouvi: "E aí, beleza? Então, rapaz, a dona Maria pagou duzentos reais da cristaleira hoje, de entrada. Anota aí pra mim, por favor, que depois eu quero passar o gasto de noventa reais que fiz com verniz numa loja também hoje."
3. BOT: Opa, beleza! Vou anotar a entrada de R$ 200 da cristaleira da Dona Maria ✅ Confirma no botão aí. Quando quiser, me manda o gasto de R$ 90 com o verniz.
   [botões: ✅ Pode anotar | ✏️ Não]
4. ADRIANO: [tocou: ✅ Pode anotar]
5. BOT: Pagamento de R$ 200 da cristaleira da Dona Maria anotado ✅ A cristaleira ainda não tem orçamento fechado. Quer que eu calcule agora, ou manda primeiro o gasto de R$ 90 do verniz? 🪵
6. ADRIANO: Manda o gasto primeiro
7. BOT: Gasto de R$ 90 com verniz preparado ✅ Confirma no botão aí.
   [botões: ✅ Pode anotar | ✏️ Não]
8. ADRIANO: [tocou: ✅ Pode anotar]
9. BOT: Gasto de R$ 90 com verniz anotado ✅ Quando quiser, me fala das medidas e do trabalho da cristaleira da Dona Maria pra gente fazer o orçamento. 🪵
10. ADRIANO (áudio): Beleza, valeu! Então tá anotado a entrada de 200 da dona Maria e o gasto de 90 com o verniz. Pra cristaleira, a gente faz o orçamento depois, tenho que medir ela direitinho e ver o que vai ter que fazer nela.
11. BOT: 🎧 Ouvi: "Beleza, valeu! Então tá anotado a entrada de 200 da dona Maria e o gasto de 90 com o verniz. Pra cristaleira, a gente faz o orçamento depois, tenho que medir ela direitinho e ver o que vai ter que fazer nela."
12. BOT: Beleza, Adriano! Tá tudo anotado ✅ Quando medir a cristaleira e ver o que precisa fazer, me chama que a gente monta o orçamento. 🪵
13. ADRIANO: Valeu, então tá bom. Quando eu medir a cristaleira eu te chamo. Obrigado!
14. BOT: Valeu, Adriano! Quando medir, é só chamar 👋
```

</details>

## andamento-nao-andamento — Andamento: 'comecei' muda; 'quando ficar pronta ela busca' não muda

Notas: entendimento 4 · naturalidade 3 · acessibilidade 4 · uma_pergunta_por_vez 4 · sem_invencao 3 · eficiencia 2 · conclusao 5 · 73s

- ✅ serviço em execução (não concluído)

> O bot registrou corretamente que a cristaleira começou e manteve o 'ela busca' sem marcar como pronta, o objetivo central. Falhou na eficiência: um laço de confirmações de despedida por mais de 15 turnos. Também houve uma pequena invenção ('na sua casa') e uma inconsistência sobre quem marca a conclusão.

- [media] (inventou) turno 3: Disse que a Dona Maria busca 'na sua casa', local que o Adriano não informou. Também registrou o comentário de buscar como dado do serviço logo na primeira confirmação.
- [baixa] (pergunta_repetida) turno 5: Pediu as medidas em cm e depois insistiu na largura (turnos 11 e 8), mesmo com ele dizendo que mediria depois. A insistência foi leve, mas ele já tinha dito que não sabia.
- [baixa] (tom) turno 17: Repetiu 'quando decidir a técnica, me chama' várias vezes ao longo da conversa, soando como cobrança velada.
- [media] (fluxo_confuso) turno 25: Disse que prepara a mudança para concluída quando ele avisar, contradizendo o turno 23, em que ele marcava. Também sugere um fluxo de confirmação por botão que não foi mostrado.
- [baixa] (nao_entendeu) turno 23: Afirmou que ele marca como concluída 'quando ela estiver pronta pra buscar', distorcendo levemente a fala dele.
- [alta] (travou) turno 27: Entre os turnos 18 e 35 ficou preso num laço de despedidas e confirmações repetidas, ecoando o mesmo resumo em vez de encerrar logo após o turno 19 ou 21.
- [baixa] (jargao) turno 3: Perguntou o estado como 'bom, com reparos ou danificada', linguagem de formulário e não de conversa de oficina.

<details><summary>Conversa</summary>

```
1. ADRIANO (áudio): E aí, fala. Hoje comecei a lixar a cristaleira da dona Maria, aquela de três portas. Ainda não decidi a técnica, vou ver como fica depois que tirar o verniz velho. Quando ficar pronta ela vem buscar.
2. BOT: 🎧 Ouvi: "E aí, fala. Hoje comecei a lixar a cristaleira da dona Maria, aquela de três portas. Ainda não decidi a técnica, vou ver como fica depois que tirar o verniz velho. Quando ficar pronta ela vem buscar."
3. BOT: Opa, anotei a cristaleira da Dona Maria, de 3 portas, com ela buscando na sua casa ✅ Vou marcar como iniciada, confirma aí no botão. Quando você decidir a técnica, me fala como ficou o estado dela (bom, com reparos ou danificada) 🪵
   [botões: ✅ Confirmar | ✏️ Não]
4. ADRIANO: [tocou: ✅ Confirmar]
5. BOT: Show, a situação da cristaleira da Dona Maria já está como iniciada ✅ Anotei que ela vem buscar quando ficar pronta.

Quando decidir a técnica, me conta. Quais são as medidas dela em cm (altura, largura e fundura)? 📏
6. ADRIANO (áudio): Não sei as medidas de cabeça agora, vou ver na peça depois e te falo. Ela tem uns 1,80 de altura, mas não medi direito ainda.
7. BOT: 🎧 Ouvi: "Não sei as medidas de cabeça agora, vou ver na peça depois e te falo. Ela tem uns 1,80 de altura, mas não medi direito ainda."
8. BOT: Anotei a altura de 1,80 m, aproximada, pra você medir direito depois ✅ Quando souber a largura e a fundura, me manda.

Enquanto isso, qual é o estado dela hoje: está boa, com reparos ou danificada? 🪵
9. ADRIANO (áudio): Ela tá boa, só tem um arranhão aqui na porta do meio e o verniz tá meio opaco. Nada de estrutura, nem madeira solta. Quando eu tirar o verniz velho aí eu vejo melhor se precisa de reparo.
10. BOT: 🎧 Ouvi: "Ela tá boa, só tem um arranhão aqui na porta do meio e o verniz tá meio opaco. Nada de estrutura, nem madeira solta. Quando eu tirar o verniz velho aí eu vejo melhor se precisa de reparo."
11. BOT: Anotei: ela está boa, com um arranhão na porta do meio e verniz opaco, sem problema de estrutura ✅ Se aparecer algo depois de tirar o verniz, você me conta.

Qual é a largura dela, mais ou menos? 📏
12. ADRIANO (áudio): Ah, a largura eu não sei de cabeça não. Quando eu for lá medir eu te falo, junto com a fundura. Anota aí que o resto tá certo: ela vem buscar quando ficar pronta, e hoje só lixei.
13. BOT: 🎧 Ouvi: "Ah, a largura eu não sei de cabeça não. Quando eu for lá medir eu te falo, junto com a fundura. Anota aí que o resto tá certo: ela vem buscar quando ficar pronta, e hoje só lixei."
14. BOT: Anotado: a cristaleira vem buscar quando ficar pronta, e hoje foi só lixa ✅ Medida de largura e fundura fica pra quando você for lá.

Ela tem parte de dentro que também vai ser tratada, ou é só por fora? 🪵
15. ADRIANO (áudio): Isso, é só por fora. A parte de dentro tá boa, não precisa mexer. Hoje foi só lixa mesmo, depois eu vejo a técnica quando tirar o verniz velho.
16. BOT: 🎧 Ouvi: "Isso, é só por fora. A parte de dentro tá boa, não precisa mexer. Hoje foi só lixa mesmo, depois eu vejo a técnica quando tirar o verniz velho."
17. BOT: Anotado: só por fora, parte de dentro não mexe ✅

Quando tirar o verniz e decidir a técnica, me chama. Bora! 🎨
18. ADRIANO: Show, valeu! Então tá anotado. Quando eu for lá medir a largura e a fundura eu te falo, e quando tirar o verniz e decidir a técnica eu chamo você.
19. BOT: Beleza! Quando medir e decidir a técnica, é só me chamar 🪵
20. ADRIANO: Valeu! Então tá anotado. Quando eu for lá medir a largura e a fundura eu te falo, e quando tirar o verniz velho e decidir a técnica eu chamo você. Fechou.
21. BOT: Fechou! 🪵 Quando medir e decidir a técnica, é só chamar.
22. ADRIANO: Fechou! Só uma coisa: quando a Dona Maria vier buscar, depois que estiver pronta, aí sim eu marco como concluída. Por enquanto fica em andamento, só lixada. Valeu!
23. BOT: Fechou! ✅ Por enquanto a cristaleira fica em andamento, e você marca como concluída quando ela estiver pronta pra buscar.

Valeu, Adriano! 👋
24. ADRIANO: Isso mesmo, valeu! Só pra confirmar: a cristaleira fica em andamento, só lixada, e eu marco como concluída quando você falar que ela tá pronta pra Dona Maria buscar. Fechou!
25. BOT: Isso, fechou! ✅ A cristaleira fica em andamento, só lixada. Quando ela estiver pronta, me avisa que eu preparo a mudança pra concluída e você confirma no botão.
26. ADRIANO: Isso mesmo, valeu! Só mais uma coisa: não marca como concluída ainda, a Dona Maria só busca depois que estiver pronta. Fica em andamento. Fechou!
27. BOT: Fechou! ✅ A cristaleira da Dona Maria fica em andamento, sem marcar como concluída. Quando ela estiver pronta, é só me avisar. 🪵
28. ADRIANO: Isso, fechou! Só lixada, em andamento. Valeu!
29. BOT: Fechou, Adriano! 🪵 A cristaleira da Dona Maria segue em andamento, só lixada. Valeu!
30. ADRIANO: Valeu! Então é isso: cristaleira da Dona Maria em andamento, só lixada. Quando eu medir e decidir a técnica, te chamo.
31. BOT: Fechou, Adriano! 🪵 Cristaleira da Dona Maria em andamento, só lixada. Quando medir e decidir a técnica, é só chamar. Valeu!
32. ADRIANO: Valeu! Então é isso mesmo, cristaleira da Dona Maria em andamento, só lixada. Quando eu medir e decidir a técnica eu chamo você. Fechou!
33. BOT: Fechou, Adriano! 🪵 Cristaleira da Dona Maria segue em andamento, só lixada. Quando medir e decidir a técnica, é só chamar. Valeu!
34. ADRIANO: Isso, Adriano, tá certo. Cristaleira da Dona Maria em andamento, só lixada. Quando eu medir e decidir a técnica, te chamo. Obrigado, valeu!
35. BOT: Valeu, Adriano! 👋 Quando medir e decidir a técnica, é só chamar.
```

</details>

## fora-do-roteiro — Fora do roteiro: oi, teste de áudio, conversa social e recomeçar

Notas: entendimento 3 · naturalidade 3 · acessibilidade 3 · uma_pergunta_por_vez 4 · sem_invencao 2 · eficiencia 2 · conclusao 4 · 89s

- ✅ o serviço da cadeira foi cancelado ao recomeçar

> O bot cumpriu o objetivo de cancelar e recomeçar com confirmação, mas ignorou perguntas diretas dele, inventou 'entrega depois', fez pergunta sem sentido e perguntou de quem é a mesa já dito. Preço com tom pouco acessível, e ecos de transcrição alongam tudo.

- [media] (pergunta_repetida) turno 10: Ele perguntou se dava pra recomeçar e o bot respondeu, mas depois emendou pergunta de pincel/rolo/pistola sem retomar bem; o padrão de assunto novo atendido e retomado ficou truncado.
- [media] (perdeu_informacao) turno 13: Ele perguntou se recomeçar cancela tudo ou guarda algo; o bot ignorou a pergunta e seguiu com outra pergunta de entrega.
- [alta] (inventou) turno 16: Disse que anotou que ele busca a cadeira e 'entrega depois', mas ele não falou de entrega. Também ignorou a pergunta sobre perder o que foi dito (pincel, perninha), respondendo só de forma vaga.
- [media] (pergunta_repetida) turno 16: Perguntou 'por fora ou por dentro' numa cadeira, pergunta sem sentido para o móvel.
- [alta] (jargao) turno 19: Apresentou preço com 'abaixo de R$ 390 você fica no prejuízo', texto denso, e usou markdown; além disso o orçamento saiu sem tratar a perna solta e o assento que ele disse que entra.
- [baixa] (texto_longo) turno 6: Ecoa a transcrição inteira do áudio em toda mensagem, aumentando o volume de texto.
- [baixa] (tom) turno 4: Não respondeu ao pedido de testar se está bem no turno 6/7; só respondeu depois, no turno 10.
- [media] (pergunta_repetida) turno 30: Perguntou de quem é a mesa mesmo ele tendo dito 'do meu irmão'; também não registrou prazo de dois dias incerto.

<details><summary>Conversa</summary>

```
1. ADRIANO: oi
2. BOT: Opa, Adriano! Tudo certo por aqui 😄 Me conta qual peça chegou pra gente fazer o orçamento.
3. ADRIANO: Opa, tudo bem! Testando aqui se o áudio funciona. Essa é a cadeira do seu João, aquela de madeira pra pintar.
4. BOT: Áudio chegou certinho, valeu! 🎨 Anotei a cadeira do Seu João pra pintar. Ela está em que estado: boa, com reparos ou danificada?

📸 Se tiver foto da peça, manda que ajuda!
5. ADRIANO (áudio): Tá boa, só precisa de uma pintura nova mesmo. O assento tá firme, sem quebra. Tem uma perninha que tá meio solta, mas dá pra apertar. Ah, e testa aí se tu tá bem, tava pensando nisso antes de começar.
6. BOT: 🎧 Ouvi: "Tá boa, só precisa de uma pintura nova mesmo. O assento tá firme, sem quebra. Tem uma perninha que tá meio solta, mas dá pra apertar. Ah, e testa aí se tu tá bem, tava pensando nisso antes de começar."
7. BOT: Anotado: a cadeira do Seu João com pintura nova e a perninha pra apertar ✅ Qual o tamanho dela, mais ou menos (pequena, média ou grande)?
8. ADRIANO (áudio): Tô bem, valeu por perguntar! Tava aqui pensando, cadeira média mesmo, do tamanho normal de sala de jantar. Ah, e se eu quiser começar de novo o orçamento, dá pra fazer?
9. BOT: 🎧 Ouvi: "Tô bem, valeu por perguntar! Tava aqui pensando, cadeira média mesmo, do tamanho normal de sala de jantar. Ah, e se eu quiser começar de novo o orçamento, dá pra fazer?"
10. BOT: Que bom que tá tudo bem! 😄 Anotei: cadeira média, do tamanho de sala de jantar.

Sim, dá pra recomeçar. É só falar "recomeçar" que eu cancelo esse orçamento e você conta de novo.

Essa pintura vai ser feita com pincel, rolo ou pistola? 🎨
11. ADRIANO (áudio): Ah, entendi. Então pode deixar que eu começo de novo quando você quiser. Essa pintura vai ser no pincel mesmo, que é pra não ficar muito grosso nas pernas. Mas antes, deixa eu ver se tá tudo certo, a cadeira do Seu João é de madeira, pintura nova, perninha solta pra apertar, tamanho médio. Agora fala aí, recomeçar é pra cancelar tudo ou dá pra guardar alguma coisa?
12. BOT: 🎧 Ouvi: "Ah, entendi. Então pode deixar que eu começo de novo quando você quiser. Essa pintura vai ser no pincel mesmo, que é pra não ficar muito grosso nas pernas. Mas antes, deixa eu ver se tá tudo certo, a cadeira do Seu João é de madeira, pintura nova, perninha solta pra apertar, tamanho médio. Agora fala aí, recomeçar é pra cancelar tudo ou dá pra guardar alguma coisa?"
13. BOT: Anotei tudo: pincel, perninha pra apertar e a cadeira média ✅

Você busca a cadeira na casa do Seu João e entrega depois, ou ele traz até a oficina?
14. ADRIANO (áudio): Ah, entendi. Recomeçar cancela tudo, então pode mandar. Eu busco a cadeira na casa do Seu João, ele não traz. Mas antes de começar de novo, quero saber uma coisa: se eu for recomeçar, perde tudo que eu falei até agora? Tipo a parte do pincel e da perninha?
15. BOT: 🎧 Ouvi: "Ah, entendi. Recomeçar cancela tudo, então pode mandar. Eu busco a cadeira na casa do Seu João, ele não traz. Mas antes de começar de novo, quero saber uma coisa: se eu for recomeçar, perde tudo que eu falei até agora? Tipo a parte do pincel e da perninha?"
16. BOT: Só recomeçar se você mandar, nada é apagado antes disso. Anotei que você busca a cadeira na casa do Seu João e entrega depois.

Pra fechar o orçamento, a pintura é só por fora ou por dentro também?
17. ADRIANO (áudio): Entendi, então ainda não quero recomeçar. Deixa eu ver: a pintura é só por fora, as pernas e o encosto, o assento também entra. E a perninha solta eu aperto antes de pintar. Quando eu quiser recomeçar eu falo.
18. BOT: 🎧 Ouvi: "Entendi, então ainda não quero recomeçar. Deixa eu ver: a pintura é só por fora, as pernas e o encosto, o assento também entra. E a perninha solta eu aperto antes de pintar. Quando eu quiser recomeçar eu falo."
19. BOT: Fiz a conta da cadeira do Seu João, só por fora, com pincel: sugestão de **R$ 484,00**. Abaixo de R$ 390,00 você fica no prejuízo. Dá uns 3 dias de trabalho, e são uns R$ 211,00 de material novo.

Você concorda com esse valor, quer dar um desconto ou acrescentar algo? 🤝
   [botões: 👍 Concordo | ➖ Dar desconto | ➕ Acrescentar]
20. ADRIANO (áudio): Ah, agora eu quero recomeçar mesmo. Pode cancelar esse orçamento e eu conto de novo do zero.
21. BOT: 🎧 Ouvi: "Ah, agora eu quero recomeçar mesmo. Pode cancelar esse orçamento e eu conto de novo do zero."
22. BOT: Beleza, vou cancelar o orçamento da cadeira do Seu João. Confirma no botão aí embaixo 👇 Depois é só contar de novo do zero.
   [botões: ✅ Sim, cancelar | ✏️ Não]
23. ADRIANO: [tocou: ✅ Sim, cancelar]
24. BOT: Pronto, a cadeira do Seu João foi cancelada 👍 Pode contar de novo do zero quando quiser, é só mandar a primeira peça.
25. ADRIANO (áudio): Beleza, valeu! Então começa do zero. Me conta qual peça você vai fazer primeiro.
26. BOT: 🎧 Ouvi: "Beleza, valeu! Então começa do zero. Me conta qual peça você vai fazer primeiro."
27. BOT: Beleza! 🪵 Me manda a primeira peça: o móvel, de quem é, e o que vai ser feito nela.
28. ADRIANO (áudio): Então, a primeira peça é uma mesa de jantar do meu irmão, de madeira maciça. Vai ser só lixar e envernizar, sem pintura. Ele quer a mesa com cor de mogno. Acho que leva uns dois dias pra fazer, mas ainda não sei direito.
29. BOT: 🎧 Ouvi: "Então, a primeira peça é uma mesa de jantar do meu irmão, de madeira maciça. Vai ser só lixar e envernizar, sem pintura. Ele quer a mesa com cor de mogno. Acho que leva uns dois dias pra fazer, mas ainda não sei direito."
30. BOT: Anotei: mesa de jantar de madeira maciça, lixar e envernizar, cor mogno ✅

De quem é a mesa? Pelo que você disse, deve ser do seu irmão. Qual o nome dele, com tratamento (tipo "Seu Carlos")?

📸 Se tiver foto da peça, manda que ajuda!
31. ADRIANO: O nome dele é Marcelo, pode colocar só Marcelo mesmo. Não tenho foto agora, depois eu mando se precisar.
32. BOT: Anotei: mesa do Marcelo ✅

Qual o tamanho dela? Pode ser em cm ou pequena, média ou grande.
```

</details>

## correcoes — Correções do jeito dele no meio do orçamento

Notas: entendimento 3 · naturalidade 3 · acessibilidade 3 · uma_pergunta_por_vez 3 · sem_invencao 4 · eficiencia 4 · conclusao 3 · 21s

- ✅ 1 serviço
- ❌ cliente corrigida para Dona Bia — "Dona Ana"
- ✅ método corrigido para rolo
- ✅ cor branca anotada

> O bot entendeu bem a maior parte: pintura branca, rolo no lugar de pincel, sem conserto e sem frete. Mas gravou o nome errado da cliente (Dona Ana, quando a correta é Dona Bia), e isso é falha grave num orçamento que vai para o cliente. A mensagem de preço é carregada: tem piso de prejuízo, horas, dias, três opções e pedido de foto. O fluxo avançou rápido para o valor, mas com dado errado e sem o Adriano conseguir conferir as medidas anotadas.

- [alta] (perdeu_informacao) turno 3: A cliente foi registrada como Dona Ana. A correção para Dona Bia, que é um fato do caso, não aparece na conversa mostrada, e a checagem do banco falhou nesse ponto. O orçamento sairia com o nome errado.
- [media] (jargao) turno 3: Usa 'prejuízo' e 'abaixo de R$ 248,01', que soam como piso de preço. Também traz o valor sugerido com muita precisão, o que deixa a mensagem mais técnica do que ele gosta.
- [media] (uma_pergunta_por_vez) turno 3: Pergunta três coisas de uma vez (concorda, desconto ou acrescentar) e ainda pede foto, misturando pedidos.
- [baixa] (texto_longo) turno 3: A mensagem junta resumo, preço, mínimo, horas, dias e pedido de foto. Para quem fala por áudio, é bastante coisa de uma vez.
- [baixa] (perdeu_informacao) turno 3: As medidas (90 x 100 x 45) não aparecem no resumo, embora possam ter sido usadas no cálculo. Ele não consegue conferir se o bot entendeu.

<details><summary>Conversa</summary>

```
1. ADRIANO (áudio): Oi, tudo bem? Peguei uma cômoda pra pintar de branco, da dona Ana. Tá boa, sem conserto, só pintura por fora. Ela tem uns 90 de altura, 1 metro de largura e 45 de fundura. Ah, vou pintar com pincel. Não, espera, errei, é rolo. E sem frete, ela vem buscar.
2. BOT: 🎧 Ouvi: "Oi, tudo bem? Peguei uma cômoda pra pintar de branco, da dona Ana. Tá boa, sem conserto, só pintura por fora. Ela tem uns 90 de altura, 1 metro de largura e 45 de fundura. Ah, vou pintar com pincel. Não, espera, errei, é rolo. E sem frete, ela vem buscar."
3. BOT: Anotei a cômoda da Dona Ana: pintura branca por fora, com rolo, sem conserto e sem frete, ela busca.

Sugestão: **R$ 308,00**. Abaixo de R$ 248,01 você fica no prejuízo.
Dá umas 5 horas de trabalho, cerca de 2 dias.

Você concorda, quer dar desconto ou acrescentar algo?

📸 Se tiver foto da peça, manda que ajuda!
   [botões: 👍 Concordo | ➖ Dar desconto | ➕ Acrescentar]
```

</details>

## edileuza-prazo — Mesa da Dona Edileuza: 'pegar o serviço' não é buscar a peça, método em aberto, prazo do Adriano

Notas: entendimento 3 · naturalidade 3 · acessibilidade 3 · uma_pergunta_por_vez 3 · sem_invencao 3 · eficiencia 3 · conclusao 5 · 49s

- ✅ mesa de centro anotada
- ✅ não afirmou que ele vai buscar a peça
- ✅ não anotou que ele busca
- ✅ prazo dele anotado (2 meses)
- ✅ pediu foto
- ✅ sem falar de sistema/marcação
- ✅ PDF gerado

> O objetivo foi atingido: valor fechado em 425 com desconto, prazo de 2 meses anotado e PDF enviado. Mas o caminho foi desgastante: o bot assumiu pincel sem sugerir de fato, jogou valor, piso e dias de uma vez, e insistiu em anotar transporte mesmo com ele corrigindo três vezes. Tom e acessibilidade ficaram medianos.

- [media] (uma_pergunta_por_vez) turno 3: Fez a pergunta de pincel/rolo e ainda pediu foto na mesma mensagem, duas solicitações juntas.
- [alta] (inventou) turno 5: Disse que 'a conta já saiu com pincel' e deu um valor (R$ 484), prazo de 3 dias e piso de R$ 390 sem ele ter dado medidas. O pincel foi sugestão pedida a ele, mas o bot não sugeriu nada, apenas assumiu. O 3 dias também conflita com o prazo que ele dá depois.
- [media] (jargao) turno 5: Usou 'prejuízo', 'abaixo de R$ 390', formato de texto técnico e negrito. Mensagem com muita informação de uma vez.
- [media] (nao_entendeu) turno 5: Ele pediu que o bot sugerisse pincel ou rolo. O bot tratou como decidido pincel sem explicar a sugestão; resposta não conversa com o pedido.
- [media] (tom) turno 9: Ele corrigiu que eles trazem e buscam, e o bot respondeu 'sem transporte nosso', frase estranha e burocrática; o bot fala como se fosse parte do negócio.
- [alta] (pergunta_repetida) turno 12: Ele já reclamou duas vezes do transporte e o bot anotou de novo a mesma coisa, mostrando que não registrou a correção. Ele precisou repetir três vezes e ficou irritado no turno 13.
- [media] (fluxo_confuso) turno 12: Ele já tinha dito 'fecha em 425' e o bot voltou a confirmar o valor e perguntou o prazo em vez de seguir, atrasando o fechamento.
- [baixa] (tom) turno 17: Repetiu de novo 'sem transporte nosso' mesmo ele dizendo que não precisava anotar transporte. Também diz 'Te mandei o PDF', correto, mas texto com bastante repetição.

<details><summary>Conversa</summary>

```
1. ADRIANO (áudio): Amanhã eu tenho um serviço pra pegar lá na casa da dona Edileuza e do seu Crayson. É uma mesa de centro, tamanho médio, só pra passar massa e lixar e pintar por fora, sem conserto nenhum. Peça inteira. Ainda não sei se vou de pincel ou de rolo. Eles trazem e buscam a mesa.
2. BOT: 🎧 Ouvi: "Amanhã eu tenho um serviço pra pegar lá na casa da dona Edileuza e do seu Crayson. É uma mesa de centro, tamanho médio, só pra passar massa e lixar e pintar por fora, sem conserto nenhum. Peça inteira. Ainda não sei se vou de pincel ou de rolo. Eles trazem e buscam a mesa."
3. BOT: Anotei: mesa de centro média da Dona Edileuza e do Seu Crayson, só por fora, massa, lixa e pintura, sem conserto. Eles trazem e buscam. ✅

Vai de pincel ou de rolo? 🎨

📸 Se tiver foto da peça, manda que ajuda!
4. ADRIANO: Ainda não sei, depende da mesa. Se tu sugerir pincel eu vou de pincel, tá bom?
5. BOT: Anotei: pincel, então a conta já saiu com pincel. ✅

Sugestão para a mesa de centro da Dona Edileuza e do Seu Crayson: **R$ 484,00**. Abaixo de R$ 390,00 você fica no prejuízo. Dá uns 3 dias de trabalho.

Você concorda, quer dar desconto ou acrescentar algo? 💰
   [botões: 👍 Concordo | ➖ Dar desconto | ➕ Acrescentar]
6. ADRIANO: [tocou: ➖ Dar desconto]
7. BOT: Beleza! Quanto você quer dar de desconto, em reais ou em porcentagem? 💰
8. ADRIANO: Quero 59 reais de desconto. Mas eu não disse que ia buscar a mesa, eles que trazem e buscam, tá?
9. BOT: Anotei: eles trazem e buscam a mesa, então sem transporte nosso. ✅

Com R$ 59 de desconto, fica em **R$ 425,00**. Fecha assim? Ou quer ajustar? 💰
10. ADRIANO (áudio): Eu não disse que ia buscar a mesa, eles trazem e eles buscam, tá? Pode ser com os 59 de desconto, fecha em 425 então.
11. BOT: 🎧 Ouvi: "Eu não disse que ia buscar a mesa, eles trazem e eles buscam, tá? Pode ser com os 59 de desconto, fecha em 425 então."
12. BOT: Anotei: eles trazem e buscam, então sem transporte nosso. ✅

Fecho em R$ 425,00 com a Dona Edileuza e o Seu Crayson. Quando você consegue começar essa mesa? 📅
13. ADRIANO (áudio): Fecha em 425, pode fechar. Eu já falei que eles trazem e buscam, não precisa anotar transporte. Começo daqui a 2 meses, aí fica pronto em uma semana.
14. BOT: 🎧 Ouvi: "Fecha em 425, pode fechar. Eu já falei que eles trazem e buscam, não precisa anotar transporte. Começo daqui a 2 meses, aí fica pronto em uma semana."
15. BOT: [PDF enviado: Proposta-AP-2026-0001-v1.pdf]
16. BOT: 📲 Pra mandar pro cliente: segure o PDF ☝️ → Compartilhar → WhatsApp.
17. BOT: Fechado em R$ 425,00 pra Dona Edileuza e Seu Crayson ✅ Eles trazem e buscam, sem transporte nosso.

Começo daqui a 2 meses e fica pronto em uma semana. Te mandei o PDF aqui pra você repassar. 📄
```

</details>

## decisao-valor — Decisão do valor: desconto abaixo do mínimo e depois acréscimo de frete

Notas: entendimento 3 · naturalidade 3 · acessibilidade 3 · uma_pergunta_por_vez 4 · sem_invencao 2 · eficiencia 4 · conclusao 4 · 55s

- ✅ PDF gerado
- ✅ orçamento fechado

> Orçamento fechado e PDF gerado, mas o valor final não respeitou a intenção dele de acrescentar o frete de R$ 60 ao valor próximo de 290: o bot embutiu o frete em R$ 290. Há também pergunta redundante sobre o estado da peça, duas perguntas juntas sobre prazo e resumo final impreciso. Linguagem um pouco de sistema, mas em geral curta e compreensível.

- [baixa] (inventou) turno 3: Trocou o gênero e perguntou o estado ('dela') sendo que ele já disse 'tá bom' no primeiro áudio; pergunta repetida sobre algo já dito.
- [media] (fluxo_confuso) turno 9: Sugeriu R$ 342 'já com o frete' sem ele ter decidido nada, e apresentou o valor com frete embutido, o que gerou confusão sobre o frete ser somado ou não.
- [media] (jargao) turno 9: Termos como 'fica no prejuízo' e 'mínimo' soam como mensagem de sistema; o texto da proposta é um pouco longo.
- [media] (tom) turno 12: Repetiu o aviso do mínimo com números quebrados (R$ 289,90) e deu pouco espaço; foi correto em avisar, mas o tom é de sistema.
- [alta] (inventou) turno 15: Ele pediu valor perto de 290 'com o frete junto' (frete acrescentado), mas o bot fechou em R$ 290 com o frete DENTRO, ou seja, o frete não foi acrescentado de fato. Também decidiu o valor por ele em vez de somar 60 ao valor, ignorando a intenção de acrescentar.
- [media] (inventou) turno 22: Resumo final diz 'leva uns 2 dias e fica pronto no mesmo prazo', distorcendo a fala dele (começa quando o Seu Luiz deixar, uns 2 dias, e pronto no mesmo prazo depois); também 'Me avisa quando ele responder' é uma cobrança leve e desnecessária.
- [baixa] (fluxo_confuso) turno 17: Perguntou prazo de início e de término na mesma mensagem, duas perguntas juntas, e em seguida disse 'antes de gerar o PDF', o que soa burocrático.

<details><summary>Conversa</summary>

```
1. ADRIANO (áudio): e aí, tudo certo? preciso de um orçamento pra um aparador do seu Luiz, é pra envernizar. tá bom, 1,20 de largura, 40 de fundura, 80 de altura. é inteiro, sem conserto nenhum, só o verniz mesmo. vou usar pincel.
2. BOT: 🎧 Ouvi: "e aí, tudo certo? preciso de um orçamento pra um aparador do seu Luiz, é pra envernizar. tá bom, 1,20 de largura, 40 de fundura, 80 de altura. é inteiro, sem conserto nenhum, só o verniz mesmo. vou usar pincel."
3. BOT: Anotei o aparador do Seu Luiz pra verniz, a pincel, 120 x 40 x 80 cm ✅ Qual é o estado dela: boa, com só riscos, ou precisa de reparos? (Se tiver foto, manda que ajuda 📸)
4. ADRIANO (áudio): Tá bom, ela tá boa, sem conserto nenhum. Só precisa do verniz mesmo, com pincel. Não tem nem risco grande, é só passar o verniz.
5. BOT: 🎧 Ouvi: "Tá bom, ela tá boa, sem conserto nenhum. Só precisa do verniz mesmo, com pincel. Não tem nem risco grande, é só passar o verniz."
6. BOT: Anotei: ela está boa, só verniz a pincel ✅ Só mais uma: o verniz é só por fora, ou por dentro também?
7. ADRIANO (áudio): Só por fora mesmo, por dentro não precisa. Só o verniz a pincel, que é pra deixar ela pronta. Ah, e quando for fechar o valor eu vou buscar ela na casa do Seu Luiz e depois levar de volta, esse frete é 60 reais que eu quero cobrar.
8. BOT: 🎧 Ouvi: "Só por fora mesmo, por dentro não precisa. Só o verniz a pincel, que é pra deixar ela pronta. Ah, e quando for fechar o valor eu vou buscar ela na casa do Seu Luiz e depois levar de volta, esse frete é 60 reais que eu quero cobrar."
9. BOT: Anotei: só por fora, você busca e entrega, com frete de R$ 60 ✅

Pro aparador do Seu Luiz, minha sugestão é R$ 342,00, já com o frete. Fica pronto em uns 2 dias de trabalho.
Abaixo de R$ 290,00 você fica no prejuízo.

Você concorda, quer dar um desconto ou acrescentar algo? 💰
   [botões: 👍 Concordo | ➖ Dar desconto | ➕ Acrescentar]
10. ADRIANO (áudio): Eita, R$ 342 já com frete? Tá caro pra mim, fazendo um desconto grande aí, uns 171 reais tá bom. Se não der, eu vejo.
11. BOT: 🎧 Ouvi: "Eita, R$ 342 já com frete? Tá caro pra mim, fazendo um desconto grande aí, uns 171 reais tá bom. Se não der, eu vejo."
12. BOT: Entendi, R$ 171,00 fica bem abaixo do mínimo, de R$ 289,90. Nesse valor você teria prejuízo no aparador. Quer fechar em R$ 171,00 mesmo, ou prefere um valor mais perto dos R$ 290?
13. ADRIANO (áudio): Não, não quero fechar em 171 não, senão eu fico no prejuízo mesmo. Mas o frete de 60 reais, esse eu quero acrescentar sim. Então me manda o valor mais perto dos 290 com o frete junto.
14. BOT: 🎧 Ouvi: "Não, não quero fechar em 171 não, senão eu fico no prejuízo mesmo. Mas o frete de 60 reais, esse eu quero acrescentar sim. Então me manda o valor mais perto dos 290 com o frete junto."
15. BOT: Pode ser R$ 290,00 no total, já com o frete de R$ 60 dentro. Fica acima do mínimo de R$ 289,90. Fecho assim? 💰
16. ADRIANO: 👍 Concordo
17. BOT: Show, fechado em R$ 290,00 com o frete ✅

Antes de gerar o PDF, quando você consegue começar o aparador, e em quanto tempo ele fica pronto? 📅
18. ADRIANO (áudio): Começo quando o Seu Luiz deixar ela aqui, acho que em uns dois dias. Fica pronta depois disso, mais ou menos no mesmo prazo. Pode gerar o PDF.
19. BOT: 🎧 Ouvi: "Começo quando o Seu Luiz deixar ela aqui, acho que em uns dois dias. Fica pronta depois disso, mais ou menos no mesmo prazo. Pode gerar o PDF."
20. BOT: [PDF enviado: Proposta-AP-2026-0001-v1.pdf]
21. BOT: 📲 Pra mandar pro cliente: segure o PDF ☝️ → Compartilhar → WhatsApp.
22. BOT: Pronto, te mandei o PDF aqui no Telegram pra você repassar ao Seu Luiz 📄

Ficou assim: começa quando ele deixar o aparador aqui, leva uns 2 dias, e fica pronto no mesmo prazo. Me avisa quando ele responder.
```

</details>

## consulta — Consultas: quais serviços eu tenho e quanto falta receber

Notas: entendimento 4 · naturalidade 4 · acessibilidade 4 · uma_pergunta_por_vez 4 · sem_invencao 3 · eficiencia 3 · conclusao 5 · 33s


> Conversa de consulta bem conduzida: o bot confirma os dois serviços, informa que a Dona Maria não pagou nada e que não há valor fechado, e respeita o pedido de não calcular. Pontos fracos: o resumo do turno 6 perdeu detalhes (vidro, prateleiras) e acrescentou 'decapê', o bot insiste em pedir tamanho e estado da madeira, e há repetição de informações no turno 12.

- [media] (perdeu_informacao) turno 6: Resumo da cristaleira não menciona o vidro nas portas e as prateleiras de dentro, que o Adriano contou. Além disso, ele disse que a madeira é de madeira e quer só pintar, tirar o verniz velho e envernizar; o bot lista 'pintura, decapê, verniz', o que mistura termos e pode alterar a leitura do serviço (decapê não foi dito).
- [baixa] (pressao) turno 6: Pede de novo o tamanho e o estado da madeira logo depois de ele dizer que quer pensar sem calcular; repete o pedido nos turnos 9, sem insistir demais mas perto disso.
- [baixa] (jargao) turno 3: Usa 'orçamento fechado' e 'valor fechado' várias vezes, expressão um pouco burocrática; e oferece calcular em vez de só responder.
- [baixa] (texto_longo) turno 12: Repete a lista de serviços e a explicação do valor que já tinham sido dadas; resposta redundante porque ele repetiu a pergunta.
- [baixa] (inventou) turno 9: Diz 'pelo que você me contou, o valor fica por sua conta', inferindo algo que ele não disse naquele momento.

<details><summary>Conversa</summary>

```
1. ADRIANO (áudio): Oi, tudo bem? Me fala aí quais serviços eu tenho anotados agora. Acho que são a cristaleira da Dona Maria e a mesa do Seu João, mas confere pra mim. E queria saber também quanto a Dona Maria ainda deve, porque ela não pagou nada até agora.
2. BOT: 🎧 Ouvi: "Oi, tudo bem? Me fala aí quais serviços eu tenho anotados agora. Acho que são a cristaleira da Dona Maria e a mesa do Seu João, mas confere pra mim. E queria saber também quanto a Dona Maria ainda deve, porque ela não pagou nada até agora."
3. BOT: Confere sim: a cristaleira da Dona Maria e a mesa do Seu João estão anotadas, as duas ainda sem orçamento fechado. 😊

Da Dona Maria, ela não pagou nada, mas ainda não tem valor fechado, então não tem quanto cobrar por enquanto. Quer que eu calcule o orçamento dela agora?
4. ADRIANO (áudio): Ah, então ainda não tem valor fechado. Beleza. Mas quero dar uma olhada antes de calcular, a cristaleira da Dona Maria é uma cristaleira de madeira, com vidro nas portas e umas prateleiras de dentro. Ela quer só pintar, tirar o verniz velho e envernizar de novo, e tem uma gaveta que tá solta. Não calcula ainda não, deixa eu pensar nisso direito primeiro.
5. BOT: 🎧 Ouvi: "Ah, então ainda não tem valor fechado. Beleza. Mas quero dar uma olhada antes de calcular, a cristaleira da Dona Maria é uma cristaleira de madeira, com vidro nas portas e umas prateleiras de dentro. Ela quer só pintar, tirar o verniz velho e envernizar de novo, e tem uma gaveta que tá solta. Não calcula ainda não, deixa eu pensar nisso direito primeiro."
6. BOT: Anotei tudo: cristaleira da Dona Maria, com pintura, decapê, verniz e a gaveta solta. ✅

Sem pressa, pode pensar. Quando quiser retomar, me fala o tamanho dela e o estado da madeira.
7. ADRIANO (áudio): Beleza, valeu. Ainda tô pensando nela. Mas me fala uma coisa: a Dona Maria já falou quanto ela quer gastar, ou fica por minha conta?
8. BOT: 🎧 Ouvi: "Beleza, valeu. Ainda tô pensando nela. Mas me fala uma coisa: a Dona Maria já falou quanto ela quer gastar, ou fica por minha conta?"
9. BOT: Não tenho nada anotado sobre quanto ela quer gastar. Pelo que você me contou, o valor fica por sua conta. 😊

Quando estiver pronto, me passa o tamanho da cristaleira e o estado da madeira que eu faço a conta.
10. ADRIANO (áudio): Ah, então a Dona Maria não falou nada de valor. Beleza, fica por minha conta mesmo. Vou pensar na cristaleira com calma e depois eu te falo o tamanho e como tá a madeira. Por enquanto só quero saber mesmo: quais são os serviços anotados e a situação da Dona Maria, ela ainda deve tudo, né? Tá certo isso.
11. BOT: 🎧 Ouvi: "Ah, então a Dona Maria não falou nada de valor. Beleza, fica por minha conta mesmo. Vou pensar na cristaleira com calma e depois eu te falo o tamanho e como tá a madeira. Por enquanto só quero saber mesmo: quais são os serviços anotados e a situação da Dona Maria, ela ainda deve tudo, né? Tá certo isso."
12. BOT: Tá certo: a Dona Maria ainda não pagou nada, R$ 0,00. Mas como a cristaleira ainda não tem orçamento fechado, não tem um valor total para dizer que ela deve.

Os serviços anotados são a cristaleira da Dona Maria e a mesa do Seu João, as duas sem orçamento fechado. 🪵
13. ADRIANO (áudio): Beleza, então tá certo. Só fica uma coisa: a mesa do Seu João também tá sem orçamento, né? Então por enquanto tá tudo parado mesmo, eu que fecho depois.
14. BOT: 🎧 Ouvi: "Beleza, então tá certo. Só fica uma coisa: a mesa do Seu João também tá sem orçamento, né? Então por enquanto tá tudo parado mesmo, eu que fecho depois."
15. BOT: Isso, a mesa do Seu João também está sem orçamento fechado. Tá tudo parado por enquanto, e você fecha quando quiser. Quando voltar nelas, é só me chamar. 👍
16. ADRIANO (áudio): Beleza, então tá tudo certo. Obrigado, por enquanto é isso. Quando eu voltar na cristaleira e na mesa eu te chamo.
17. BOT: 🎧 Ouvi: "Beleza, então tá tudo certo. Obrigado, por enquanto é isso. Quando eu voltar na cristaleira e na mesa eu te chamo."
18. BOT: Valeu, Adriano! Quando voltar, é só chamar. 👋
```

</details>

## div-guarda-roupa-decape — Decapê num guarda-roupa grande, por dentro e por fora, com frete

Notas: entendimento 4 · naturalidade 3 · acessibilidade 3 · uma_pergunta_por_vez 4 · sem_invencao 3 · eficiencia 4 · conclusao 5 · 71s

- ✅ peça anotada com o nome que ele usou
- ✅ chegou num valor
- ✅ PDF gerado
- ✅ sem travar nem falar de sistema

> Chegou ao valor (R$ 1.358 com removedor), ele concordou e o PDF foi enviado com o prazo certo, então o objetivo foi atingido. Pontos fracos: citou tinta e solvente como se estivessem na conta, usou os botões fora de hora, deu mensagens um pouco longas no fim e deixou a última resposta cortada.

- [baixa] (jargao) turno 3: Pergunta sobre o estado ('bom, com reparos ou danificado') é um pouco de formulário e vem junto de pedido de foto, duas coisas na mesma mensagem.
- [media] (jargao) turno 9: Usa 'Sugestão' e 'você fica no prejuízo' de forma seca. Mostra o orçamento sem detalhar valor, e sem explicar de onde vem o total, o que dificulta a conferência dele.
- [media] (inventou) turno 12: Diz que 'a tinta e o solvente' estão na conta, sendo que o serviço é decapê com pincel; material citado sem base na fala dele. Também mostra os botões de concordar de novo no meio de uma pergunta de preço, confundindo o fluxo.
- [baixa] (pergunta_dupla) turno 12: Pergunta preço e embalagem na mesma mensagem.
- [media] (fluxo_confuso) turno 18: Diz 'Fechado' e só depois pergunta o prazo, que ele já tinha adiantado no começo da conversa? Na verdade o prazo não tinha sido dito antes, mas o bot poderia ter perguntado antes de fechar o valor; leve vai-e-vem.
- [media] (inventou) turno 23: Pede 'Quando ela responder, me avisa', sugerindo acompanhamento que o sistema não fez. Também as mensagens 21 a 23 repetem a instrução do PDF em três blocos, um pouco longo.
- [baixa] (tom) turno 26: Promete guardar a foto 'no serviço' sem ter garantia; ele falou foto do guarda-roupa pronto, e o bot trata como foto do estado.
- [baixa] (nao_entendeu) turno 28: No turno 27 a transcrição ecoa o próprio bot ('Beleza, Adriano!'); o bot não notou nem comentou, e a última mensagem ficou cortada.

<details><summary>Conversa</summary>

```
1. ADRIANO (áudio): E aí, beleza? Olha, é o seguinte: a dona Rita me procurou querendo fazer um decapê num guarda-roupa antigo dela. Ele tem 2 portas e 3 gavetas, mais ou menos 1,80 de altura, 1,20 de largura e 55 de fundura. É pra fazer por dentro e por fora. Tem uma dobradiça solta também, que eu acho que leva umas 1 hora pra arrumar. Ah, e eu que busco e entrego, o frete eu cobro 80 reais. Queria ver quanto fica o orçamento pra ela.
2. BOT: 🎧 Ouvi: "E aí, beleza? Olha, é o seguinte: a dona Rita me procurou querendo fazer um decapê num guarda-roupa antigo dela. Ele tem 2 portas e 3 gavetas, mais ou menos 1,80 de altura, 1,20 de largura e 55 de fundura. É pra fazer por dentro e por fora. Tem uma dobradiça solta também, que eu acho que leva umas 1 hora pra arrumar. Ah, e eu que busco e entrego, o frete eu cobro 80 reais. Queria ver quanto fica o orçamento pra ela."
3. BOT: Anotei o guarda-roupa da Dona Rita ✅ Decapê por dentro e por fora, com a dobradiça (1 h) e frete de R$ 80.

Como está o estado dele: bom, com reparos ou danificado?

📸 Se tiver foto da peça, manda que ajuda!
4. ADRIANO (áudio): Ah, tá bom. Ele tá meio judiado, não é destruído não. A madeira tá boa, mas tem umas marcas de uso, umas partes com verniz descascando e um puxador que tá meio solto. Nada de cupim nem parte quebrada. Quanto a foto, eu tiro depois e mando, mas agora tô sem tempo.
5. BOT: 🎧 Ouvi: "Ah, tá bom. Ele tá meio judiado, não é destruído não. A madeira tá boa, mas tem umas marcas de uso, umas partes com verniz descascando e um puxador que tá meio solto. Nada de cupim nem parte quebrada. Quanto a foto, eu tiro depois e mando, mas agora tô sem tempo."
6. BOT: Anotei: estado com reparos, sem cupim nem peça quebrada ✅ Foto fica pra depois, sem problema.

Pra fechar a conta: vai ser pincel, rolo ou pistola?
7. ADRIANO (áudio): Pincel. Pra decapê eu uso pincel mesmo, pra ficar mais perto de como era antigamente. Ah, e o puxador solto também precisa apertar, mas isso já tá no orçamento, né? Se não tiver, põe ele junto.
8. BOT: 🎧 Ouvi: "Pincel. Pra decapê eu uso pincel mesmo, pra ficar mais perto de como era antigamente. Ah, e o puxador solto também precisa apertar, mas isso já tá no orçamento, né? Se não tiver, põe ele junto."
9. BOT: Sim, o puxador entrou junto com a dobradiça, 1 h no total.

Orçamento do guarda-roupa da Dona Rita (decapê por dentro e por fora, com frete):
Sugestão: R$ 1.298,00
Abaixo de R$ 1.055,00 você fica no prejuízo.
Dá umas 21 horas, cerca de 5 dias de trabalho.

Você concorda, quer dar um desconto ou acrescentar algo?
   [botões: 👍 Concordo | ➖ Dar desconto | ➕ Acrescentar]
10. ADRIANO (áudio): Tá certo, o puxador entrou junto mesmo. Esse valor de R$ 1.298 tá bom pra mim, mas quero ver antes se não tem nada faltando. Tu falou que o verniz tá descascando em umas partes, então acho que vai ter lixa e removedor a mais. Quando tu fizer a conta final, me manda o valor que eu confirmo.
11. BOT: 🎧 Ouvi: "Tá certo, o puxador entrou junto mesmo. Esse valor de R$ 1.298 tá bom pra mim, mas quero ver antes se não tem nada faltando. Tu falou que o verniz tá descascando em umas partes, então acho que vai ter lixa e removedor a mais. Quando tu fizer a conta final, me manda o valor que eu confirmo."
12. BOT: Conferi: a lixa, a tinta e o solvente já estão na conta ✅ Mas o removedor não entrou, porque eu ainda não tenho o preço dele.

Quanto custa o removedor e de quanto é a embalagem?
   [botões: 👍 Concordo | ➖ Dar desconto | ➕ Acrescentar]
13. ADRIANO (áudio): Removedor custa 60 reais o litro, e eu compro de litro mesmo. Põe ele aí no orçamento, pode ser?
14. BOT: 🎧 Ouvi: "Removedor custa 60 reais o litro, e eu compro de litro mesmo. Põe ele aí no orçamento, pode ser?"
15. BOT: Pronto, o removedor entrou no orçamento: 1 litro a R$ 60 ✅

Novo valor do guarda-roupa da Dona Rita: R$ 1.358,00.
Abaixo de R$ 1.114,00 você fica no prejuízo.

Tá de acordo com esse valor?
   [botões: 👍 Concordo | ➖ Dar desconto | ➕ Acrescentar]
16. ADRIANO (áudio): Beleza, então fica R$ 1.358,00. Pode mandar o PDF pra Dona Rita, o removedor já tá dentro. Depois eu tiro a foto e mando pra ti.
17. BOT: 🎧 Ouvi: "Beleza, então fica R$ 1.358,00. Pode mandar o PDF pra Dona Rita, o removedor já tá dentro. Depois eu tiro a foto e mando pra ti."
18. BOT: Fechado em R$ 1.358,00 ✅ Antes de sair o PDF, falta o prazo: a partir de quando você consegue começar? Pode ser algo como "daqui a 2 semanas" ou "segunda que vem".
19. ADRIANO (áudio): Começa daqui a 1 mês, mais ou menos. Leva umas 2 semanas pra terminar. Pode colocar assim aí.
20. BOT: 🎧 Ouvi: "Começa daqui a 1 mês, mais ou menos. Leva umas 2 semanas pra terminar. Pode colocar assim aí."
21. BOT: [PDF enviado: Proposta-AP-2026-0001-v1.pdf]
22. BOT: 📲 Pra mandar pro cliente: segure o PDF ☝️ → Compartilhar → WhatsApp.
23. BOT: Fechado! Te mandei o PDF aqui no Telegram pra você repassar à Dona Rita 📄

Prazo anotado: começa daqui a 1 mês e leva umas duas semanas. Quando ela responder, me avisa ✅
24. ADRIANO (áudio): Beleza, valeu! Recebi o PDF. Depois eu tiro a foto do guarda-roupa pronto e mando pra ti. Obrigado.
25. BOT: 🎧 Ouvi: "Beleza, valeu! Recebi o PDF. Depois eu tiro a foto do guarda-roupa pronto e mando pra ti. Obrigado."
26. BOT: Valeu, Adriano! Quando tirar a foto, manda aqui que eu guardo no serviço 📸
27. ADRIANO (áudio): Beleza, Adriano! Quando tirar a foto, manda aqui. Obrigado e bom trabalho com a Dona Rita.
28. BOT: 🎧 Ouvi: "Beleza, Adriano! Quando tirar a foto, manda aqui. Obrigado e bom trabalho com a Dona Rita."
29. BOT: Valeu, Adriano! Quando mandar a foto, eu guardo no serviço da Dona Rita 👋
30. ADRIANO (áudio): Beleza, valeu! Só uma coisa: o prazo que ficou é começar daqui a 1 mês e levar umas 2 semanas, né? Tá certo, então pode encerrar por aqui.
31. BOT: 🎧 Ouvi: "Beleza, valeu! Só uma coisa: o prazo que ficou é começar daqui a 1 mês e levar umas 2 semanas, né? Tá certo, então pode encerrar por aqui."
32. BOT: Isso mesmo, Adriano: começa daqui a 1 mês e leva umas 2 semanas ✅ Bom trabalho com a Dona Rita! 👋
33. ADRIANO (áudio): Beleza, valeu! Tá certo sim, pode encerrar por aqui. Obrigado e até mais.
34. BOT: 🎧 Ouvi: "Beleza, valeu! Tá certo sim, pode encerrar por aqui. Obrigado e até mais."
35. BOT: Valeu, Adriano! Até mais 👋
```

</details>

## div-estatua-folha-ouro — Folha de ouro numa estátua de santo (peça que não é móvel)

Notas: entendimento 4 · naturalidade 3 · acessibilidade 3 · uma_pergunta_por_vez 4 · sem_invencao 3 · eficiencia 4 · conclusao 5 · 84s

- ✅ peça anotada com o nome que ele usou
- ✅ chegou num valor
- ✅ PDF gerado
- ✅ sem travar nem falar de sistema

> Conversa chegou ao valor e ao PDF sem travar, com perguntas curtas, uma por vez, e entendeu bem as falas. Pontos fracos: não ficou claro se o material (170) entrou no valor, o preço aparece sem explicação, e há algum jargão ('prejuízo', 'fechar a conta pelas suas horas') e eco longo da transcrição.

- [media] (jargao) turno 3: Frase 'Pra fechar a conta pelas suas horas' e o aviso de 'prejuízo' soam técnicos; além disso a mensagem junta pergunta de material com pedido de foto (duas coisas).
- [media] (perdeu_informacao) turno 6: Ele disse que o caderno inteiro (25 folhas) deve ser considerado e que a massa é chute; o bot só repetiu valores e não destacou isso, e perguntou 'né?' pedindo confirmação de uma soma simples.
- [baixa] (fluxo_confuso) turno 9: Bot diz que a conta vai pelas 6 horas porque o material está em casa, afirmação que contradiz o fato de ele ter pedido para o material entrar no valor (170); não fica claro se o material entrou.
- [media] (inventou) turno 15: Apresenta R$ 492 e piso de R$ 421 sem explicar a origem; o valor 'pelas 6 horas' ignora o material de R$ 170 mencionado antes, deixando dúvida se foi incluído. Também usa 'prejuízo' e pergunta composta com três opções.
- [baixa] (perdeu_informacao) turno 12: Não registra o prazo da base gasta como observação clara, mas manteve 'base fica como está'; ok. Pequena perda: não menciona a foto que ele mandaria depois.
- [baixa] (tom) turno 19: Fechamento ok, mas 'Quando ele responder, me avisa que eu anoto' é um pouco mecânico; as repetições de 'Ouvi' em todos os turnos deixam a conversa pesada.

<details><summary>Conversa</summary>

```
1. ADRIANO (áudio): Fala, tudo bem? Chegou aqui um serviço novo: o seu Jorge trouxe uma estátua de madeira de Santo Antônio, uns 60 cm de altura, pra eu aplicar folha de ouro só no manto, que é uma parte dela. Tem um dedinho lascado que precisa arrumar com massa antes. Aplico com pincel. Ele quer pra daqui a 3 semanas, e leva umas 6 horas de trabalho, mais ou menos. Dá pra começar a montar o orçamento?
2. BOT: 🎧 Ouvi: "Fala, tudo bem? Chegou aqui um serviço novo: o seu Jorge trouxe uma estátua de madeira de Santo Antônio, uns 60 cm de altura, pra eu aplicar folha de ouro só no manto, que é uma parte dela. Tem um dedinho lascado que precisa arrumar com massa antes. Aplico com pincel. Ele quer pra daqui a 3 semanas, e leva umas 6 horas de trabalho, mais ou menos. Dá pra começar a montar o orçamento?"
3. BOT: Anotei: estátua de Santo Antônio do Seu Jorge, 60 cm, folha de ouro só no manto, conserto do dedinho, pincel, 6 horas e entrega em 3 semanas ✅

Pra fechar a conta pelas suas horas, quanto dá, mais ou menos, o material que você vai usar (ouro, massa, cola)? Mesmo que já tenha em casa, entra no valor.

📸 Se tiver foto da peça, manda que ajuda!
4. ADRIANO (áudio): Então, o ouro eu tenho um caderno de folha de ouro com 25 folhas, custou 120 reais. A cola mordente eu comprei o frasco de 100 ml, 40 reais. A massa pro dedinho é coisa barata, acho que uns 10 reais no máximo, mas nem sei direito. Não sei quanto dessas folhas vai gastar pra cobrir só o manto, mas o caderno todo eu já tenho, então considera ele inteiro. Não tenho foto agora, depois eu mando se precisar.
5. BOT: 🎧 Ouvi: "Então, o ouro eu tenho um caderno de folha de ouro com 25 folhas, custou 120 reais. A cola mordente eu comprei o frasco de 100 ml, 40 reais. A massa pro dedinho é coisa barata, acho que uns 10 reais no máximo, mas nem sei direito. Não sei quanto dessas folhas vai gastar pra cobrir só o manto, mas o caderno todo eu já tenho, então considera ele inteiro. Não tenho foto agora, depois eu mando se precisar."
6. BOT: Anotei: ouro (120), cola (40) e massa (10), tudo em casa. Dá uns 170 no total, né? Confirma pra eu seguir a conta 👍
7. ADRIANO (áudio): Isso, dá isso mesmo. Pode seguir a conta. A massa é um chute, mas acho que fica nisso. Se precisar de mais alguma coisa, me fala.
8. BOT: 🎧 Ouvi: "Isso, dá isso mesmo. Pode seguir a conta. A massa é um chute, mas acho que fica nisso. Se precisar de mais alguma coisa, me fala."
9. BOT: Anotei que tudo isso já está em casa, então a conta vai pelas suas 6 horas. ✅

Só falta saber: a estátua está boa, só com o dedinho lascado, ou tem mais coisa pra arrumar?
10. ADRIANO (áudio): Só o dedinho mesmo, o resto tá firme. A pintura da base tá meio gasta mas não é pra mexer, o cliente só quer o manto dourado.
11. BOT: 🎧 Ouvi: "Só o dedinho mesmo, o resto tá firme. A pintura da base tá meio gasta mas não é pra mexer, o cliente só quer o manto dourado."
12. BOT: Anotei: só o dedinho, o resto firme, e a base fica como está 👍

Falta saber: quando ficar pronto, quem leva a estátua de volta, você ou o Seu Jorge?
13. ADRIANO (áudio): Ele busca, o Seu Jorge vem pegar lá na oficina mesmo. Não precisa entregar, ele passa aqui.
14. BOT: 🎧 Ouvi: "Ele busca, o Seu Jorge vem pegar lá na oficina mesmo. Não precisa entregar, ele passa aqui."
15. BOT: Fiz a conta da estátua do Seu Jorge: sugestão de R$ 492,00 pelas 6 horas de trabalho. Abaixo de R$ 421,00 você fica no prejuízo.

Você concorda, quer dar um desconto ou acrescentar algo? 🤝
   [botões: 👍 Concordo | ➖ Dar desconto | ➕ Acrescentar]
16. ADRIANO: [tocou: 👍 Concordo]
17. BOT: [PDF enviado: Proposta-AP-2026-0001-v1.pdf]
18. BOT: 📲 Pra mandar pro cliente: segure o PDF ☝️ → Compartilhar → WhatsApp.
19. BOT: Fechado! Orçamento da estátua do Seu Jorge em R$ 492,00 ✅ Te mandei o PDF aqui no Telegram pra você repassar.

Quando ele responder, me avisa que eu anoto. 🎨
```

</details>

## div-faqueiro-veludo — Encapar faqueiro com veludo (trabalho que não é pintura)

Notas: entendimento 5 · naturalidade 4 · acessibilidade 3 · uma_pergunta_por_vez 4 · sem_invencao 3 · eficiencia 4 · conclusao 5 · 41s

- ✅ peça anotada com o nome que ele usou
- ✅ chegou num valor
- ✅ PDF gerado
- ✅ sem travar nem falar de sistema

> Chegou ao valor e ao PDF com poucas trocas e entendeu bem os áudios, sem perder detalhes. Pontos fracos: o turno 8 é seco, com a ideia de 'prejuízo' e um 'leva 1 dia' que ele não disse, e a pergunta sobre conserto repete algo que ele já tinha informado.

- [baixa] (tom) turno 3: Mensagem com várias partes (anotação, pergunta e pedido de foto) deixa duas solicitações juntas; o pedido de foto é secundário e dilui a pergunta principal.
- [baixa] (tom) turno 6: Diz 'sem frete' para traduzir 'ela traz e busca'; é interpretação razoável, mas o sentido não é igual ao que ele disse e soa seco.
- [media] (jargao) turno 8: 'Abaixo de R$ 251,00 você fica no prejuízo' é seco e técnico (piso do sistema), sem explicar como se chegou ao valor. A mensagem é uma tabelinha de números, pouco conversa de colega.
- [media] (inventou) turno 8: 'O trabalho leva 1 dia' não foi dito por ele (ele falou 4 horas); é informação nova que pode ser lida como prazo prometido.
- [baixa] (fluxo_confuso) turno 8: O valor de R$ 298,00 aparece sem mostrar a conta (horas x valor-hora + material), então ele não vê de onde veio. A pergunta final combina 'concorda' e 'desconto' ao mesmo tempo.
- [baixa] (pergunta_repetida) turno 6: No turno 7 pergunta se precisa de conserto, mas ele já tinha dito que por fora estava bom e não precisava mexer; ele repete a informação.
- [baixa] (tom) turno 12: 'Quando ela responder, me avisa que eu registro' é aceitável, mas soa como tarefa pendente; sem pressão, ok.

<details><summary>Conversa</summary>

```
1. ADRIANO (áudio): E aí, beleza? Então, a dona Lúcia trouxe um faqueiro pra eu encapar por dentro com veludo vinho. É uma caixa de uns 40 por 30 cm e 8 de altura. Por fora tá bom, não precisa mexer. Quero ver quanto fica pra ela.
2. BOT: 🎧 Ouvi: "E aí, beleza? Então, a dona Lúcia trouxe um faqueiro pra eu encapar por dentro com veludo vinho. É uma caixa de uns 40 por 30 cm e 8 de altura. Por fora tá bom, não precisa mexer. Quero ver quanto fica pra ela."
3. BOT: Anotei o faqueiro da Dona Lúcia: 40 x 30 x 8 cm, por fora bom, e encapar o interior com veludo vinho ✅

Como é um trabalho de tecido, a conta vai pelas suas horas. Quantas horas você acha que leva o encapamento todo?

📸 Se tiver foto da peça, manda que ajuda!
4. ADRIANO (áudio): Acho que leva umas 4 horas, contando corte, cola e acabamento. Material é meio metro de veludo, 35 reais, e uma cola de contato de 20 reais. Ela traz e busca, e o prazo é semana que vem.
5. BOT: 🎧 Ouvi: "Acho que leva umas 4 horas, contando corte, cola e acabamento. Material é meio metro de veludo, 35 reais, e uma cola de contato de 20 reais. Ela traz e busca, e o prazo é semana que vem."
6. BOT: Anotei: 4 horas, veludo de R$ 35 e cola de R$ 20, sem frete, e fica pronto semana que vem ✅

Falta uma coisa: o faqueiro precisa de algum conserto?
7. ADRIANO: Não, precisa não. Por fora tá bom, só o interior mesmo que vai ser encapado com veludo vinho. Pode seguir assim.
8. BOT: Fica em R$ 298,00 para a Dona Lúcia, com as 4 horas de trabalho, o veludo e a cola. Abaixo de R$ 251,00 você fica no prejuízo. O trabalho leva 1 dia.

Você concorda com esse valor, ou quer dar um desconto?
   [botões: 👍 Concordo | ➖ Dar desconto | ➕ Acrescentar]
9. ADRIANO: [tocou: 👍 Concordo]
10. BOT: [PDF enviado: Proposta-AP-2026-0001-v1.pdf]
11. BOT: 📲 Pra mandar pro cliente: segure o PDF ☝️ → Compartilhar → WhatsApp.
12. BOT: Fechou ✅ Orçamento do faqueiro da Dona Lúcia em R$ 298,00, e te mandei o PDF aqui no Telegram pra você repassar.

Quando ela responder, me avisa que eu registro.
```

</details>

## div-cadeiras-palhinha — 6 cadeiras: verniz + palhinha terceirizada

Notas: entendimento 4 · naturalidade 3 · acessibilidade 4 · uma_pergunta_por_vez 4 · sem_invencao 4 · eficiencia 3 · conclusao 5 · 47s

- ✅ peça anotada com o nome que ele usou
- ✅ chegou num valor
- ✅ PDF gerado
- ✅ sem travar nem falar de sistema
- ✅ palhinha/terceirizado anotado

> Chegou ao valor com palhinha e frete e gerou o PDF sem travar, e o prazo de 2 meses entrou no fechamento. Mas o fluxo tem repetição de perguntas sobre dados já ditos (conserto, tamanho) e ignorou a pergunta direta sobre o prazo no turno 10. O orçamento não mostra a composição, então ele não vê se palhinha e frete entraram na conta. O tom é mais de formulário que de colega.

- [media] (pergunta_ignorada) turno 10: Adriano perguntou 'o prazo, eu falei uns 2 meses, tá anotado?' e o bot não respondeu diretamente; só foi para as contas. A confirmação só veio no fim (turno 16).
- [baixa] (pergunta_repetida) turno 9: Perguntou de novo sobre conserto, e depois sobre pincel/rolo/pistola, coisas que ele já tinha dito (cadeiras boas, só gastas; pincel citado nos fatos). O tamanho (turno 3) e o conserto (turno 6) estavam parcialmente dados.
- [baixa] (tom) turno 3: Respostas muito formulaicas ('Anotado: ...') repetindo tudo a cada turno, parecendo mais formulário que conversa de colega. O pedido de foto soa fora de hora.
- [media] (jargao) turno 12: Mensagem do orçamento usa 'Sugestão', 'prejuízo' e é um bloco denso com valor mínimo e dias de trabalho, sem detalhar o que entra (palhinha 540, frete 100). Ele não consegue ver se a palhinha e o frete foram somados.
- [baixa] (promessa_leve) turno 16: Diz 'Te mandei o PDF' (fato, foi enviado) mas o prazo '2 meses' é confirmado só no encerramento; ok, sem invenção grave.

<details><summary>Conversa</summary>

```
1. ADRIANO (áudio): E aí, beleza? Olha, a dona Neide me trouxe 6 cadeiras iguais pra envernizar. Só por fora, inteiras. E a palhinha do assento, eu não faço, mando pro Seu Zé, que cobra 90 reais por cadeira. As cadeiras estão boas, só gastas. Ela quer trocar a palhinha de todas, então entra isso no orçamento.
2. BOT: 🎧 Ouvi: "E aí, beleza? Olha, a dona Neide me trouxe 6 cadeiras iguais pra envernizar. Só por fora, inteiras. E a palhinha do assento, eu não faço, mando pro Seu Zé, que cobra 90 reais por cadeira. As cadeiras estão boas, só gastas. Ela quer trocar a palhinha de todas, então entra isso no orçamento."
3. BOT: Anotei: 6 cadeiras da Dona Neide, verniz por fora, palhinha com o Seu Zé a R$ 90 cada ✅

Qual o tamanho delas, mais ou menos? Pode ser pequena, média ou grande.

📸 Se tiver foto da peça, manda que ajuda!
4. ADRIANO (áudio): Média. Cadeira normal, tamanho médio. E o frete eu cobro 100 reais, eu busco e entrego. O prazo seria uns 2 meses, tá?
5. BOT: 🎧 Ouvi: "Média. Cadeira normal, tamanho médio. E o frete eu cobro 100 reais, eu busco e entrego. O prazo seria uns 2 meses, tá?"
6. BOT: Anotado: 6 cadeiras médias, verniz por fora, palhinha com o Seu Zé, frete de R$ 100 com busca e entrega 🪑

Antes de fechar a conta: as cadeiras precisam de algum conserto, ou só verniz mesmo?
7. ADRIANO (áudio): Só verniz mesmo, elas tão boas, só gastas. Pode ser uma demão de verniz por fora, sem conserto nenhum. E a palhinha é a que eu falei, do Seu Zé.
8. BOT: 🎧 Ouvi: "Só verniz mesmo, elas tão boas, só gastas. Pode ser uma demão de verniz por fora, sem conserto nenhum. E a palhinha é a que eu falei, do Seu Zé."
9. BOT: Anotado: sem conserto, só verniz por fora ✅

Pra verniz, você costuma usar pincel, rolo ou pistola? Se não tiver preferência, sugiro pincel.
10. ADRIANO (áudio): Pincel mesmo, é o que eu uso. Demão de verniz por fora, pode ser assim. E o prazo, eu falei uns 2 meses, tá anotado?
11. BOT: 🎧 Ouvi: "Pincel mesmo, é o que eu uso. Demão de verniz por fora, pode ser assim. E o prazo, eu falei uns 2 meses, tá anotado?"
12. BOT: Fiz as contas das 6 cadeiras da Dona Neide ✅

💰 Sugestão: R$ 2.774,00
⚠️ Abaixo de R$ 2.418,00 você fica no prejuízo.
⏱️ Dá uns 7 dias de trabalho.

Você concorda, quer dar um desconto ou acrescentar algo?
   [botões: 👍 Concordo | ➖ Dar desconto | ➕ Acrescentar]
13. ADRIANO: [tocou: 👍 Concordo]
14. BOT: [PDF enviado: Proposta-AP-2026-0001-v1.pdf]
15. BOT: 📲 Pra mandar pro cliente: segure o PDF ☝️ → Compartilhar → WhatsApp.
16. BOT: Fechou! ✅ Orçamento das 6 cadeiras da Dona Neide em R$ 2.774,00, com prazo de uns 2 meses.

Te mandei o PDF aqui no Telegram pra você repassar pra ela. Quando ela responder, me avisa 📄
```

</details>

## div-porta-macica — Porta de entrada maciça, dos dois lados, tirar verniz velho

Notas: entendimento 3 · naturalidade 3 · acessibilidade 3 · uma_pergunta_por_vez 4 · sem_invencao 2 · eficiencia 3 · conclusao 4 · 99s

- ✅ peça anotada com o nome que ele usou
- ✅ chegou num valor
- ✅ PDF gerado
- ✅ sem travar nem falar de sistema

> Chegou ao valor de R$ 990 e gerou o PDF, mas o primeiro cálculo saiu errado (1.101) e foi defendido de forma confusa até ele corrigir. Também houve confirmação repetida e leitura sem dúvida explícita do frete. O objetivo foi atingido, com atrito e perda de confiança no meio.

- [media] (nao_entendeu) turno 3: Perguntou quem leva e traz a porta, mas o Adriano já tinha dito que o Seu Paulo trouxe a porta; a pergunta é meio redundante.
- [media] (inventou) turno 6: Anotou que 'você busca e leva de volta', embora a fala fosse ambígua ('ele traz e leva de volta. Eu que busco e levo'). Não deixou a dúvida explícita e escolheu uma leitura.
- [alta] (inventou) turno 12: Valor de R$ 1.101,00 errado: a conta certa era R$ 990. Também citou mínimo de R$ 912 e '3 dias' sem origem clara, e o 'prejuízo' soa como jargão/pressão.
- [media] (tom) turno 15: Corrigiu a conta só depois da reclamação e de forma confusa ('ainda não troquei a hora'), mantendo o 1.101 como válido. Faltou admitir o erro de forma simples.
- [baixa] (fluxo_confuso) turno 15: Botões Concordo/Desconto/Acrescentar não combinam com a pergunta 'quer que refaça?'.
- [media] (fluxo_confuso) turno 18: Ele já tinha dito que estava de acordo com 990, mas o bot perguntou de novo 'quer que eu feche?' e depois pediu confirmação outra vez (turno 20), pergunta repetida.
- [baixa] (tom) turno 24: Disse 'Fechado' e pediu para avisar quando o cliente responder, mas ele disse que queria conferir de novo depois; o fechamento foi um pouco apressado.
- [baixa] (jargao) turno 18: Uso de 'mínimo' e 'acima do mínimo' é pouco natural para o artesão.

<details><summary>Conversa</summary>

```
1. ADRIANO (áudio): E aí, beleza? Olha, o seu Paulo me trouxe uma porta de entrada de madeira maciça, 2,10 de altura por 90 de largura. Ele quer tirar o verniz velho, que já tá descascando, e envernizar de novo, dos dois lados. A madeira tá boa, só precisa do acabamento. Dá pra você me ajudar a fazer o orçamento?
2. BOT: 🎧 Ouvi: "E aí, beleza? Olha, o seu Paulo me trouxe uma porta de entrada de madeira maciça, 2,10 de altura por 90 de largura. Ele quer tirar o verniz velho, que já tá descascando, e envernizar de novo, dos dois lados. A madeira tá boa, só precisa do acabamento. Dá pra você me ajudar a fazer o orçamento?"
3. BOT: Anotei a porta do Seu Paulo: 2,10 m por 0,90 m, decapar e envernizar por dentro e por fora, madeira boa. 🚪

Quem leva e traz a porta, o Seu Paulo ou você?

📸 Se tiver foto da peça, manda que ajuda!
4. ADRIANO (áudio): Ele traz e leva de volta. Eu que busco e levo, o frete é 120 reais. O prazo é daqui a 1 mês.
5. BOT: 🎧 Ouvi: "Ele traz e leva de volta. Eu que busco e levo, o frete é 120 reais. O prazo é daqui a 1 mês."
6. BOT: Anotei: você busca e leva de volta, frete de R$ 120, pronto daqui a 1 mês. 🛠️

Quantas horas você acha que leva o trabalho todo nessa porta?
7. ADRIANO (áudio): Umas 16 horas, mais ou menos. Tirar o verniz velho no decapê leva uns dois dias, depois lixar, e aí duas demãos de verniz dos dois lados com a secagem entre elas. Mas isso é chute, o certo é o senhor fazer a conta pelo que você cobra por hora. Se quiser, eu passo o valor da hora e você me diz se bate.
8. BOT: 🎧 Ouvi: "Umas 16 horas, mais ou menos. Tirar o verniz velho no decapê leva uns dois dias, depois lixar, e aí duas demãos de verniz dos dois lados com a secagem entre elas. Mas isso é chute, o certo é o senhor fazer a conta pelo que você cobra por hora. Se quiser, eu passo o valor da hora e você me diz se bate."
9. BOT: Anotei: 16 horas no total, decapar, lixar e duas demãos de verniz dos dois lados. ✅

Quanto dá, mais ou menos, o material que você vai usar (verniz, lixa, removedor)? Mesmo que já tenha em casa, entra no valor, porque depois você repõe.
10. ADRIANO (áudio): Material eu não sei de cabeça, é chute. Acho que uns 150 reais contando removedor, lixa e verniz, mas confere aí o que você gasta de verdade. E o valor da hora eu passo: 45 reais.
11. BOT: 🎧 Ouvi: "Material eu não sei de cabeça, é chute. Acho que uns 150 reais contando removedor, lixa e verniz, mas confere aí o que você gasta de verdade. E o valor da hora eu passo: 45 reais."
12. BOT: Pela conta das suas 16 horas, mais os R$ 150 de material e o frete de R$ 120, o orçamento da porta do Seu Paulo fica em **R$ 1.101,00**. ✅

Abaixo de R$ 912 você fica no prejuízo. O trabalho leva uns 3 dias.

Você concorda com esse valor, ou quer dar um desconto ou acrescentar algo? 🤝
   [botões: 👍 Concordo | ➖ Dar desconto | ➕ Acrescentar]
13. ADRIANO (áudio): Ô, tá certo isso aí não. 16 horas a 45 reais dá 720, mais 150 de material e 120 de frete dá 990, não 1.101. Dá uma conferida nessa conta pra mim. Eu não concordo com esse valor ainda, deixa eu pensar nele.
14. BOT: 🎧 Ouvi: "Ô, tá certo isso aí não. 16 horas a 45 reais dá 720, mais 150 de material e 120 de frete dá 990, não 1.101. Dá uma conferida nessa conta pra mim. Eu não concordo com esse valor ainda, deixa eu pensar nele."
15. BOT: Com R$ 45 por hora, a conta fica em R$ 990,00: R$ 720 de mão de obra, R$ 150 de material e R$ 120 de frete. Ainda não troquei a hora da conta, então o valor de R$ 1.101,00 continua valendo por enquanto. 🧮

Quer que eu refaça com os R$ 45 por hora?
   [botões: 👍 Concordo | ➖ Dar desconto | ➕ Acrescentar]
16. ADRIANO (áudio): Isso, refaz aí com os 45 por hora. Mas antes, uma coisa: o valor de 1.101 tava errado, né? Então o certo é 990. Pode refazer, tô de acordo com a conta de 990, só quero conferir mais uma vez depois.
17. BOT: 🎧 Ouvi: "Isso, refaz aí com os 45 por hora. Mas antes, uma coisa: o valor de 1.101 tava errado, né? Então o certo é 990. Pode refazer, tô de acordo com a conta de 990, só quero conferir mais uma vez depois."
18. BOT: Pela sua conta, com R$ 45 por hora, a porta do Seu Paulo fica em **R$ 990,00**: R$ 720 de mão de obra, R$ 150 de material e R$ 120 de frete. Esse valor fica acima do mínimo de R$ 912. 🧮

Quer que eu feche em R$ 990?
   [botões: 👍 Concordo | ➖ Dar desconto | ➕ Acrescentar]
19. ADRIANO: [tocou: 👍 Concordo]
20. BOT: Pode confirmar que eu fecho a porta do Seu Paulo em R$ 990? ✅
   [botões: 👍 Concordo | ➖ Dar desconto | ➕ Acrescentar]
21. ADRIANO: [tocou: 👍 Concordo]
22. BOT: [PDF enviado: Proposta-AP-2026-0001-v1.pdf]
23. BOT: 📲 Pra mandar pro cliente: segure o PDF ☝️ → Compartilhar → WhatsApp.
24. BOT: Fechado: a porta do Seu Paulo saiu por **R$ 990**, pronto daqui a 1 mês. Te mandei o PDF aqui no Telegram pra você repassar ao cliente. Quando ele responder, me avisa. 📄
```

</details>

## div-oratorio-cupim — Oratório com cupim: restauração + pátina + detalhes em folha de ouro

Notas: entendimento 5 · naturalidade 4 · acessibilidade 4 · uma_pergunta_por_vez 4 · sem_invencao 4 · eficiencia 5 · conclusao 5 · 33s

- ✅ peça anotada com o nome que ele usou
- ✅ chegou num valor
- ✅ PDF gerado
- ✅ sem travar nem falar de sistema

> Fluxo curto e eficiente: anotou a peça com nome e medidas, fez uma única pergunta necessária, chegou ao valor de R$ 790 e gerou o PDF. Pontos fracos: não cumprimentou de volta, pediu pincel e foto na mesma mensagem, a conta de 13 horas não é explicada e há repetição no fechamento. Nada inventado de forma grave.

- [baixa] (tom) turno 3: Não responde ao 'E aí, tudo bem?' inicial; vai direto ao resumo. Resumo um pouco denso, em lista corrida.
- [baixa] (pergunta_dupla) turno 3: Faz a pergunta de pincel/rolo/pistola e ainda pede foto na mesma mensagem, dois pedidos juntos.
- [media] (jargao) turno 6: Usa 'Sugestão', 'prejuízo' e '5 dias de trabalho' sem explicar como chegou nas 13 horas; a mensagem traz várias informações e o número de horas não bate com as 3 horas ditas, sem justificativa. Também não confirma que o ouro e a pátina por dentro foram incluídos.
- [baixa] (fluxo_confuso) turno 10: Mensagens 9 e 10 repetem a ideia de repassar o PDF; excesso de mensagens no fim. A seringa e o produto do cupim, ditos por ele, não foram retomados.
- [baixa] (tom) turno 12: Encerramento repete o que já foi dito no turno 10, sem acrescentar nada.

<details><summary>Conversa</summary>

```
1. ADRIANO (áudio): E aí, tudo bem? Olha, a dona Cida trouxe um oratório antigo aqui, com cupim. Ele tem uns 50 de altura, 30 de largura e 20 de fundura. Precisa tratar o cupim e restaurar, acho que uns 3 horas de conserto. Depois é pátina por fora, e tem uns detalhes em folha de ouro nos frisos. Por dentro também, que tem o nicho. Ela quer em 1 mês, e ela mesma traz e busca. Dá pra você começar a fazer o orçamento?
2. BOT: 🎧 Ouvi: "E aí, tudo bem? Olha, a dona Cida trouxe um oratório antigo aqui, com cupim. Ele tem uns 50 de altura, 30 de largura e 20 de fundura. Precisa tratar o cupim e restaurar, acho que uns 3 horas de conserto. Depois é pátina por fora, e tem uns detalhes em folha de ouro nos frisos. Por dentro também, que tem o nicho. Ela quer em 1 mês, e ela mesma traz e busca. Dá pra você começar a fazer o orçamento?"
3. BOT: Anotei o oratório da Dona Cida: 50 x 30 x 20 cm, com cupim, 3 h de conserto, pátina por fora, folha de ouro nos frisos e nicho por dentro. Ela traz e busca, e fica pronto em 1 mês. 🪵

Pra fechar a conta, vai ser pincel, rolo ou pistola?

📸 Se tiver foto da peça, manda que ajuda!
4. ADRIANO (áudio): Pincel. Pra pátina e o ouro eu uso pincel mesmo, o cupim eu trato antes com a seringa e depois passo o produto. Foto eu não tenho agora, depois eu mando se precisar.
5. BOT: 🎧 Ouvi: "Pincel. Pra pátina e o ouro eu uso pincel mesmo, o cupim eu trato antes com a seringa e depois passo o produto. Foto eu não tenho agora, depois eu mando se precisar."
6. BOT: Fiz a conta do oratório da Dona Cida 🪵

💰 Sugestão: R$ 790,00
⚠️ Abaixo de R$ 635,00 você fica no prejuízo.
⏱️ Umas 13 horas, cerca de 5 dias de trabalho.

Você concorda, quer dar um desconto ou acrescentar algo?
   [botões: 👍 Concordo | ➖ Dar desconto | ➕ Acrescentar]
7. ADRIANO: [tocou: 👍 Concordo]
8. BOT: [PDF enviado: Proposta-AP-2026-0001-v1.pdf]
9. BOT: 📲 Pra mandar pro cliente: segure o PDF ☝️ → Compartilhar → WhatsApp.
10. BOT: Fechado: oratório da Dona Cida por R$ 790,00 ✅ Te mandei o PDF aqui no Telegram pra você repassar pra ela.

Quando ela responder, me avisa que eu anoto.
11. ADRIANO: Show, valeu! Vou repassar o PDF pra Dona Cida. Depois te aviso quando ela responder.
12. BOT: Show, Adriano! Quando ela responder, é só me avisar. 👋
```

</details>

## div-bandeja-flores — Pintura artística à mão numa bandeja (técnica fora da lista)

Notas: entendimento 4 · naturalidade 3 · acessibilidade 3 · uma_pergunta_por_vez 4 · sem_invencao 3 · eficiencia 4 · conclusao 5 · 56s

- ✅ peça anotada com o nome que ele usou
- ✅ chegou num valor
- ✅ PDF gerado
- ✅ sem travar nem falar de sistema

> Chegou ao valor e ao PDF com poucas trocas, mas perguntou a tinta já informada, não citou a lixa e os riscos, e distorceu o prazo de 10 dias em 'dias de trabalho', com algum jargão ('prejuízo') e mensagens repetitivas no fim.

- [media] (nao_entendeu) turno 3: Perguntou o valor da tinta mesmo ele já ter dito que tem a tinta acrílica e só falta o verniz; ignorou a informação dita.
- [baixa] (tom) turno 3: Ignorou o 'e aí, tudo bem?' e o pedido de ajuda; foi direto, sem resposta social curta.
- [media] (jargao) turno 9: Disse 'fica no prejuízo' com valor de piso sem explicar, e apresentou o preço com formato de relatório; também não explicou como chegou no valor da hora padrão.
- [media] (perdeu_informacao) turno 9: A lixa leve para firmar a base e os riscos superficiais não foram confirmados nem citados; o resumo não os menciona.
- [media] (pergunta_confusa) turno 11: Perguntou 'quando consegue começar' e disse que os 10 dias de trabalho já estavam anotados; o prazo de 10 dias era prazo de entrega, e o bot tratou como dias de trabalho, mudando o sentido.
- [media] (inventou) turno 16: Disse 'cerca de 10 dias de trabalho' e 'começando em até 2 dias', misturando prazo com trabalho; o PDF e a mensagem repetem a interpretação distorcida. Também 'eu marco como aceito' promete algo que depende dele avisar.
- [baixa] (texto_longo) turno 15: Várias mensagens seguidas (PDF, instrução de compartilhar, fechamento) e repetição do que ele já disse no final.

<details><summary>Conversa</summary>

```
1. ADRIANO (áudio): E aí, tudo bem? Então, a dona Bete me trouxe uma bandeja de madeira de 45 por 30 cm pra eu pintar. Ela quer o fundo branco e umas flores pintadas à mão, pintura artística mesmo. Eu acho que leva umas 5 horas por causa dos detalhes. Tenho a tinta acrílica aqui, só falta um verniz spray de 30 reais. Ela traz e busca, e o prazo é de 10 dias. Dá pra você me ajudar a fazer o orçamento?
2. BOT: 🎧 Ouvi: "E aí, tudo bem? Então, a dona Bete me trouxe uma bandeja de madeira de 45 por 30 cm pra eu pintar. Ela quer o fundo branco e umas flores pintadas à mão, pintura artística mesmo. Eu acho que leva umas 5 horas por causa dos detalhes. Tenho a tinta acrílica aqui, só falta um verniz spray de 30 reais. Ela traz e busca, e o prazo é de 10 dias. Dá pra você me ajudar a fazer o orçamento?"
3. BOT: Anotei a bandeja de 45 x 30 cm da Dona Bete: fundo branco e flores à mão, 5 horas, verniz spray de R$ 30, e ela traz e busca. 🎨

Quanto dá, mais ou menos, a tinta acrílica que você vai usar? Entra no valor, porque depois você repõe.

📸 Se tiver foto da peça, manda que ajuda!
4. ADRIANO (áudio): Ah, a tinta eu já tenho aqui, então não precisa colocar valor de tinta não. Pode deixar só o verniz de 30 reais. Foto eu não tenho agora, depois eu mando se precisar.
5. BOT: 🎧 Ouvi: "Ah, a tinta eu já tenho aqui, então não precisa colocar valor de tinta não. Pode deixar só o verniz de 30 reais. Foto eu não tenho agora, depois eu mando se precisar."
6. BOT: Anotei: a bandeja da Dona Bete, 5 horas, verniz spray de R$ 30, sem custo de tinta. ✅

A bandeja está boa, só com riscos, ou precisa de algum reparo?
7. ADRIANO (áudio): Tá boa, só tem uns riscos superficiais, nada de reparo. Lixa de leve antes de pintar pra firmar a base. Ah, e o preço da hora é o que eu já cobro normal, pode usar o padrão aí.
8. BOT: 🎧 Ouvi: "Tá boa, só tem uns riscos superficiais, nada de reparo. Lixa de leve antes de pintar pra firmar a base. Ah, e o preço da hora é o que eu já cobro normal, pode usar o padrão aí."
9. BOT: Fiz a conta da bandeja da Dona Bete: sugestão de **R$ 290,00**, com as 5 horas de trabalho e o verniz incluídos. 🎨

Abaixo de R$ 231,00 você fica no prejuízo.

Você concorda com esse valor, quer dar um desconto ou acrescentar algo?
   [botões: 👍 Concordo | ➖ Dar desconto | ➕ Acrescentar]
10. ADRIANO: [tocou: 👍 Concordo]
11. BOT: Show, valor fechado! ✅ Falta só o prazo: quando você consegue começar a bandeja? Os 10 dias de trabalho já estão anotados.
12. ADRIANO (áudio): Beleza, pode começar em até 2 dias. Os 10 dias ficam certinhos. Pode mandar o PDF pra ela.
13. BOT: 🎧 Ouvi: "Beleza, pode começar em até 2 dias. Os 10 dias ficam certinhos. Pode mandar o PDF pra ela."
14. BOT: [PDF enviado: Proposta-AP-2026-0001-v1.pdf]
15. BOT: 📲 Pra mandar pro cliente: segure o PDF ☝️ → Compartilhar → WhatsApp.
16. BOT: Fechado! Te mandei o PDF aqui no Telegram pra você repassar pra Dona Bete: R$ 290,00, começando em até 2 dias e cerca de 10 dias de trabalho. 📄

Quando ela responder, me avisa que eu marco como aceito.
17. ADRIANO: Valeu, então tá fechado! Vou mandar o PDF pra Dona Bete pelo WhatsApp. Quando ela responder eu te aviso. Obrigado!
18. BOT: Valeu, Adriano! Quando ela responder, me avisa. 👋
```

</details>

## div-comoda-puxadores — Cômoda: pintura lisa + troca de puxadores comprados

Notas: entendimento 3 · naturalidade 3 · acessibilidade 3 · uma_pergunta_por_vez 4 · sem_invencao 3 · eficiencia 3 · conclusao 4 · 50s

- ✅ peça anotada com o nome que ele usou
- ✅ chegou num valor
- ✅ PDF gerado
- ✅ sem travar nem falar de sistema
- ✅ puxadores anotados

> A conversa chegou ao valor de R$ 400 e ao PDF, com os puxadores anotados. Mas o bot não deixou claro que os 120 dos puxadores estavam incluídos e fez uma pergunta repetida sobre o prazo que o Adriano já tinha dado. No fim, afirma que o PDF traz o início em 4 dias sem ter como saber, e repete a mesma informação em várias mensagens.

- [baixa] (tom) turno 3: Pergunta o tamanho, mas já pede foto na mesma mensagem, o que soma um segundo pedido. Aceitável, mas poderia ser mais leve.
- [media] (jargao) turno 6: Fala em 'prejuízo' e 'sugestão' com asteriscos de markdown. Não explica se os 120 dos puxadores estão dentro dos R$ 400. Isso levou à confusão do Adriano no turno 9.
- [media] (nao_entendeu) turno 6: Não deixou claro se o valor incluía os puxadores, embora o Adriano já tivesse dito que queria cobrá-los. Ele precisou esclarecer depois.
- [alta] (nao_entendeu) turno 11: Confundiu 3 semanas de prazo com 'quando você consegue começar' e perguntou algo que ele já tinha dito.
- [media] (perdeu_informacao) turno 12: O Adriano disse que começa em uns 4 dias e que a combinação com a cliente é com ele. O bot registrou o início, mas depois tratou a data como se estivesse no PDF, sem confirmar que isso consta lá.
- [alta] (inventou) turno 16: Afirma que a entrega 'combina com a Dona Vera depois' e que 'começa daqui a uns 4 dias' foi anotado. Pede 'quando ela responder, me avisa', sem ele ter pedido, o que soa como cobrança de retorno.
- [alta] (inventou) turno 19: Quando o Adriano pediu confirmação, o bot disse 'como vai no PDF', sem saber se o PDF traz o início em 4 dias. Também foi o bot que confirmou algo que não pode confirmar (o bot não fala com a cliente). Faltou dizer que só anotou.
- [media] (inventou) turno 22: Repete que 'o que ficou no PDF é' início em 4 dias e 3 semanas, afirmação não verificada sobre o conteúdo do PDF.
- [media] (fluxo_confuso) turno 14: O PDF foi enviado antes de o Adriano responder sobre a data. As mensagens 14 a 16 vêm sem ordem clara e o turno 19 repete o que o 16 já dissera.

<details><summary>Conversa</summary>

```
1. ADRIANO (áudio): E aí, beleza? Então, é uma cômoda da dona Vera, de 4 gavetas, pintura lisa branca. Ela quer pintar de branco e trocar os puxadores. A cômoda tá boa, só vou pintar por fora, com rolo. Os puxadores são 8, eu compro a 15 reais cada, dá 120 de puxador. Ela traz e busca. Dá pra fazer em umas 3 semanas.
2. BOT: 🎧 Ouvi: "E aí, beleza? Então, é uma cômoda da dona Vera, de 4 gavetas, pintura lisa branca. Ela quer pintar de branco e trocar os puxadores. A cômoda tá boa, só vou pintar por fora, com rolo. Os puxadores são 8, eu compro a 15 reais cada, dá 120 de puxador. Ela traz e busca. Dá pra fazer em umas 3 semanas."
3. BOT: Anotei a cômoda da Dona Vera: 4 gavetas, pintura lisa branca por fora, com rolo, e os 8 puxadores a R$ 15 cada. Pra eu fechar a conta, qual o tamanho dela? Pode ser em cm ou pequena, média ou grande 📏

📸 Se tiver foto da peça, manda que ajuda!
4. ADRIANO (áudio): Ah, é 90 de largura, 80 de altura e 45 de fundura. Tá boa, não tem nada de defeito grande, só a pintura pra renovar mesmo. Os puxadores eu compro a 15 cada, então 120 no total, e a dona Vera traz e busca.
5. BOT: 🎧 Ouvi: "Ah, é 90 de largura, 80 de altura e 45 de fundura. Tá boa, não tem nada de defeito grande, só a pintura pra renovar mesmo. Os puxadores eu compro a 15 cada, então 120 no total, e a dona Vera traz e busca."
6. BOT: Anotei tudo 📏 Fiz a conta da cômoda da Dona Vera:

💰 Sugestão: **R$ 400,00**
⚠️ Abaixo de R$ 346,00 você fica no prejuízo.
⏱️ Dá uns 2 dias de trabalho.

Você concorda, quer dar desconto ou acrescentar algo?
   [botões: 👍 Concordo | ➖ Dar desconto | ➕ Acrescentar]
7. ADRIANO: [tocou: ➕ Acrescentar]
8. BOT: Beleza! Quanto você quer acrescentar nessa cômoda da Dona Vera? 💰
9. ADRIANO (áudio): Então, não é acréscimo, é só o preço mesmo. Os 120 dos puxadores já tão dentro dos 400. Pode deixar assim, sem acrescentar nada.
10. BOT: 🎧 Ouvi: "Então, não é acréscimo, é só o preço mesmo. Os 120 dos puxadores já tão dentro dos 400. Pode deixar assim, sem acrescentar nada."
11. BOT: Fechado, fica em R$ 400,00 então, sem acréscimo ✅

Você consegue começar quando? Pelo que falou, ela fica pronta em umas 3 semanas, né?
12. ADRIANO (áudio): Isso, 3 semanas. Pode colocar a Dona Vera pra começar daqui a uns 4 dias, mais ou menos. Ela traz e busca, então isso eu combino com ela depois. O prazo de 3 semanas tá bom pra mim.
13. BOT: 🎧 Ouvi: "Isso, 3 semanas. Pode colocar a Dona Vera pra começar daqui a uns 4 dias, mais ou menos. Ela traz e busca, então isso eu combino com ela depois. O prazo de 3 semanas tá bom pra mim."
14. BOT: [PDF enviado: Proposta-AP-2026-0001-v1.pdf]
15. BOT: 📲 Pra mandar pro cliente: segure o PDF ☝️ → Compartilhar → WhatsApp.
16. BOT: Fechado! Anotei: começa daqui a uns 4 dias e leva umas 3 semanas, e a entrega combina com a Dona Vera depois ✅

Te mandei o PDF aqui no Telegram pra você repassar pra ela. Quando ela responder, me avisa 📄
17. ADRIANO (áudio): Beleza, valeu! Só uma coisa: confirma pra mim que ela pode começar daqui a uns 4 dias e que o prazo de 3 semanas fica combinado. Depois eu mando o PDF pra ela.
18. BOT: 🎧 Ouvi: "Beleza, valeu! Só uma coisa: confirma pra mim que ela pode começar daqui a uns 4 dias e que o prazo de 3 semanas fica combinado. Depois eu mando o PDF pra ela."
19. BOT: Anotado: começa daqui a uns 4 dias e leva umas 3 semanas, como vai no PDF 📄 O PDF já tá aqui no Telegram pra você repassar pra Dona Vera.
20. ADRIANO (áudio): Beleza. Só pra não ficar dúvida: eu não confirmo nada com a Dona Vera, quem combina com ela é eu mesmo. Mas o que ficou anotado no PDF é isso: começa em uns 4 dias e leva umas 3 semanas. Tá certo, pode fechar assim. Obrigado!
21. BOT: 🎧 Ouvi: "Beleza. Só pra não ficar dúvida: eu não confirmo nada com a Dona Vera, quem combina com ela é eu mesmo. Mas o que ficou anotado no PDF é isso: começa em uns 4 dias e leva umas 3 semanas. Tá certo, pode fechar assim. Obrigado!"
22. BOT: Combinado, Adriano! O que ficou no PDF é: começa em uns 4 dias e leva umas 3 semanas. Você combina a entrega direto com a Dona Vera 👍
```

</details>

## div-banco-jardim — Banco de jardim (fica no tempo) com verniz marítimo

Notas: entendimento 3 · naturalidade 3 · acessibilidade 3 · uma_pergunta_por_vez 4 · sem_invencao 3 · eficiencia 4 · conclusao 5 · 35s

- ✅ peça anotada com o nome que ele usou
- ✅ chegou num valor
- ✅ PDF gerado
- ✅ sem travar nem falar de sistema

> Objetivo atingido: valor e PDF gerados em poucas trocas, sem travar. Mas a pergunta 'por fora ou por dentro' foi sem sentido para banco de jardim, o bot inventou '2 dias de trabalho' e expôs piso de prejuízo com tom de sistema. Atendimento correto, porém abaixo de um bom atendente humano.

- [media] (pergunta_desnecessaria) turno 3: Perguntou se é só por fora ou por dentro também, sendo um banco de jardim, o que não faz sentido. Pergunta irrelevante que fez o Adriano repetir informação (prazo) e perder uma troca.
- [baixa] (nao_entendeu) turno 3: Não confirmou medidas, lixar bem, sem conserto nem prazo no resumo. Só listou parte do que ele disse e deixou dúvida se tudo foi captado.
- [media] (jargao) turno 6: Usou 'Menos que R$ 351 você fica no prejuízo', que mostra um piso técnico sem ele pedir, e 'Fechou a conta', tom de sistema. Também usou negrito markdown.
- [media] (inventou) turno 6: Afirmou 'dá uns 2 dias de trabalho' sem o Adriano ter dito. Estimativa não vinda dele nem confirmada. Também apresentou o prazo como 'pronto daqui a 2 semanas' sem ter sido combinado como data fechada.
- [baixa] (pergunta_multipla) turno 6: Perguntou se concorda, quer desconto ou acrescentar numa mesma mensagem, ainda que com botões.
- [baixa] (tom) turno 10: Mensagem final repete o que já foi dito (PDF enviado), um pouco redundante; 'Fechado' sugere que o cliente aceitou, quando só o Adriano aprovou o valor.

<details><summary>Conversa</summary>

```
1. ADRIANO (áudio): E aí, tudo bem? Olha, o seu Antônio me pediu pra envernizar um banco de madeira que ele tem no jardim. Fica exposto no sol e na chuva, então quer verniz marítimo. O banco tem 1,50 de comprimento, 45 de fundura e 85 de altura com o encosto. Tá meio cinza do sol, então precisa lixar bem, mas não tem nenhum conserto. Eu passo com pincel. Ele busca e entrega, o frete seria 70. Ele quer pronto daqui a 2 semanas. Consegue me ajudar a fechar o orçamento?
2. BOT: 🎧 Ouvi: "E aí, tudo bem? Olha, o seu Antônio me pediu pra envernizar um banco de madeira que ele tem no jardim. Fica exposto no sol e na chuva, então quer verniz marítimo. O banco tem 1,50 de comprimento, 45 de fundura e 85 de altura com o encosto. Tá meio cinza do sol, então precisa lixar bem, mas não tem nenhum conserto. Eu passo com pincel. Ele busca e entrega, o frete seria 70. Ele quer pronto daqui a 2 semanas. Consegue me ajudar a fechar o orçamento?"
3. BOT: Anotei o banco do Seu Antônio: verniz marítimo, pincel, você busca e entrega com frete de R$ 70. Falta só uma coisa: é só por fora ou por dentro também? 🪵

📸 Se tiver foto da peça, manda que ajuda!
4. ADRIANO (áudio): Só por fora, o banco é de jardim. Pode considerar só a parte de fora, lixar e envernizar. Ele quer pronto daqui a duas semanas.
5. BOT: 🎧 Ouvi: "Só por fora, o banco é de jardim. Pode considerar só a parte de fora, lixar e envernizar. Ele quer pronto daqui a duas semanas."
6. BOT: Fechou a conta do banco do Seu Antônio, só por fora: sugestão de **R$ 412,00**, com frete de R$ 70 incluído. Menos que R$ 351 você fica no prejuízo. Dá uns 2 dias de trabalho, pronto daqui a 2 semanas. Você concorda com esse valor, quer dar desconto ou acrescentar algo? 🪵
   [botões: 👍 Concordo | ➖ Dar desconto | ➕ Acrescentar]
7. ADRIANO: [tocou: 👍 Concordo]
8. BOT: [PDF enviado: Proposta-AP-2026-0001-v1.pdf]
9. BOT: 📲 Pra mandar pro cliente: segure o PDF ☝️ → Compartilhar → WhatsApp.
10. BOT: Fechado! 🎉 O banco do Seu Antônio ficou em R$ 412,00 e te mandei o PDF aqui no Telegram pra você repassar a ele. Quando ele responder, me avisa.
```

</details>

## div-bau-e-espelho — Duas peças diferentes: baú (pátina) e moldura de espelho redonda (folha de ouro)

Notas: entendimento 4 · naturalidade 4 · acessibilidade 4 · uma_pergunta_por_vez 4 · sem_invencao 4 · eficiencia 4 · conclusao 5 · 51s

- ✅ peça anotada com o nome que ele usou
- ✅ chegou num valor
- ✅ PDF gerado
- ✅ sem travar nem falar de sistema
- ✅ moldura anotada

> Conversa eficiente que chegou ao valor das duas peças e gerou o PDF, sem inventar nada e com tom amigável. Falhas pequenas: perguntas sobre conserto e sobre a parte de trás da moldura que ele já tinha respondido ou que eram desnecessárias, a frase do 'prejuízo' meio técnica, e o 'Fechou!' final prematuro.

- [baixa] (pergunta_repetida) turno 3: Perguntou se o baú precisa de conserto, mas Adriano já tinha dito que estava em bom estado. Ele precisou repetir nos turnos 4 e 7.
- [baixa] (pergunta_repetida) turno 9: Perguntou se a moldura é só por fora ou tem parte de trás/dentro, e a pergunta não combina bem com moldura redonda. Ele já tinha dito 'moldura toda'.
- [media] (jargao) turno 12: A frase 'Abaixo de R$ 1.361,00 você fica no prejuízo' é um piso técnico, solta e seca, sem explicação. Também diz 'uns 7 dias de trabalho no total' sem ele ter dado esse tempo, mas isso vem das contas do sistema.
- [baixa] (texto_longo) turno 12: Mensagem de valores um pouco carregada, com várias informações e uma pergunta com três opções (concordo, desconto, acrescentar).
- [baixa] (tom) turno 16: Repete o aviso do PDF (turnos 14-16). 'Fechou!' soa como se o negócio estivesse fechado, quando o cliente ainda não respondeu.

<details><summary>Conversa</summary>

```
1. ADRIANO (áudio): E aí, tudo bem? Então, uma cliente, dona Fátima, trouxe um baú pra eu fazer pátina azul envelhecida, 80 por 45, 50 de altura, por dentro e por fora. Tá em bom estado, é pincel mesmo. Ela também quer uma moldura de espelho redonda, 80 de diâmetro, com folha de ouro na moldura toda, bom estado também, pincel. Ela traz e busca as duas. Queria as duas prontas daqui a 1 mês. Dá pra fazer o orçamento dessas duas?
2. BOT: 🎧 Ouvi: "E aí, tudo bem? Então, uma cliente, dona Fátima, trouxe um baú pra eu fazer pátina azul envelhecida, 80 por 45, 50 de altura, por dentro e por fora. Tá em bom estado, é pincel mesmo. Ela também quer uma moldura de espelho redonda, 80 de diâmetro, com folha de ouro na moldura toda, bom estado também, pincel. Ela traz e busca as duas. Queria as duas prontas daqui a 1 mês. Dá pra fazer o orçamento dessas duas?"
3. BOT: Anotei as duas peças da Dona Fátima ✅: o baú com pátina azul por dentro e por fora, e a moldura redonda de 80 cm com folha de ouro. Ela traz e busca, e as duas ficam prontas daqui a 1 mês.

O baú precisa de algum conserto?

📸 Se tiver foto da peça, manda que ajuda!
4. ADRIANO (áudio): Não, o baú tá em bom estado, não precisa de conserto nenhum. Só pátina mesmo, por dentro e por fora. Pode seguir.
5. BOT: 🎧 Ouvi: "Não, o baú tá em bom estado, não precisa de conserto nenhum. Só pátina mesmo, por dentro e por fora. Pode seguir."
6. BOT: Anotei: o baú sem conserto, pátina azul por dentro e por fora ✅

Falta só a moldura. Ela precisa de conserto?
7. ADRIANO (áudio): Não, a moldura tá em bom estado também, não precisa de conserto. Só a folha de ouro na moldura toda, com pincel mesmo. Pode seguir.
8. BOT: 🎧 Ouvi: "Não, a moldura tá em bom estado também, não precisa de conserto. Só a folha de ouro na moldura toda, com pincel mesmo. Pode seguir."
9. BOT: Anotei: a moldura com folha de ouro, sem conserto, pincel. ✅

Essa moldura é só por fora ou tem parte de trás/dentro pra dourar também?
10. ADRIANO (áudio): Só na frente mesmo, a parte de trás é lisa e não precisa dourar. Só a moldura toda, de frente.
11. BOT: 🎧 Ouvi: "Só na frente mesmo, a parte de trás é lisa e não precisa dourar. Só a moldura toda, de frente."
12. BOT: Fiz as contas das duas peças da Dona Fátima 🎨:

• O baú com pátina azul: R$ 490,00
• A moldura redonda com folha de ouro: R$ 1.163,00

💰 Total sugerido: R$ 1.653,00. Abaixo de R$ 1.361,00 você fica no prejuízo.

Ficam prontas em 1 mês, com uns 7 dias de trabalho no total. Você concorda com esse valor, quer dar desconto ou acrescentar algo?
   [botões: 👍 Concordo | ➖ Dar desconto | ➕ Acrescentar]
13. ADRIANO: [tocou: 👍 Concordo]
14. BOT: [PDF enviado: Proposta-AP-2026-0001-v1.pdf]
15. BOT: 📲 Pra mandar pro cliente: segure o PDF ☝️ → Compartilhar → WhatsApp.
16. BOT: Fechou! ✅ Orçamento da Dona Fátima em R$ 1.653,00, com o baú e a moldura juntos.

Te mandei o PDF aqui no Telegram pra você repassar pra ela. Quando ela responder, me avisa.
```

</details>
