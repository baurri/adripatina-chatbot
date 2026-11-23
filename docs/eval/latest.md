# Avaliação com Claude real — 2026-11-23T21:23

Motor: agente (D-075) · Bot: claude-haiku-5-5 · Adriano simulado: claude-haiku-5-5 · Avaliador: claude-sonnet-5-5

Conferências objetivas: **45/46**

| Critério | Média (1–5) |
|---|---|
| entendimento | 3.92 |
| naturalidade | 3.50 |
| acessibilidade | 3.25 |
| uma_pergunta_por_vez | 3.50 |
| sem_invencao | 3.42 |
| eficiencia | 3.42 |
| conclusao | 4.33 |

## Problemas por classe

- baixa:tom: 11
- media:pergunta_repetida: 9
- media:jargao: 7
- media:inventou: 4
- baixa:texto_longo: 4
- media:fluxo_confuso: 4
- alta:inventou: 3
- baixa:nao_entendeu: 3
- baixa:perdeu_informacao: 2
- alta:nao_entendeu: 2
- alta:fluxo_confuso: 2
- media:tom: 2
- media:uma_pergunta_por_vez: 2
- baixa:inventou: 2
- baixa:jargao: 2
- media:nao_entendeu: 1
- media:pergunta_desnecessaria: 1
- alta:jargao: 1
- media:loop: 1
- media:promessa: 1
- baixa:texto_cortado: 1
- media:pergunta_redundante: 1
- media:perguntou_o_que_ja_foi_dito: 1
- baixa:repeticao: 1
- baixa:pergunta_multipla: 1
- media:promessa_falsa: 1
- baixa:pergunta_desnecessaria: 1
- baixa:fluxo_confuso: 1
- media:texto_longo: 1
- media:perdeu_informacao: 1
- baixa:eficiencia: 1
- baixa:pergunta_redundante: 1
- alta:inconsistencia: 1
- alta:texto_longo: 1

## real-adriano-roberto-jo — Conversa real do Adriano: mesinha + 2 móveis do Seu Roberto e da Dona Jo

Notas: entendimento 2 · naturalidade 3 · acessibilidade 3 · uma_pergunta_por_vez 3 · sem_invencao 2 · eficiencia 2 · conclusao 3 · 143s

- ✅ 3 peças (mesinha + 2 aparadores)
- ✅ 2 aparadores reconhecidos
- ✅ técnica verniz em todos
- ✅ cliente Seu Roberto/Dona Jo
- ❌ aparadores só no tampo — [{"part":"inteiro"},{"part":"tampo"}]
- ✅ medida/porte de todas as peças
- ✅ orçamento calculado para todos os serviços

> Os aparadores fecham em R$ 130 e o PDF sai, mas há falhas sérias: troca quem busca e entrega, inventa '2 horas', usa piso e prejuízo, repete a confirmação e a pergunta do tempo do conserto mesmo ele dizendo que ainda não sabe. A parte final vira um loop de quatro confirmações iguais e a última mensagem sai cortada.

- [alta] (inventou) turno 6: Diz que 'Vocês dois, Seu Roberto e Dona Jo, buscam e entregam', mas quem busca e entrega é o Adriano. Troca o sujeito e distorce o fato.
- [media] (nao_entendeu) turno 3: Interpreta 'os outros dois móveis' sem pedir o tipo. Depois ele corrige para aparadores. Pedir as medidas da mesinha antes de saber o que eram os outros móveis desorganiza o fluxo.
- [media] (pergunta_desnecessaria) turno 9: Pergunta se é 'por fora ou por dentro' num tampo de aparador, o que não faz sentido. Ele já tinha dito que é só o tampo.
- [alta] (jargao) turno 12: Fala de 'prejuízo' com piso de R$ 104,00 e mostra preço calculado. Mensagem longa e carregada de informação, mistura aparadores, frete e mesinha. Não pergunta o tempo do conserto de forma simples.
- [media] (inventou) turno 12: Fala em 'umas 2 horas' de trabalho para os aparadores, sem ele ter dito. Ele estimou 3 a 5 dias para o serviço todo. Também ignora o material de R$ 70 que ele informou.
- [media] (pergunta_repetida) turno 14: Pede confirmação de novo depois do 'Concordo'. Pressiona o fechamento e repete o piso de R$ 104,00.
- [media] (pergunta_repetida) turno 17: Pergunta o tempo do conserto, que ele já tinha dito que não sabia, e depois repete nos turnos 20, 23 e 26. Ele já havia dito 'não sei', e o assistente insiste.
- [media] (loop) turno 20: Os turnos 20 a 29 repetem a mesma confirmação 'aparadores fechados em 130 e mesinha em aberto' quatro vezes, sem avançar. Ele já tinha explicado que ia olhar a peça.
- [media] (promessa) turno 17: Diz 'Mandei o PDF' e pede para avisar quando o cliente responder. É um envio real pelo sistema, mas faltou deixar claro que ainda não houve resposta do cliente.
- [baixa] (texto_cortado) turno 29: Última mensagem cortada ('abe') e repete mais uma vez o mesmo conteúdo.
- [baixa] (perdeu_informacao) turno 12: Não aproveita o material de R$ 70 nem os 3 a 5 dias dados por ele ao calcular o valor. Também não explica a conta.

<details><summary>Conversa</summary>

```
1. ADRIANO (áudio): E aí, tudo bem? Terça eu vou buscar um trabalho do seu Roberto e da Dona Jo. É uma mesinha de centro, que é pra lixar inteira e passar verniz. Tem mais outros dois móveis que é só o tampo. Queria saber quanto cobrar por isso tudo.
2. BOT: 🎧 Ouvi: "E aí, tudo bem? Terça eu vou buscar um trabalho…"
3. BOT: Anotado: mesinha de centro do Seu Roberto e da Dona Jo, lixar inteira e passar verniz, você busca na terça. 🪵

Pra eu fechar o valor dela, me diz as medidas (comprimento, largura e altura em cm), ou se ela é pequena, média ou grande.

Depois me fala quais são os outros dois móveis que são só tampo.
4. ADRIANO (áudio): Mesinha é redonda, 80 cm de diâmetro por 45 de altura. Os outros dois são duas aparadoras, cada tampo 1,20 por 40. Lixar e envernizar só o tampo. Tem o detalhe que o tampo da mesinha tá meio danificado, precisa acertar uns detalhes antes. Vou de pincel, já tenho o verniz. Eu mesmo busco e entrego. Acho que leva uns 3 a 5 dias e o material deve dar uns 70 reais.
5. BOT: 🎧 Ouvi: "Mesinha é redonda, 80 cm de diâmetro por 45 de…"
6. BOT: Anotado: mesinha redonda de 80 cm de diâmetro por 45 de altura, lixar e envernizar, com um ajuste no tampo antes. Os dois aparadores ficaram como 2 tampos de 1,20 m por 40 cm, lixar e envernizar só o tampo. Vocês dois, Seu Roberto e Dona Jo, buscam e entregam.

Pros aparadores ainda falta saber o estado deles: estão bons (só riscos), precisam de reparos (colar, massa) ou estão bem danificados?
7. ADRIANO (áudio): Os aparadores tão melhores, só com risco mesmo. Lixa e passa verniz, sem colar nem massa. Me diz aí quanto fica o valor.
8. BOT: 🎧 Ouvi: "Os aparadores tão melhores, só com risco mesmo. Lixa e…"
9. BOT: Anotado: os dois aparadores estão bons, só com riscos, sem conserto. Vai lixar e envernizar só o tampo, com pincel.

Antes de fechar o valor, preciso saber uma coisa: é só por fora ou tem que lixar e envernizar por dentro também?
10. ADRIANO (áudio): Só por fora, não precisa lixar nem envernizar por dentro. Pode fechar o valor assim.
11. BOT: 🎧 Ouvi: "Só por fora, não precisa lixar nem envernizar por dentro.…"
12. BOT: Pelas contas, os dois aparadores (lixar e envernizar só o tampo, por fora, com pincel) ficam em **R$ 130,00** no total. Abaixo de R$ 104,00 você fica no prejuízo. O trabalho é de umas 2 horas.

Como você mesmo busca e entrega, não entrou frete no cálculo. Se tiver algum custo de transporte, me fala.

A mesinha ainda não dá pra fechar: falta saber quanto tempo você acha que leva o conserto do tampo. Assim que me disser, eu refaço a conta dela.

Fecho os aparadores em R$ 130,00?
   [botões: 👍 Concordo | ➖ Dar desconto | ➕ Acrescentar]
13. ADRIANO: [tocou: 👍 Concordo]
14. BOT: Pelo que você falou, os dois aparadores ficam em **R$ 130,00**. Antes de travar, preciso que você confirme de novo: pode mandar o PDF com esse valor?

Abaixo de R$ 104,00 você fica no prejuízo. A mesinha continua em aberto, esperando o tempo do conserto do tampo. 🪵
   [botões: 👍 Concordo | ➖ Dar desconto | ➕ Acrescentar]
15. ADRIANO: [tocou: 👍 Concordo]
16. BOT: [PDF enviado: Proposta-AP-2026-0001-v1.pdf]
17. BOT: Fechado! Mandei o PDF dos dois aparadores do Seu Roberto e da Dona Jo por **R$ 130,00**. 📄

Assim que o cliente responder, me avisa que eu registro. A mesinha redonda continua em aberto. Quanto tempo você acha que leva o conserto do tampo dela?
18. ADRIANO (áudio): Beleza, valeu! Então os aparadores tão fechados em 130. A mesinha eu ainda não sei quanto tempo leva o conserto do tampo, tá meio judiado ali embaixo do verniz velho. Deixa eu olhar direito antes de chutar, depois eu te falo.
19. BOT: 🎧 Ouvi: "Beleza, valeu! Então os aparadores tão fechados em 130. A…"
20. BOT: Beleza, os aparadores ficam fechados em R$ 130,00. ✅

Anotei que o tampo da mesinha precisa de conserto por baixo do verniz velho. Sem pressa: dá uma olhada com calma e, quando souber quanto tempo o conserto leva, me fala que eu refaço a conta. 🪵
21. ADRIANO (áudio): Isso, valeu! Pode deixar, depois eu te falo quanto tempo leva a mesinha. Só mais uma coisa: o tampo dela tá com dano por baixo do verniz velho, então ainda não sei se é só lixar ou se tem que colar. Quando eu olhar direito eu passo pra você.
22. BOT: 🎧 Ouvi: "Isso, valeu! Pode deixar, depois eu te falo quanto tempo…"
23. BOT: Anotado. Quando você olhar o tampo e souber se é só lixar ou se precisa colar, me fala o tempo estimado que eu refaço a conta da mesinha. 🛠️
24. ADRIANO (áudio): Beleza, valeu! Então fica combinado: aparadores fechados em 130, e a mesinha fica pra depois, quando eu olhar o tampo direito. Assim que eu souber se é só lixar ou se tem que colar, eu te falo o tempo.
25. BOT: 🎧 Ouvi: "Beleza, valeu! Então fica combinado: aparadores fechados em 130, e…"
26. BOT: Combinado: os aparadores ficam em R$ 130,00 e a mesinha fica em aberto. ✅

Quando você olhar o tampo e souber se é só lixar ou se precisa colar, me passa o tempo estimado que eu refaço a conta. 🪵
27. ADRIANO (áudio): Isso mesmo, aparadores fechados em 130. A mesinha eu deixo pra depois, quando eu olhar o tampo direito e souber se é só lixar ou se tem que colar. Aí eu te falo o tempo.
28. BOT: 🎧 Ouvi: "Isso mesmo, aparadores fechados em 130. A mesinha eu deixo…"
29. BOT: Combinado: os aparadores ficam fechados em R$ 130,00 e a mesinha fica em aberto. ✅

Quando você olhar o tampo e me disser se é só lixar ou se precisa colar, eu refaço a conta. 🪵
30. ADRIANO (áudio): Isso, valeu! Tô esperando eu olhar a mesinha direito. Quando eu souber se é só lixar ou se tem que colar, eu te falo o tempo. Os aparadores tão fechados em 130, pode mandar o PDF pro cliente que eu aviso quando ele responder.
31. BOT: 🎧 Ouvi: "Isso, valeu! Tô esperando eu olhar a mesinha direito. Quando…"
32. BOT: Isso, os aparadores estão fechados em **R$ 130,00**. O PDF já foi enviado para o Seu Roberto e a Dona Jo, então não precisa mandar de novo.

Quando o cliente responder, me avisa que eu registro. A mesinha fica em aberto até você olhar o tampo. 🪵
33. ADRIANO (áudio): Beleza, valeu! Então os aparadores ficam em 130 e a mesinha fica pra depois. Assim que eu olhar o tampo direito e souber se é só lixar ou se tem que colar, eu te falo o tempo. Quando o Seu Roberto e a Dona Jo responderem eu te aviso pra registrar.
34. BOT: 🎧 Ouvi: "Beleza, valeu! Então os aparadores ficam em 130 e a…"
35. BOT: Combinado! Quando o Seu Roberto e a Dona Jo responderem, me avisa que eu registro. Quando olhar o tampo da mesinha, me fala o tempo que eu refaço a conta. 🪵
36. ADRIANO (áudio): Beleza, valeu! Aparadores fechados em 130 e a mesinha fica pra depois. Quando eu olhar o tampo direito e souber se é só lixar ou se tem que colar, eu te falo o tempo. Aí você refaz a conta.
37. BOT: 🎧 Ouvi: "Beleza, valeu! Aparadores fechados em 130 e a mesinha fica…"
38. BOT: Combinado: os aparadores ficam em **R$ 130,00** e a mesinha fica em aberto. ✅

Quando você olhar o tampo e me disser se é só lixar ou se precisa colar, me passa o tempo e eu refaço a conta. 🪵
39. ADRIANO (áudio): Beleza, então é isso: aparadores fechados em 130 e a mesinha fica em aberto. Quando eu olhar o tampo e souber se é só lixar ou se tem que colar, eu te passo o tempo. Aí você refaz a conta. Valeu!
40. BOT: 🎧 Ouvi: "Beleza, então é isso: aparadores fechados em 130 e a…"
41. BOT: Combinado! Quando olhar o tampo da mesinha, me passa o tempo que eu refaço a conta. 🪵
42. ADRIANO (áudio): Beleza, então é isso mesmo. Aparadores fechados em 130 e a mesinha fica em aberto até eu olhar o tampo. Quando eu souber se é só lixar ou se tem que colar, eu te passo o tempo e você refaz a conta. Valeu!
43. BOT: 🎧 Ouvi: "Beleza, então é isso mesmo. Aparadores fechados em 130 e…"
44. BOT: Combinado! Aparadores fechados em R$ 130,00 e a mesinha segue em aberto. Quando olhar o tampo e souber se é só lixar ou se precisa colar, me passa o tempo. 🪵
45. ADRIANO (áudio): Beleza, então tá fechado. Aparadores em 130 e a mesinha fica em aberto até eu olhar o tampo. Assim que eu ver se é só lixar ou se tem que colar, eu te falo o tempo e você refaz a conta. Valeu!
46. BOT: 🎧 Ouvi: "Beleza, então tá fechado. Aparadores em 130 e a mesinha…"
47. BOT: Combinado! Quando você olhar o tampo, me fala o tempo que eu refaço a conta. 🪵
48. ADRIANO (áudio): Beleza, então tá fechado mesmo. Aparadores em 130, mesinha em aberto. Quando eu olhar o tampo e ver se é só lixar ou se tem que colar, eu te passo o tempo.
49. BOT: 🎧 Ouvi: "Beleza, então tá fechado mesmo. Aparadores em 130, mesinha em…"
50. BOT: Combinado! Aparadores em R$ 130,00 e a mesinha em aberto. Quando olhar o tampo e souber se é só lixar ou se precisa colar, me passa o tempo que eu refaço a conta. 🪵
51. ADRIANO (áudio): Beleza, é isso mesmo. Aparadores em 130 e a mesinha fica em aberto. Quando eu olhar o tampo e ver se é só lixar ou se tem que colar, eu te falo o tempo e você refaz a conta. Valeu!
52. BOT: 🎧 Ouvi: "Beleza, é isso mesmo. Aparadores em 130 e a mesinha…"
53. BOT: Anotado: aparadores em R$ 130,00 e a mesinha em aberto até você olhar o tampo. Quando souber se é só lixar ou se precisa colar, é só me passar o tempo. 🪵
```

</details>

## admin-mesinha-criados — Administrador: mesinha + 2 criados-mudos, medidas todas de uma vez

Notas: entendimento 3 · naturalidade 3 · acessibilidade 3 · uma_pergunta_por_vez 4 · sem_invencao 2 · eficiencia 2 · conclusao 3 · 122s

- ✅ 3 peças
- ✅ 2 criados-mudos
- ✅ cliente Dona Carla
- ✅ medidas das 3 peças
- ✅ sem frete (cliente traz e busca)
- ✅ PDF gerado após o desconto

> O bot chegou ao valor e aplicou o desconto de 10%, mas perdeu tempo com perguntas já respondidas, ignorou duas vezes o pedido de valor e desconto, e inventou 'pé' na mesa. Gerou dois PDFs sem deixar claro como ficou o valor de cada um e repetiu o mesmo aviso várias vezes no final.

- [media] (pergunta_redundante) turno 3: Pede o tamanho da mesa em comprimento, largura e altura mesmo sendo redonda; depois ainda volta a perguntar a altura (turno 18) e por dentro/fora (turno 12).
- [alta] (nao_entendeu) turno 12: Ele já disse que não há conserto nem pé quebrado, mas o bot anota 'a mesa não tem conserto' (ambíguo) e 'o pé está bom', inventando uma mesa com pé. Ignora o pedido de valor e desconto de 10%, e pergunta de novo sobre o acabamento por dentro.
- [media] (pergunta_repetida) turno 15: Ele pediu valor e desconto duas vezes (turnos 10 e 13) e o bot seguiu perguntando detalhes sem reconhecer o pedido. Ele precisou repetir.
- [media] (perguntou_o_que_ja_foi_dito) turno 18: Tinha dito que os criados-mudos eram só tampo, lixar e envernizar; o bot pergunta de novo o estado. Também anota 'a Dona Carla já deixou você ver a mesa' como se fosse algo novo, uma fala de passagem.
- [alta] (inventou) turno 21: Mostra valores e o mínimo (R$ 415,57) sem explicar, o que soa como jargão. Também aplica o desconto na soma dos dois, mas 'fechado em R$ 459,00' mistura mesa e criados-mudos. Ele só pediu para ver o valor; a pergunta 'quer que eu feche' puxa para o fechamento.
- [alta] (fluxo_confuso) turno 23: Gerou dois PDFs separados (mesa e criados-mudos), embora o orçamento seja um só. A frase 'Fechado em R$ 459,00' deixa confuso quanto ao valor de cada PDF.
- [baixa] (repeticao) turno 27: Repete a mesma frase 'quando ela responder me avisa' três vezes seguidas (turnos 25, 27, 29, 31), com eco sem acrescentar nada.
- [media] (tom) turno 31: Responde 'O de 10% foi ideia sua', tom seco e corretivo para uma pergunta simples. Diz que está 'fechado' e 'fico aguardando', soando como confirmação do que depende da cliente.

<details><summary>Conversa</summary>

```
1. ADRIANO (áudio): Fala, tudo bem? Preciso de um orçamento. Uma mesinha de centro, inteira, que é pra lixar, acertar uns detalhes e envernizar. E mais dois criados-mudos, só o tampo, pra lixar e envernizar também. Os dois são iguais. Já trnho o pincel e a faca pra raspar, então é só mão de obra. A cliente deixa em casa e busca depois de pronto. Consegue me passar o valor pra eu ver aqui?
2. BOT: 🎧 Ouvi: "Fala, tudo bem? Preciso de um orçamento. Uma mesinha de…"
3. BOT: Anotado: duas peças, a mesa de centro inteira (lixar, acertar detalhes e envernizar) e 2 criados-mudo iguais, só o tampo (lixar e envernizar). Você tem pincel e faca, então é só mão de obra, e a cliente leva e busca.

Pra eu calcular a mesa, qual o tamanho dela? Pode ser em cm (comprimento, largura e altura) ou pequena, média ou grande.
4. ADRIANO (áudio): A mesinha é redonda, tem 2 metros de largura. Os criados-mudos têm 80 cm de largura e 40 de altura, os dois iguais.
5. BOT: 🎧 Ouvi: "A mesinha é redonda, tem 2 metros de largura. Os…"
6. BOT: Anotado: a mesa é redonda, 2 m de diâmetro, e os dois criados-mudo são 80 cm de largura por 40 de altura. Os dois têm só tampo, e a cliente deixa e busca em casa.

Qual o nome da cliente, com tratamento (Dona Fulana ou Seu Fulano)?
7. ADRIANO (áudio): Dona Carla, a cliente é a dona Carla.
8. BOT: 🎧 Ouvi: "Dona Carla, a cliente é a dona Carla."
9. BOT: Anotado: a mesa de centro e os dois criados-mudo são da Dona Carla. Ela deixa em casa e busca depois de pronto.

A mesa precisa de algum conserto, ou é só lixar, acertar os detalhes e envernizar?
10. ADRIANO (áudio): Isso mesmo, só lixar, acertar uns detalhes e envernizar. Não tem conserto de madeira, nem pé quebrado, nada. Tá tudo bem firme, só precisa da mão de obra mesmo. Aí eu queria ver o valor, e se der pra fazer um desconto de 10% pra ela, melhor ainda.
11. BOT: 🎧 Ouvi: "Isso mesmo, só lixar, acertar uns detalhes e envernizar. Não…"
12. BOT: Anotado: a mesa não tem conserto, a madeira está firme e o pé está bom.

Antes de fechar o valor, falta saber uma coisa: a mesa é só por fora ou você lixa e enverniza por dentro também? Sendo mesa de centro, geralmente é só por fora, mas me confirma.
13. ADRIANO (áudio): Por fora mesmo, só o tampo e as partes que aparecem. Por dentro não precisa, ela não usa isso. Pode seguir o valor, e se der pra fazer 10% de desconto pra dona Carla eu queria ver também.
14. BOT: 🎧 Ouvi: "Por fora mesmo, só o tampo e as partes que…"
15. BOT: Anotado: a mesa é só por fora, incluindo tampo e partes que aparecem, e o diâmetro está em 2 m (200 cm).

Pra fechar o valor dos dois criados-mudo, preciso saber o estado deles: estão bons, só com riscos, ou têm algum reparo (colar, massa, algo mais firme)?
16. ADRIANO (áudio): Os dois criados-mudos estão bons, só com riscos leves e uma marca ou outra na superfície. Nada de colar, nem massa. Só lixar e envernizar mesmo, igual à mesa. Ah, e a mesa a dona Carla já deixou eu olhar, então pode seguir.
17. BOT: 🎧 Ouvi: "Os dois criados-mudos estão bons, só com riscos leves e…"
18. BOT: Anotado: os dois criados-mudo estão bons, só riscos leves e marcas, então é lixar e envernizar, sem massa nem colar. Também anotei que a Dona Carla já deixou você ver a mesa.

Para fechar o valor da mesa, falta a altura dela. Quantos centímetros tem do chão até o topo?
19. ADRIANO (áudio): A mesa é baixa, de centro, uns 45 cm do chão até o topo. Os criados-mudos são os 40 de altura que eu falei. Pode seguir o valor e vê o desconto de 10% pra dona Carla.
20. BOT: 🎧 Ouvi: "A mesa é baixa, de centro, uns 45 cm do…"
21. BOT: Pronto, Dona Carla, mesa e criados-mudo:

🪵 **Mesa de centro** (redonda, 2 m, 45 cm de altura): R$ 335,00
🛠️ **2 criados-mudo** (80 x 40 cm, só tampo): R$ 175,00 cada

Total sugerido: **R$ 510,00**, com umas 8 horas de trabalho.

Com 10% de desconto pra Dona Carla, fica **R$ 459,00**. Esse valor não fica abaixo do mínimo (R$ 415,57).

Quer que eu feche assim, com R$ 459,00?
   [botões: 👍 Concordo | ➖ Dar desconto | ➕ Acrescentar]
22. ADRIANO: [tocou: 👍 Concordo]
23. BOT: [PDF enviado: Proposta-AP-2026-0001-v1.pdf]
24. BOT: [PDF enviado: Proposta-AP-2026-0002-v1.pdf]
25. BOT: Fechado em R$ 459,00 pra Dona Carla, com o desconto de 10%. Mandei os 2 PDFs (mesa e criados-mudo).

Quando ela responder se aceita, me avisa que eu anoto aqui.
26. ADRIANO: Valeu, chefe! Já recebi os dois PDFs aqui. Quando a dona Carla responder, eu te aviso e anoto. Obrigado.
27. BOT: De nada, Adriano! Quando a Dona Carla responder, me manda aqui que eu anoto como aceito ou recusado. 🎨
28. ADRIANO: Beleza, valeu! Assim que a dona Carla responder eu te aviso e anoto aqui. Qualquer coisa me chama.
29. BOT: Beleza, Adriano! Fico aguardando o retorno da Dona Carla. Quando ela responder, é só me mandar aqui que eu anoto. 🪵
30. ADRIANO: Beleza, valeu! Assim que a dona Carla responder eu te aviso e anoto aqui. Só uma coisa: ela ainda não pediu desconto, né? Quando ela responder, me fala se aceitou o valor ou se quer negociar.
31. BOT: Isso, a Dona Carla ainda não pediu desconto. O de 10% foi ideia sua, e o orçamento da mesa e dos criados-mudo já está fechado com esse desconto.

Quando ela responder, me fala se aceitou o valor ou se quer negociar. Se ela quiser ajustar, a gente refaz a conta antes de mandar qualquer coisa. 🪵
32. ADRIANO (áudio): Isso mesmo, chefe. Ela ainda não pediu nada. O desconto de 10% fui eu que pedi pra fechar. Quando ela responder eu te falo se aceitou ou se quer negociar. Valeu!
33. BOT: 🎧 Ouvi: "Isso mesmo, chefe. Ela ainda não pediu nada. O desconto…"
34. BOT: Combinado, Adriano. Quando a Dona Carla responder, me fala se aceitou ou se quer negociar que eu anoto. 🪵
```

</details>

## admin-comoda-carla — Cômoda da Dona Carla (pátina), gavetão, correção e logística do cliente

Notas: entendimento 5 · naturalidade 4 · acessibilidade 3 · uma_pergunta_por_vez 3 · sem_invencao 4 · eficiencia 5 · conclusao 5 · 36s

- ✅ 1 serviço
- ✅ cômoda
- ✅ pátina
- ✅ 5 gavetas (4 + gavetão)
- ✅ gavetão nas observações
- ✅ estilete nas observações
- ✅ pincel
- ✅ sem frete
- ✅ medidas 1 m × 0,8 m

> Conversa eficiente: o bot entendeu a correção das medidas, registrou tudo corretamente (conferências OK) e fechou o orçamento de R$ 539,00 com o PDF. Pontos fracos: duas perguntas juntas no turno 3, uma pergunta redundante sobre as gavetas e uma mensagem de preço densa, com números e termos como 'prejuízo'.

- [media] (uma_pergunta_por_vez) turno 3: Fez duas perguntas na mesma mensagem (ordem das medidas e confirmação das 5 gavetas); o Adriano já tinha dito 4 gavetas e 1 gavetão.
- [media] (jargao) turno 6: Usa expressões como 'abaixo de R$ 436,14 você fica no prejuízo' e 'material novo', com muitos números juntos, o que é pesado para quem prefere conversa simples. Texto um pouco longo.
- [baixa] (tom) turno 9: Fala 'O PDF já foi enviado' e pede para avisar quando a cliente responder, o que é correto, mas o tom é um pouco formal. Também não repassa o tempo estimado de 9 horas.
- [baixa] (inventou) turno 6: Os R$ 165,00 de material novo aparecem sem contexto, mesmo sem ele ter falado em comprar material.

<details><summary>Conversa</summary>

```
1. ADRIANO (áudio): Oi, tudo bem? Então, chegou uma cômoda da dona Carla pra eu fazer a pátina. Ela tem uns 80 por 1 metro, mais ou menos. Tem 4 gavetas e um gavetão embaixo. Tá boazinha, só precisa por fora, sem conserto nenhum. Ela traz e busca quando tiver pronta. Queria saber quanto eu cobro nessa.
2. BOT: 🎧 Ouvi: "Oi, tudo bem? Então, chegou uma cômoda da dona Carla…"
3. BOT: Anotado: cômoda da Dona Carla, pátina por fora, estado bom, sem conserto, ela traz e busca.

Só falta confirmar o tamanho. Você falou "80 por 1 metro": são 80 cm de altura e 1 metro (100 cm) de largura? E as 5 gavetas (4 + o gavetão) estão certas?
4. ADRIANO (áudio): Não, errei a ordem. É 1 metro de altura por 80 cm de largura. E as gavetas estão certas: 4 gavetas e 1 gavetão embaixo, total 5. Pode seguir com a pátina por fora, pincel e estilete pra raspar.
5. BOT: 🎧 Ouvi: "Não, errei a ordem. É 1 metro de altura por…"
6. BOT: Anotado: cômoda de 1 m de altura por 80 cm de largura, 5 gavetas, pátina por fora com pincel e estilete pra raspar. Ela traz e busca.

Minha sugestão é **R$ 539,00**, em umas 9 horas de trabalho.

Abaixo de **R$ 436,14** você fica no prejuízo. Se for preciso comprar material novo, são uns R$ 165,00.

Você concorda com R$ 539,00 ou quer dar um desconto ou acrescentar algo?
   [botões: 👍 Concordo | ➖ Dar desconto | ➕ Acrescentar]
7. ADRIANO: Concordo sim, pode fechar em R$ 539,00. Só uma coisa: ela traz e busca quando estiver pronta, ok? Obrigado.
8. BOT: [PDF enviado: Proposta-AP-2026-0001-v1.pdf]
9. BOT: Fechado: cômoda da Dona Carla por **R$ 539,00**. Ela traz e busca, então não entra frete. O PDF do orçamento já foi enviado.

Quando a Dona Carla responder, me avisa se ela aceitou. ✅
```

</details>

## abreu-isa-casal — Mesa de cabeceira do Seu Abreu e da Dona Isa (casal), cor e tempo estimado

Notas: entendimento 4 · naturalidade 4 · acessibilidade 4 · uma_pergunta_por_vez 5 · sem_invencao 3 · eficiencia 5 · conclusao 5 · 37s

- ✅ 1 serviço (casal = 1 cliente)
- ✅ cor azul marinho anotada
- ✅ tempo estimado anotado
- ✅ segundo dono não se perdeu
- ✅ porte médio usado

> Chegou ao valor com poucas trocas e o Adriano concordou. Anotou tudo: cliente casal como um só, cor, tempo e porte médio. Pontos fracos: trocou 'mesa de cabeceira' por 'criado-mudo', chamou de 'fechado' o que ainda aguarda o cliente, usou termos como 'material novo' sem explicar e repetiu o aviso final três vezes.

- [media] (inventou) turno 6: Trocou 'mesa de cabeceira' por 'criado-mudo', nome de peça que o Adriano não usou.
- [media] (jargao) turno 6: Usa 'Material novo' e 'Abaixo de ... você fica no prejuízo' sem explicar. Não confirma que usou o porte médio nem os 3 a 5 dias, e o valor aparece sem mostrar de onde veio.
- [baixa] (inventou) turno 9: Diz que o orçamento está 'fechado', mas o cliente ainda não aceitou; é só a proposta do Adriano. Pode confundir.
- [baixa] (tom) turno 11: Repete quase igual o pedido de avisar quando responderem nos turnos 9, 11 e 13; fica um pouco insistente.
- [baixa] (nao_entendeu) turno 10: A fala do Adriano no turno 10 está invertida, como se ele fosse o assistente, mas o bot respondeu bem sem apontar a confusão.

<details><summary>Conversa</summary>

```
1. ADRIANO (áudio): e aí, dá pra fazer um orçamento novo? é a mesa de cabeceira do seu Abreu e da dona Isa, vou lixar e pintar de azul marinho. tá boa, só por fora, sem conserto nenhum
2. BOT: 🎧 Ouvi: "e aí, dá pra fazer um orçamento novo? é a…"
3. BOT: Anotado: mesa de cabeceira do Seu Abreu e Dona Isa, pintura lisa por fora, azul marinho, peça boa e sem conserto.

Pra eu calcular, qual o tamanho da mesa? Pode mandar as medidas em cm (altura, largura e fundura) ou dizer se é pequena, média ou grande. 📏
4. ADRIANO (áudio): Ah, é tamanho médio, não sei medir de cabeça não. Pode ser médio mesmo. Ela tá boa, só vou lixar e pintar, sem conserto. Acho que levo uns 3 a 5 dias de passagem, pincel mesmo. Não precisa buscar nem entregar, eles trazem e levam.
5. BOT: 🎧 Ouvi: "Ah, é tamanho médio, não sei medir de cabeça não.…"
6. BOT: Fiz as contas do criado-mudo do Seu Abreu e Dona Isa.

A sugestão é R$ 484,00.
Abaixo de R$ 389,78 você fica no prejuízo.
Material novo: cerca de R$ 211,00.
Umas 8 horas de trabalho.

Você concorda com esse valor ou quer dar um desconto ou acrescentar algo?
   [botões: 👍 Concordo | ➖ Dar desconto | ➕ Acrescentar]
7. ADRIANO: [tocou: 👍 Concordo]
8. BOT: [PDF enviado: Proposta-AP-2026-0001-v1.pdf]
9. BOT: Fechado em R$ 484,00 pro criado-mudo do Seu Abreu e Dona Isa. ✅

Mandei o PDF do orçamento. Quando o cliente responder, me avisa que eu anoto.
10. ADRIANO: Valeu, Adriano! Só uma coisa rápida: o cliente já confirmou o valor de vocês ou ainda vai falar com eles? Se ainda não, sem problema, fica como está.
11. BOT: Ainda não tenho resposta do Seu Abreu e da Dona Isa registrada. O orçamento já está fechado e o PDF já foi enviado, então fica aguardando.

Quando eles responderem, me fala se aceitaram ou não que eu anoto. 🪵
12. ADRIANO: Beleza, valeu. Ainda não falei com eles, vou passar o orçamento pro Seu Abreu e pra Dona Isa e depois te aviso se aceitaram. Por enquanto fica como tá.
13. BOT: Beleza, Adriano. Fica como está, com o orçamento do criado-mudo aguardando a resposta.

Quando o Seu Abreu e a Dona Isa responderem, me avisa se aceitaram que eu anoto. 🪵
```

</details>

## licele-cama — Cama queen da Dona Licele (medida do colchão é só referência)

Notas: entendimento 4 · naturalidade 4 · acessibilidade 3 · uma_pergunta_por_vez 2 · sem_invencao 4 · eficiencia 4 · conclusao 5 · 40s

- ✅ 1 serviço
- ✅ cama
- ✅ Dona Licele
- ✅ verniz

> O objetivo foi atingido: o valor foi apresentado, o Adriano concordou e o PDF saiu, com dados corretos no banco. Os pontos fracos são a repetição do porte e do conserto, mensagens com várias perguntas/pendências juntas e o bloco de preço denso e um pouco técnico. Não houve invenção relevante.

- [media] (uma_pergunta_por_vez) turno 9: Lista três pendências (porte, verniz por fora/dentro, conserto) e ainda faz outra pergunta ('Pode ser médio?'), com várias perguntas na mesma mensagem.
- [media] (pergunta_repetida) turno 9: Pergunta sobre o tamanho/porte de novo logo após ele dizer que é padrão e que não sabe a medida; também pergunta sobre conserto, sendo que ele já disse que são só riscos leves.
- [baixa] (jargao) turno 6: Pergunta por 'medidas da cama' e porte pequena/média/grande, o que pode confundir quem só sabe que é queen.
- [media] (jargao) turno 12: Usa 'você fica no prejuízo', 'material novo' e 'sugestão' em bloco denso com vários números; a mensagem fica longa e um pouco técnica.
- [baixa] (texto_longo) turno 12: Resumo e valores na mesma mensagem, com a pergunta final longa (concorda, desconto ou acrescentar).
- [baixa] (tom) turno 16: Termina com duas opções ('outro serviço ou seguir por aqui?') e 'Fechado' soa como confirmação com a cliente, embora o PDF só tenha sido enviado; a menção de avisar quando ela responder está correta.

<details><summary>Conversa</summary>

```
1. ADRIANO (áudio): E aí, tudo bem? Queria registrar um serviço aqui, é da dona Licele. Ainda não sei se consigo passar tudo agora, mas começo por ela.
2. BOT: 🎧 Ouvi: "E aí, tudo bem? Queria registrar um serviço aqui, é…"
3. BOT: Tudo bem, Adriano! Pode começar pela dona Licele, sem problema.

Qual é o móvel dela? Já me diga o que aparecer primeiro, e o resto você completa depois.
4. ADRIANO (áudio): Então, é uma cama queen. Vou lixar e envernizar ela inteira, cabeceira e peseira. Tem uns riscos, nada muito grave. Vai ser no pincel. Não precisa de frete.
5. BOT: 🎧 Ouvi: "Então, é uma cama queen. Vou lixar e envernizar ela…"
6. BOT: Anotado: cama queen da Dona Licele, lixar e envernizar inteira (cabeceira e peseira), pincel, riscos leves e sem frete.

Você tem as medidas da cama, ou prefere me dizer se é pequena, média ou grande?
7. ADRIANO (áudio): Não sei a medida exata da estrutura, só que é queen. Pode colocar como queen mesmo. Quanto ao tamanho, acho que é padrão, nada fora do comum.
8. BOT: 🎧 Ouvi: "Não sei a medida exata da estrutura, só que é…"
9. BOT: Anotado: cama queen padrão da Dona Licele, lixar e envernizar, pincel, riscos leves e sem frete.

Ainda faltam o porte (pode ser médio mesmo?), se o verniz é só por fora ou também por dentro da estrutura, e se precisa de algum conserto.

Pode ser médio?
10. ADRIANO (áudio): Pode colocar médio, sim. Verniz só por fora, na cabeceira e na peseira. Não precisa de conserto, só lixar e envernizar, nada de estrutura. Essa é a ideia.
11. BOT: 🎧 Ouvi: "Pode colocar médio, sim. Verniz só por fora, na cabeceira…"
12. BOT: Cama da Dona Licele, porte médio, verniz só por fora (cabeceira e peseira), sem conserto e sem frete.

Minha sugestão para o orçamento é R$ 417,00. Abaixo de R$ 342,00 você fica no prejuízo. O material novo sai por uns R$ 136,00, e o trabalho dá umas 6 horas.

Você concorda com R$ 417,00 ou quer dar um desconto ou acrescentar algo?
   [botões: 👍 Concordo | ➖ Dar desconto | ➕ Acrescentar]
13. ADRIANO (áudio): Ah, concordo com R$ 417,00 pra Dona Licele. Pode fechar esse valor, o pincel e sem frete mesmo.
14. BOT: 🎧 Ouvi: "Ah, concordo com R$ 417,00 pra Dona Licele. Pode fechar…"
15. BOT: [PDF enviado: Proposta-AP-2026-0001-v1.pdf]
16. BOT: Fechado: cama queen da Dona Licele por R$ 417,00, lixar e envernizar (cabeceira e peseira), no pincel, sem frete.

O PDF do orçamento já foi enviado. Quando a Dona Licele responder, me avise para eu registrar.

Quer começar outro serviço ou seguir por aqui?
```

</details>

## preco-material-solvente — Preço de material na hora do orçamento: 'duas latas por 150' e 'não uso solvente'

Notas: entendimento 5 · naturalidade 4 · acessibilidade 4 · uma_pergunta_por_vez 4 · sem_invencao 3 · eficiencia 4 · conclusao 5 · 39s

- ✅ verniz = R$ 75 por lata (150 ÷ 2)
- ✅ embalagem 900 ml
- ✅ solvente continua sem preço (não usa)
- ✅ solvente fora deste orçamento
- ✅ orçamento calculado

> Fluxo chegou ao orçamento e fechou com poucas trocas, entendendo bem os preços do verniz e a retirada do solvente. Falhas: afirmou ter calculado antes de ter os preços, perguntou sobre entrega que ele já tinha resolvido, o resumo do orçamento tem tom um pouco técnico e a frase do PDF pode sugerir que foi enviado à cliente.

- [media] (inventou) turno 5: Disse que 'já calculou' antes de ter os preços dos materiais, e o valor só apareceu depois. Também anunciou que perguntaria 'um de cada vez' mas só perguntou o verniz, e solvente nem era necessário.
- [media] (jargao) turno 8: Termos como 'Material novo' e 'Abaixo de R$ 190 você fica no prejuízo' são um pouco técnicos/duros; não mostra como chegou ao valor (ex.: 2 latas por 150) nem confirma que o solvente foi tirado.
- [baixa] (pergunta_multipla) turno 8: Pergunta final oferece três opções (concordo, desconto, acrescentar); aceitável pelos botões, mas é um pouco carregada.
- [media] (promessa_falsa) turno 11: Diz que o PDF 'já foi enviado' sem deixar claro que foi apenas gerado para ele, não ao cliente; pode induzir a achar que a Dona Ana já recebeu.
- [baixa] (pergunta_desnecessaria) turno 3: Perguntou sobre busca e entrega, embora ele já tivesse dito 'sem frete'; o Adriano precisou repetir.

<details><summary>Conversa</summary>

```
1. ADRIANO (áudio): E aí, tudo certo? Peguei uma mesa da dona Ana pra envernizar. Ela tá boa, só precisa por fora, sem conserto nenhum. O tampo tem 1 metro por 60 cm e a altura é 75. Vou fazer com pincel, sem frete. Anota aí pra mim.
2. BOT: 🎧 Ouvi: "E aí, tudo certo? Peguei uma mesa da dona Ana…"
3. BOT: Anotado: mesa da Dona Ana, só por fora, sem conserto, estado bom, verniz com pincel. Tampo de 1 m por 60 cm e altura de 75 cm.

Falta saber quem leva e traz a mesa. Você busca e entrega, ou ela traz e leva? 🪵
4. ADRIANO: Ela traz e leva, não precisa buscar. Sem frete mesmo.
5. BOT: Anotado: ela traz e leva, sem frete. A mesa está completa, e já calculei. Faltam só os preços de dois materiais, verniz e solvente, e vou perguntar um de cada vez.

Começando pelo verniz: quanto custou a lata e de quantos ml (ou litros) ela é? 🎨
6. ADRIANO (áudio): Verniz, comprei duas latas de 900 ml, deu 150 reais no total. Solvente eu não uso nesse trabalho, pode tirar.
7. BOT: 🎧 Ouvi: "Verniz, comprei duas latas de 900 ml, deu 150 reais…"
8. BOT: 🧮 Mesa da Dona Ana

Minha sugestão: R$ 236,00.
Abaixo de R$ 190,00 você fica no prejuízo.
Material novo: uns R$ 87,00.
Umas 4 horas de trabalho.

Você concorda com esse valor, quer dar um desconto ou acrescentar algo?
   [botões: 👍 Concordo | ➖ Dar desconto | ➕ Acrescentar]
9. ADRIANO: [tocou: 👍 Concordo]
10. BOT: [PDF enviado: Proposta-AP-2026-0001-v1.pdf]
11. BOT: Fechado! ✅ Orçamento da mesa da Dona Ana em R$ 236,00, e o PDF já foi enviado.

Quando a Dona Ana responder, me avisa se ela aceitou. 📄
```

</details>

## pagamento-gasto — Pagamento e gasto no dia a dia

Notas: entendimento 5 · naturalidade 4 · acessibilidade 4 · uma_pergunta_por_vez 4 · sem_invencao 5 · eficiencia 4 · conclusao 5 · 24s

- ✅ pagamento de R$ 200
- ✅ gasto de R$ 90

> Pagamento de R$ 200 e gasto de R$ 90 foram registrados corretamente e confirmados no banco, sem invenção de fatos. O fluxo foi curto e claro, com pequenos deslizes: "Anotado" antes de confirmar, oferta de fechar o orçamento repetida mesmo após recusa e frases um pouco burocráticas.

- [baixa] (tom) turno 3: Frase "Confirma no botão aqui embaixo para eu registrar" é um pouco burocrática; o bot diz "Vou anotar" e depois pede confirmação, o que soa levemente redundante.
- [baixa] (fluxo_confuso) turno 5: Ofereceu fechar o orçamento com pedido de medidas e estado da peça logo após registrar o pagamento, o que foi um pouco cedo; o Adriano recusou sem problema.
- [baixa] (texto_longo) turno 10: Repetiu o convite para passar medidas e estado da peça depois de ele já ter dito que não queria agora, quase insistindo na mesma oferta.
- [baixa] (tom) turno 8: Disse "Anotado" antes da confirmação no botão, o que sugere já registrado quando ainda não estava.

<details><summary>Conversa</summary>

```
1. ADRIANO (áudio): oi, tudo bem? então, a dona Maria pagou duzentos reais hoje da cristaleira, a entrada. anota aí pra mim
2. BOT: 🎧 Ouvi: "oi, tudo bem? então, a dona Maria pagou duzentos reais…"
3. BOT: Oi, tudo bem! 😄 Vou anotar o pagamento de R$ 200,00 da entrada da Dona Maria na cristaleira.

Confirma no botão aqui embaixo para eu registrar.
   [botões: ✅ Pode anotar | ✏️ Não]
4. ADRIANO: [tocou: ✅ Pode anotar]
5. BOT: Pagamento anotado: R$ 200,00 da Dona Maria, entrada da cristaleira. ✅

O orçamento dela ainda não foi fechado. Quer que a gente feche o valor agora? Se você me disser as medidas e o estado da peça, eu calculo.
6. ADRIANO (áudio): Não, agora não. Antes tenho outra coisa: hoje também gastei noventa reais de verniz numa loja. Anota aí essa despesa.
7. BOT: 🎧 Ouvi: "Não, agora não. Antes tenho outra coisa: hoje também gastei…"
8. BOT: Anotado: gasto de R$ 90,00 com verniz numa loja. Confirma no botão aqui embaixo para eu registrar.
   [botões: ✅ Pode anotar | ✏️ Não]
9. ADRIANO: [tocou: ✅ Pode anotar]
10. BOT: Gasto de R$ 90,00 com verniz anotado. ✅

A cristaleira da Dona Maria continua em orçamento, com os R$ 200,00 de entrada já registrados. Quando quiser retomar, me passa as medidas e o estado da peça.
11. ADRIANO (áudio): Beleza, então tá tudo anotado: os 200 da dona Maria e os 90 de verniz. Quando for fechar a cristaleira, eu te chamo. Valeu!
12. BOT: 🎧 Ouvi: "Beleza, então tá tudo anotado: os 200 da dona Maria…"
13. BOT: Beleza, Adriano! Ficou anotado: R$ 200,00 da Dona Maria e R$ 90,00 de verniz. 🎨

Quando for fechar a cristaleira, é só me chamar que a gente retoma as medidas e o estado da peça. Valeu!
```

</details>

## andamento-nao-andamento — Andamento: 'comecei' muda; 'quando ficar pronta ela busca' não muda

Notas: entendimento 4 · naturalidade 3 · acessibilidade 3 · uma_pergunta_por_vez 3 · sem_invencao 3 · eficiencia 2 · conclusao 5 · 58s

- ✅ serviço em execução (não concluído)

> O objetivo foi cumprido: o serviço ficou 'em execução' e o comentário sobre a Dona Maria buscar não marcou como pronto. Porém a conversa foi longa e repetitiva, insistiu em técnica e acabamento que ele já tinha adiado, usou texto comprido sobre botões e inventou 'sem frete' a partir de uma fala que não era sobre frete.

- [alta] (inventou) turno 3: Anotou 'sem frete, ela traz e busca' sem o Adriano ter dito isso naquele ponto; o 'ela vem buscar' foi sobre quando a peça ficar pronta, não sobre frete.
- [media] (texto_longo) turno 3: Mensagem longa que mistura explicação do botão, pedido de aviso sobre a técnica e uma pergunta. Ignora a saudação e não registra de forma natural que ele começou.
- [media] (fluxo_confuso) turno 3: Pede para tocar no botão para marcar que começou, mas o botão rotulado 'Pode anotar' aparece junto a perguntas sobre o estado da peça, o que confunde qual confirmação vale.
- [media] (fluxo_confuso) turno 8: Repete a instrução do botão de confirmação, com texto longo, e termina com pergunta aberta 'quer anotar mais alguma coisa' quando já havia pendências.
- [baixa] (tom) turno 10: Dá a confirmação sem notar que a pergunta sobre o tamanho estava pendente, e emenda nova pergunta; funciona, mas é cansativo.
- [media] (pergunta_repetida) turno 14: Pergunta a técnica de novo, apesar de ele já ter dito duas vezes que verá depois (turnos 1 e 6).
- [media] (pergunta_repetida) turno 17: Depois de ele dizer que não sabe a técnica, pergunta o método de aplicação (pincel/rolo/pistola), insistindo no tema que ele já adiou.
- [baixa] (tom) turno 20: 'Não vou pressionar' soa estranho e chama atenção para a pressão; repete o pedido das medidas pela terceira vez.
- [baixa] (perdeu_informacao) turno 23: O comentário de que ela vem buscar quando ficar pronta ficou só como 'sem frete' no turno 3; nunca é tratado como observação. Porém o status não foi alterado indevidamente.

<details><summary>Conversa</summary>

```
1. ADRIANO (áudio): E aí, tudo bem? Hoje comecei a lixar a cristaleira da dona Maria. Ainda não sei que técnica vou usar, depois eu vejo isso. Quando ficar pronta ela vem buscar.
2. BOT: 🎧 Ouvi: "E aí, tudo bem? Hoje comecei a lixar a cristaleira…"
3. BOT: Anotado: cristaleira da Dona Maria, sem frete, ela traz e busca. Pra marcar que você começou a lixar, tem um botão de confirmação aqui embaixo. Toque nele pra eu registrar.

Quando for ver a técnica, me conta. Por enquanto, como tá a peça: está boa, só com riscos, precisa de reparo ou tá bem estragada?
   [botões: ✅ Pode anotar | ✏️ Não]
4. ADRIANO: Tá boa, só com uns riscos. Não tem nada quebrado nem bicho. Pode anotar aí.
5. BOT: Anotado: cristaleira só com riscos, sem nada quebrado nem bicho.

Pra eu montar o orçamento depois, me fala o tamanho dela: altura, largura e profundidade em cm, ou se é pequena, média ou grande. 📏
   [botões: ✅ Pode anotar | ✏️ Não]
6. ADRIANO (áudio): Ah, o tamanho eu não sei de cabeça agora, depois eu meço e te falo. Mas anota aí que começou a lixar hoje, esse registro de começou a lixar pode marcar sim.
7. BOT: 🎧 Ouvi: "Ah, o tamanho eu não sei de cabeça agora, depois…"
8. BOT: Beleza, sem problema. Quando medir, me manda altura, largura e profundidade que eu anoto.

O registro de "começou a lixar" já está preparado. Falta só você tocar no botão de confirmação que apareceu aqui em cima. Se não aparecer, me avisa que eu preparo de novo. ✅

Enquanto isso, a técnica fica para depois. Quer que eu anote mais alguma coisa sobre a cristaleira?
   [botões: ✅ Pode anotar | ✏️ Não]
9. ADRIANO: [tocou: ✅ Pode anotar]
10. BOT: Confirmado: a cristaleira da Dona Maria está em execução. 🛠️

Quando você tiver as medidas, me manda. Enquanto isso, uma coisa que ajuda no orçamento: o trabalho é só por fora ou por dentro também?
11. ADRIANO: Ah, uma coisa só: por dentro também, mas só passei o lixa por fora por enquanto. Por dentro eu vejo depois quando for lixar.
12. BOT: Anotado: por dentro e por fora, e que por enquanto você só lixou por fora.

Quantas portas e quantas gavetas ela tem? 🪵
13. ADRIANO: Tem duas portas e três gavetas, mas as gavetas eu confiro quando medir a peça, ainda não contei direito. Pode anotar isso.
14. BOT: Anotado: 2 portas e 3 gavetas, com a observação de que você ainda vai conferir as gavetas ao medir.

Quando tiver as medidas, me manda. Enquanto isso, qual técnica você pensa em usar nela: patina, verniz, pintura lisa, decape ou outra? 🎨
15. ADRIANO (áudio): Ah, a técnica eu ainda não sei, depois eu vejo. Por enquanto só anota que ela tá em execução e que eu lixei só por fora. Quando eu medir eu te falo as medidas.
16. BOT: 🎧 Ouvi: "Ah, a técnica eu ainda não sei, depois eu vejo.…"
17. BOT: Anotado: cristaleira da Dona Maria em execução, lixada só por fora até agora, com o interior ainda por lixar. A técnica fica para depois.

Você costuma aplicar acabamento com pincel, rolo ou pistola? 🛠️
18. ADRIANO (áudio): Ah, o acabamento eu ainda não sei dizer, depende da peça. Por enquanto deixa anotado assim mesmo, depois eu vejo. Quando medir eu te mando as medidas.
19. BOT: 🎧 Ouvi: "Ah, o acabamento eu ainda não sei dizer, depende da…"
20. BOT: Beleza, deixo o acabamento em aberto. Não vou pressionar.

Quando medir, me manda altura, largura e profundidade da cristaleira, e confere as gavetas nessa hora. 📏
21. ADRIANO (áudio): Beleza, tá anotado tudo. Quando eu medir eu te mando, e aí eu confiro as gavetas também. Valeu!
22. BOT: 🎧 Ouvi: "Beleza, tá anotado tudo. Quando eu medir eu te mando,…"
23. BOT: De nada, Adriano! 😄 Fica anotado: cristaleira da Dona Maria em execução, só lixada por fora, com as medidas e a conferência das gavetas pendentes. Quando medir, é só mandar.
```

</details>

## fora-do-roteiro — Fora do roteiro: oi, teste de áudio, conversa social e recomeçar

Notas: entendimento 3 · naturalidade 3 · acessibilidade 3 · uma_pergunta_por_vez 3 · sem_invencao 3 · eficiencia 2 · conclusao 4 · 97s

- ✅ o serviço da cadeira foi cancelado ao recomeçar

> O bot lidou bem com oi, teste de áudio e recomeço (cancelou a cadeira, confirmado no banco) e retomou a mesinha da Dona Ana sem perder detalhes principais. Mas teve confirmação dupla do cancelamento, frase confusa no turno 5, perguntas já respondidas (estado, parte de dentro) e um orçamento que pede custo de transporte depois de ter anotado 'sem frete'.

- [media] (tom) turno 5: Frase confusa e interna: 'Não deixei a pergunta da tinta como observação, porque foi minha, não sua'. Vaza lógica do sistema e não faz sentido para o Adriano.
- [media] (perdeu_informacao) turno 8: Ao recomeçar, ignorou a pergunta social e a informação sobre a madeira (já dada); resposta ao 'tá me ouvindo' foi ok, mas a confirmação do cancelamento foi montada sem esclarecer que ele errou a peça.
- [alta] (fluxo_confuso) turno 10: Pediu confirmação duas vezes: Adriano disse 'Confirmar' e o bot pediu de novo no botão. Os botões 'Pode anotar' / 'Não' não combinam com cancelar.
- [media] (fluxo_confuso) turno 8: 'Confirma no botão que aparecer' é texto burocrático e o botão só aparece depois, no turno 10.
- [media] (pergunta_repetida) turno 30: Perguntou sobre o interior da mesinha depois de ele já ter dito que era só o tampo (turno 22), perguntando o que já foi dito.
- [baixa] (nao_entendeu) turno 18: Perguntou o estado da mesa depois de ele já ter dito no turno 13 que o verniz estava craquelado e a madeira firme.
- [baixa] (tom) turno 27: 'Vou guardar a marca do verniz pra quando você confirmar' é meio estranho: ele disse que passa a marca depois.
- [media] (jargao) turno 32: Mensagem com várias linhas de números e 'Abaixo de R$ 94,14 você fica no prejuízo' soa técnico. Pergunta do frete contradiz o turno 30 ('sem frete'), pois o bot pede custo de transporte.
- [baixa] (eficiencia) turno 32: Conversa longa, com muitas perguntas, para um caso que era só testar o recomeçar.

<details><summary>Conversa</summary>

```
1. ADRIANO: oi
2. BOT: Oi, Adriano! Tudo certo por aqui. 🎨

Quando quiser começar um orçamento, me conta a peça: qual móvel é, de quem é, e o que vai ser feito nela.

Pode mandar por áudio mesmo, que eu organizo tudo.
3. ADRIANO (áudio): Opa, tudo bem! Tô testando esse bot aqui, vê se ele entende áudio. Bora começar um orçamento: é uma cadeira do seu João pra pintar, a cadeira de madeira da sala, ela tá com a pintura toda descascando.
4. BOT: 🎧 Ouvi: "Opa, tudo bem! Tô testando esse bot aqui, vê se…"
5. BOT: Anotado: cadeira de madeira do Seu João, pintura toda descascando. Não deixei a pergunta da tinta como observação, porque foi minha, não sua.

Pra eu montar o orçamento, me diz: a madeira está firme, só com a pintura solta, ou tem alguma parte quebrada, mole ou com cupim? 🪵
6. ADRIANO (áudio): Firme, a madeira tá firme. Só a pintura que tá soltando, sem parte quebrada nem mole. Cupim não vi. Ah, e antes de continuar, deixa eu testar uma coisa: tá me ouvindo bem? Se der, me responde que o bot tá ok. Mas peraí, esquece, quero começar de novo esse orçamento, errei a peça.
7. BOT: 🎧 Ouvi: "Firme, a madeira tá firme. Só a pintura que tá…"
8. BOT: Recebi certinho, tô te ouvindo bem. 🎧

Vou preparar o cancelamento da cadeira do Seu João pra você começar de novo. Confirma no botão que aparecer.
9. ADRIANO: Confirmar
10. BOT: Pronto, o cancelamento da cadeira do Seu João está preparado. Confirma no botão que aparecer, e aí a gente começa o orçamento da peça certa do zero.
   [botões: ✅ Pode anotar | ✏️ Não]
11. ADRIANO: [tocou: ✅ Pode anotar]
12. BOT: Cancelado, a cadeira do Seu João ficou no histórico. ✅

Agora é só mandar a peça certa: qual móvel é, de quem é, e o que vai ser feito nela.
13. ADRIANO (áudio): Beleza, então é isso. A peça certa é a mesinha de centro da sala da dona Ana, pra restaurar. Tá com o verniz todo craquelado, a madeira tá firme, sem parte mole nem cupim. Quero fazer só lixar e envernizar de novo, não precisa pintar.
14. BOT: 🎧 Ouvi: "Beleza, então é isso. A peça certa é a mesinha…"
15. BOT: Anotado: mesinha de centro da Dona Ana, lixar e envernizar de novo, sem pintura. A madeira está firme e sem cupim.

Qual o tamanho dela? Pode ser em medidas (comprimento, largura e altura em cm) ou pequena, média ou grande. 📏
16. ADRIANO (áudio): Ela é pequena, uns 60 por 60 de tampo e uns 45 de altura. Tá bom assim pra você montar o orçamento? Se precisar de mais medida eu te passo depois.
17. BOT: 🎧 Ouvi: "Ela é pequena, uns 60 por 60 de tampo e…"
18. BOT: Anotado: 60 por 60 cm de tampo e 45 cm de altura. Como é uma mesa de centro, eu uso as medidas do tampo.

Agora me diz o estado: ela está boa, só com verniz gasto e riscos? Ou precisa de reparos antes, tipo colar ou acertar algum detalhe? 🛠️
19. ADRIANO (áudio): Ela tá boa, só o verniz craquelado e uns riscos. Sem colar nada, sem parte solta. Pode seguir assim.
20. BOT: 🎧 Ouvi: "Ela tá boa, só o verniz craquelado e uns riscos.…"
21. BOT: Anotado: verniz craquelado e riscos, sem colar e sem parte solta. Estado bom.

Você vai lixar e envernizar a mesinha inteira, ou só o tampo? 🪵
22. ADRIANO (áudio): Só o tampo, o resto da mesinha tá bom. Pode ser só o tampo mesmo.
23. BOT: 🎧 Ouvi: "Só o tampo, o resto da mesinha tá bom. Pode…"
24. BOT: Anotado: só o tampo, lixar e envernizar de novo.

Pra envernizar esse tampo, você usa pincel, rolo ou pistola? 🎨
25. ADRIANO (áudio): Pincel, acho. Passo fino, eu gosto de fazer na mão. Tenho que ver ainda se vou usar o verniz que trnho aqui, depois eu passo a marca.
26. BOT: 🎧 Ouvi: "Pincel, acho. Passo fino, eu gosto de fazer na mão.…"
27. BOT: Anotado: pincel, passo fino na mão. Vou guardar a marca do verniz pra quando você confirmar.

Agora, quem leva e traz a mesinha? Você busca na casa da Dona Ana e entrega, ou ela traz e leva? 🚚
28. ADRIANO (áudio): Ah, eu busco e entrego lá na casa da dona Ana. Ela não precisa se preocupar com nada. Pode anotar aí que sou eu que levo e trago.
29. BOT: 🎧 Ouvi: "Ah, eu busco e entrego lá na casa da dona…"
30. BOT: Anotado: você busca e entrega na casa da Dona Ana, sem frete.

Falta uma coisa: a mesinha tem parte de dentro que também precisa de verniz, ou é só por fora? 🪵
31. ADRIANO: Só o tampo mesmo, por fora. Tá certo, pode anotar.
32. BOT: A conta da mesinha da Dona Ana ficou assim:

Sugestão: R$ 118,00
Abaixo de R$ 94,14 você fica no prejuízo.
Material que você usa: uns R$ 14,25.
Umas 2 horas de trabalho.

Você vai buscar e levar a mesinha, então falta o custo do transporte. Quanto você gasta com isso? Com esse valor eu refaço a conta. 🚚
   [botões: 👍 Concordo | ➖ Dar desconto | ➕ Acrescentar]
```

</details>

## correcoes — Correções do jeito dele no meio do orçamento

Notas: entendimento 5 · naturalidade 4 · acessibilidade 3 · uma_pergunta_por_vez 4 · sem_invencao 4 · eficiencia 5 · conclusao 5 · 33s

- ✅ 1 serviço
- ✅ cliente corrigida para Dona Bia
- ✅ método corrigido para rolo
- ✅ cor branca anotada

> Conversa eficiente: o bot pegou todas as correções (cliente Dona Bia, rolo, medidas, sem frete), fechou em R$ 308 e atendeu o pedido de confirmação. O ponto fraco é a mensagem do valor, carregada e com duas perguntas, e a pergunta sobre frete que ele já tinha respondido. Objetivo atingido.

- [media] (jargao) turno 9: A mensagem do valor mistura 'prejuízo', material, horas e a pergunta de desconto/acréscimo. Fica carregada para quem prefere conversa simples. Tem duas perguntas juntas: concorda e quer desconto ou acréscimo.
- [baixa] (texto_longo) turno 9: Várias informações numéricas de uma vez (piso, material, horas), sem explicação curta.
- [baixa] (pergunta_redundante) turno 6: Perguntou quem leva e traz a cômoda mesmo ele já ter dito 'sem frete' no turno 4. Poderia ter confirmado em vez de perguntar.
- [baixa] (tom) turno 12: Fala que 'o PDF já foi enviado' e 'quando a Dona Bia responder, me avisa'. O PDF foi gerado, mas o envio à cliente é dúvida. Depois emenda outra pergunta sobre a compra da tinta, o que é um pouco apressado.

<details><summary>Conversa</summary>

```
1. ADRIANO (áudio): Fala, tudo bem? Peguei uma cômoda pra pintar de branco, é da dona Ana. Quero fazer o orçamento.
2. BOT: 🎧 Ouvi: "Fala, tudo bem? Peguei uma cômoda pra pintar de branco,…"
3. BOT: Anotado: cômoda da Dona Ana, pintura de branco. 🎨

Como está o estado da peça? Ela está boa (só com riscos), precisa de reparos ou está bem danificada?
4. ADRIANO (áudio): Tá boa, sem conserto. Só por fora. Na verdade a cliente é a dona Bia, não a Ana, foi engano meu. A cômoda tem 90 de altura, 1 metro de largura e 45 de fundura. Pintura branca mesmo, vou fazer com rolo, errei antes quando falei pincel. Sem frete.
5. BOT: 🎧 Ouvi: "Tá boa, sem conserto. Só por fora. Na verdade a…"
6. BOT: Anotado: cômoda da Dona Bia, pintura branca com rolo, só por fora, sem conserto, 90 x 100 x 45 cm. Corrigi o nome e o método. 🎨

Falta saber quem leva e traz a cômoda. Ela vai até você ou você busca e entrega?
7. ADRIANO (áudio): Ela que traz e leva lá na oficina, sem frete mesmo. Pode anotar que não tem busca nem entrega.
8. BOT: 🎧 Ouvi: "Ela que traz e leva lá na oficina, sem frete…"
9. BOT: Você concorda com R$ 308,00 para a cômoda da Dona Bia? Abaixo de R$ 248,01 você fica no prejuízo. Material novo: uns R$ 205,00. Trabalho: umas 5 horas. Quer dar um desconto ou acrescentar algo?
   [botões: 👍 Concordo | ➖ Dar desconto | ➕ Acrescentar]
10. ADRIANO: Ah, então tá. Pode fechar esse valor aí, tá bom pra mim. Só confirma que é mesmo da Dona Bia e que ela traz e leva na oficina.
11. BOT: [PDF enviado: Proposta-AP-2026-0001-v1.pdf]
12. BOT: Confirmo sim: a cômoda é da Dona Bia, e ela traz e leva na oficina, sem frete. ✅

Orçamento fechado em R$ 308,00 e o PDF já foi enviado. Quando a Dona Bia responder, me avisa que eu registro.

Quer já anotar a compra da tinta branca ou o gasto com o material?
13. ADRIANO: Beleza, então tá fechado. Não precisa anotar a tinta agora não, depois eu te falo quando comprar. Valeu!
14. BOT: Beleza, Adriano! Quando comprar a tinta, me fala que eu anoto. Bom trabalho na cômoda da Dona Bia! 🎨
```

</details>

## decisao-valor — Decisão do valor: desconto abaixo do mínimo e depois acréscimo de frete

Notas: entendimento 4 · naturalidade 4 · acessibilidade 3 · uma_pergunta_por_vez 4 · sem_invencao 5 · eficiencia 4 · conclusao 5 · 55s

- ✅ PDF gerado
- ✅ orçamento fechado

> Conversa chegou ao objetivo: orçamento fechado em R$ 560 (500 + 60 de frete) com PDF enviado, sem inventar nada. Pontos fracos: confirmou de novo o frete que o Adriano já tinha dito que entrava na conta, e a mensagem de valores é um pouco técnica. No geral, bom atendimento e eficiente.

- [baixa] (nao_entendeu) turno 14: O Adriano disse 'desconto de metade' e '250', e o bot só avisou que ficava abaixo do mínimo sem esclarecer que metade de 500 dá 250; funcionou, mas faltou confirmar a leitura.
- [media] (jargao) turno 9: Usa 'Sugestão', 'prejuízo' e 'material novo' em bloco denso de números com negrito markdown; um pouco técnico e longo para quem fala por áudio.
- [media] (pergunta_repetida) turno 17: Perguntou se o frete estava incluso, sendo que o Adriano já tinha dito que o frete era de 60 reais e 'pode botar na conta' (turno 7); era perguntar o que ele já falou. Além disso, ele já havia dito 'por cima'.
- [baixa] (tom) turno 14: Fala de 'prejuízo' e 'mínimo' de forma seca; poderia ser mais de parceiro de oficina.
- [baixa] (texto_longo) turno 3: Os resumos 'Anotado' e as mensagens 'Ouvi' extras criam muitas mensagens por turno, enchendo o chat.

<details><summary>Conversa</summary>

```
1. ADRIANO (áudio): e aí, tudo bem? Tenho um aparador do Seu Luiz pra envernizar. Ele tá bom, só precisa de verniz mesmo. Tem 1,20 de largura, 40 de fundura e 80 de altura. Inteiro, sem conserto nenhum. Aplico com pincel. Quero ver quanto fica pra fazer o orçamento.
2. BOT: 🎧 Ouvi: "e aí, tudo bem? Tenho um aparador do Seu Luiz…"
3. BOT: Anotado: aparador do Seu Luiz, 120 × 40 × 80 cm, só verniz, peça boa, sem conserto, com pincel.

Antes de calcular, me diz: é só por fora ou tem que envernizar por dentro também (portas, gavetas, interior)?
4. ADRIANO (áudio): Por dentro também, é tudo verniz: as portas e o interior. Não tem gaveta. Pode contar tudo como interior mesmo.
5. BOT: 🎧 Ouvi: "Por dentro também, é tudo verniz: as portas e o…"
6. BOT: Anotado: verniz por dentro e por fora, sem gavetas.

Falta só saber o transporte: você busca a peça na casa do Seu Luiz e entrega depois, ou ele traz para a oficina?
7. ADRIANO (áudio): Eu que busco na casa do Seu Luiz e depois entrego pra ele. Esse frete é 60 reais, pode botar na conta.
8. BOT: 🎧 Ouvi: "Eu que busco na casa do Seu Luiz e depois…"
9. BOT: Pronto, fiz as contas do aparador do Seu Luiz:

💰 Sugestão: **R$ 500,00**
⚠️ Abaixo de **R$ 421,18** você fica no prejuízo.
🛒 Material novo: uns R$ 139,00.
⏱️ Umas 7 horas de trabalho.

Você concorda com esse valor, ou quer dar um desconto ou acrescentar algo?
   [botões: 👍 Concordo | ➖ Dar desconto | ➕ Acrescentar]
10. ADRIANO: [tocou: ➖ Dar desconto]
11. BOT: Beleza, desconto no aparador do Seu Luiz. Quanto você quer dar: uma porcentagem, um valor em reais, ou um valor final pro total?
12. ADRIANO (áudio): Quero dar um desconto de metade. Fica em 250 reais então, né?
13. BOT: 🎧 Ouvi: "Quero dar um desconto de metade. Fica em 250 reais…"
14. BOT: Esse valor de R$ 250 fica abaixo do mínimo, então você teria prejuízo nesse aparador.

Quer fechar em outro valor mais perto do mínimo, ou prefere manter R$ 250 mesmo sabendo disso?
15. ADRIANO (áudio): Ah, rapaz, então não dá pra cair tanto. Deixa o valor onde tá, com o frete de 60 reais por cima. Pode botar pra fechar assim, eu aceito o que der de mínimo, não quero ficar no prejuízo.
16. BOT: 🎧 Ouvi: "Ah, rapaz, então não dá pra cair tanto. Deixa o…"
17. BOT: Entendi que você quer voltar ao valor da sugestão, e não ao de R$ 250. Antes de fechar, me confirma: o valor da sugestão já inclui o frete, ou o frete de 60 reais vai por cima dele?

Assim que você responder, eu fecho o orçamento do aparador do Seu Luiz.
18. ADRIANO (áudio): Por cima, o frete de 60 reais vai por cima dos 500. Pode fechar assim: 560 no total, eu aceito.
19. BOT: 🎧 Ouvi: "Por cima, o frete de 60 reais vai por cima…"
20. BOT: Conta feita: R$ 500,00 da sugestão + R$ 60,00 de frete = **R$ 560,00**, acima do mínimo de R$ 421,18.

Posso fechar o orçamento do aparador do Seu Luiz em R$ 560,00 e mandar o PDF?
21. ADRIANO: 👍 Concordo
22. BOT: [PDF enviado: Proposta-AP-2026-0001-v1.pdf]
23. BOT: Fechado: aparador do Seu Luiz por **R$ 560,00** (R$ 500,00 + R$ 60,00 de frete). ✅

O PDF do orçamento já foi enviado. Quando o Seu Luiz responder, me avisa que eu anoto se ele aceitou.
```

</details>

## consulta — Consultas: quais serviços eu tenho e quanto falta receber

Notas: entendimento 3 · naturalidade 2 · acessibilidade 3 · uma_pergunta_por_vez 3 · sem_invencao 3 · eficiencia 2 · conclusao 2 · 74s


> O bot listou os serviços logo, mas falhou no pedido principal: dizer quanto a Dona Maria deve. Ficou repetindo que o sistema não mostra o valor, contradizendo-se, e a última mensagem saiu cortada. Misturou a consulta com perguntas do orçamento da mesa e não respondeu ao pedido final de tempo e situação de cada serviço. Objetivo não atingido de forma clara.

- [media] (fluxo_confuso) turno 3: Respondeu a lista mas puxou pergunta sobre o estado da cristaleira, misturando consulta com orçamento. Disse que não há valor total para ela dever.
- [alta] (nao_entendeu) turno 15: Adriano perguntou duas vezes quanto Dona Maria deve (R$ 799 fechado, nada pago). O bot não deu a resposta direta, disse que o acompanhamento não mostra o valor.
- [alta] (inconsistencia) turno 18: Disse que ela deve R$ 799 mas que o sistema não mostra, confuso e contraditório. Repetiu a mesma explicação em vários turnos.
- [media] (pergunta_repetida) turno 21: Continuou fazendo perguntas da mesa (por fora/dentro, pincel) sem que ele tivesse pedido, e ignorou a sua pergunta de fundo.
- [media] (inventou) turno 21: Anotou 'não precisa de conserto' e 'dentro fica como está' sem ter sido dito exatamente assim (ele só disse que dentro não precisa de verniz).
- [alta] (texto_longo) turno 24: Mensagem final cortada no meio da frase e ainda dizendo que o total aparece como zero, sem resolver o pedido. Não respondeu o tempo que leva a mesa nem a situação de cada serviço.
- [baixa] (tom) turno 12: Chamou a mesa de 'dela' e perguntou se ele já tinha as informações sendo que a mesa é do Seu João.
- [baixa] (jargao) turno 6: Usou termos como 'em orçamento' e 'acompanhamento' que soam burocráticos.

<details><summary>Conversa</summary>

```
1. ADRIANO (áudio): Fala, tudo bem? Me diz aí quais serviços eu tenho anotados agora. Tô com a cabeça meio cheia, então quero ver a lista certinha. E me fala também quanto a dona Maria ainda deve, porque ela não pagou nada até agora.
2. BOT: 🎧 Ouvi: "Fala, tudo bem? Me diz aí quais serviços eu tenho…"
3. BOT: Você tem 2 serviços anotados, os dois ainda em orçamento:

1. **S-0001: Cristaleira da Dona Maria**, com pátina
2. **S-0002: Mesa do Seu João**, com verniz

Sobre a Dona Maria: ela ainda não pagou nada (R$ 0,00), mas o orçamento da cristaleira não foi fechado, então ainda não existe um valor total para ela dever.

Para fechar o orçamento da cristaleira, falta saber em que estado ela está (boa, com reparos ou danificada).
4. ADRIANO (áudio): Beleza, valeu. Então tá certo, são essas duas. A cristaleira da dona Maria tá em bom estado, só precisa de pátina, não tem reparo nenhum. A mesa do seu João é só o verniz mesmo. Pode fechar o orçamento da cristaleira com isso aí.
5. BOT: 🎧 Ouvi: "Beleza, valeu. Então tá certo, são essas duas. A cristaleira…"
6. BOT: Anotado: a cristaleira da Dona Maria está em bom estado, sem conserto, só com pátina. E a mesa do Seu João é só verniz.

Ainda não dá para fechar o orçamento da cristaleira, porque faltam algumas informações: tamanho, se é só por fora ou por dentro também, se pinta com pincel, rolo ou pistola, e quem leva e traz a peça.

Qual é o tamanho da cristaleira? Pode ser em medidas (altura, largura, fundura) ou pequena, média ou grande. 📏
7. ADRIANO (áudio): Ah, a cristaleira é média, uns 1,80 de altura, 1,20 de largura e 40 de fundura. Pátina só por fora, a parte de dentro é madeira crua mesmo, não precisa mexer. Pincel. Quem leva e traz sou eu mesmo, então não precisa colocar frete.
8. BOT: 🎧 Ouvi: "Ah, a cristaleira é média, uns 1,80 de altura, 1,20…"
9. BOT: Anotado: cristaleira média, 1,80 × 1,20 × 0,40 m, só a parte de fora com pátina, no pincel. Você busca e entrega, então não entrou frete.

Fiz as contas da cristaleira da Dona Maria:

**Sugestão: R$ 799,00**
Abaixo de R$ 649,21 você fica no prejuízo.
Material novo: uns R$ 207,00.
Umas 13 horas de trabalho.

Você concorda com esse valor, quer dar um desconto ou acrescentar algo?
   [botões: 👍 Concordo | ➖ Dar desconto | ➕ Acrescentar]
10. ADRIANO: [tocou: 👍 Concordo]
11. BOT: [PDF enviado: Proposta-AP-2026-0001-v1.pdf]
12. BOT: Orçamento fechado: cristaleira da Dona Maria por R$ 799,00. ✅

O PDF já foi enviado. Quando a Dona Maria responder, me avisa se ela aceitou.

E a mesa do Seu João, você já tem as informações dela? Se ainda não, me conta o tamanho dela para eu seguir daí. 🪵
13. ADRIANO (áudio): Beleza, valeu! Então a Dona Maria tá com o orçamento fechado, né? Mas ela ainda não pagou nada, então quero saber quanto ela deve agora. E a mesa do Seu João, ainda não tenho as medidas dela, mas é só verniz mesmo, tá? Ela é pequena, uns 1,20 por 80, mais ou menos. Pode anotar aí.
14. BOT: 🎧 Ouvi: "Beleza, valeu! Então a Dona Maria tá com o orçamento…"
15. BOT: Anotado: a mesa do Seu João é só verniz, pequena, com medidas aproximadas de 1,20 por 80. Deixei as medidas como observação, porque ainda não estão confirmadas.

Sobre a Dona Maria: ela ainda não pagou nada. O orçamento da cristaleira já está fechado, mas o acompanhamento ainda não mostra o valor a pagar. Quando ela pagar, eu registro.

Para fechar o orçamento da mesa, falta saber o estado dela: está boa, só com riscos, precisa de reparos (colar, massa, acertar detalhes) ou está danificada? 🪵
16. ADRIANO (áudio): Então, a Dona Maria tá com o orçamento fechado em 799, né? Mas ela ainda não pagou nada, quero saber quanto ela deve agora. E a mesa do Seu João, tá boa, só riscada na superfície, não precisa de reparo nenhum. Só o verniz mesmo. Pode anotar aí.
17. BOT: 🎧 Ouvi: "Então, a Dona Maria tá com o orçamento fechado em…"
18. BOT: Anotado: a mesa do Seu João está em bom estado, só com riscos na superfície, sem reparo. Só verniz.

Sobre a Dona Maria: ela ainda não pagou nada (R$ 0,00). O orçamento fechado foi de R$ 799,00, então é esse o valor que ela deve. O acompanhamento ainda não mostra esse total, mas o valor que fechamos está certo. Quando ela pagar, eu registro.

Para fechar a mesa, falta saber se o verniz é só por fora ou também por dentro. 🪵
19. ADRIANO (áudio): Beleza, então a Dona Maria deve os 799 reais, né? Só não tá registrado aí no acompanhamento. E da mesa, é só verniz por fora mesmo, a parte de dentro não precisa.
20. BOT: 🎧 Ouvi: "Beleza, então a Dona Maria deve os 799 reais, né?…"
21. BOT: Anotado: a mesa do Seu João leva verniz só por fora, e a parte de dentro fica como está. Também anotei que não precisa de conserto.

Sobre a Dona Maria: o orçamento fechado foi de R$ 799,00 e ela ainda não pagou nada, então ela deve os R$ 799,00. O acompanhamento ainda não mostra esse valor registrado, mas o número é esse. Quando ela pagar, me fala o valor e eu registro.

Para fechar a mesa, falta saber como vai ser a aplicação do verniz: pincel, rolo ou pistola? 🛠️
22. ADRIANO (áudio): Isso, a Dona Maria deve os 799 reais. Ela ainda não pagou nada. E a mesa do Seu João, o verniz é no pincel mesmo, tá? Pode anotar aí. Depois me diz quanto tempo leva e se tem mais alguma coisa que você quer saber da lista de serviços, tipo a situação de cada um.
23. BOT: 🎧 Ouvi: "Isso, a Dona Maria deve os 799 reais. Ela ainda…"
24. BOT: Anotado: a mesa do Seu João leva verniz no pincel, só por fora, e a superfície está boa, só com riscos.

Sobre a Dona Maria: ela ainda não pagou nada. O sistema ainda não mostra o valor fechado da cristaleira (R$ 799,00), então o total que ela deve aparece como zero até o valor ser registrado. Quando ela pagar, me fala o valor que eu registro.

Para fechar o orçamento da mesa, falta só saber quem leva e traz a peça. Você busca e entrega, ou o cliente traz e leva? Assim que souber, eu calculo o tempo de trabalho e o valor. 🪵
```

</details>
