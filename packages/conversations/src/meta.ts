import { normalizeText } from "@adripatina/shared";

/**
 * Falas "fora do roteiro" que não respondem pergunta nenhuma e não são assunto novo:
 * recomeçar, testar o áudio, conversa social. Vistas no teste real de 23/11/2026:
 * "quero começar de novo" (ignorado), "queria testar o envio de áudio" ("não entendi"),
 * "e aí, vc tá bem?" (bot respondeu "Quer que eu calcule o orçamento?").
 */
export type MetaTurn = "restart" | "audio_test" | "small_talk" | "thanks";

const RESTART = /\b(comecar|recomecar)\b.{0,12}\b(de novo|do zero|do comeco|outra vez|novamente|tudo)\b|\brecomec\w*|\breinici\w*|\bzerar\b|\bcomecar do zero\b/;
// "chegou/chegando/funciona" sozinhos são comuns em pedido real ("chegou uma cômoda da Dona Marta"):
// só contam como teste junto de palavra de áudio ("o áudio tá chegando?")
const AUDIO_TEST_STRONG = /\b(test\w*|ouvindo|me ouve|da pra ouvir|consegue ouvir|ta escutando|esta escutando|me escuta)\b/;
const AUDIO_TEST_WEAK = /\b(funcionando|funciona|chegando|chegou|chega)\b/;
const AUDIO_WORDS = /\b(audio|audios|voz|mensagem de voz|gravar|gravacao|ouvindo|me ouve|ouvir)\b/;
const SMALL_TALK = /^(?:(?:e ai|oi|ola|opa|eai|bom dia|boa tarde|boa noite|fala)\b[\s,!]*)?(?:(?:tudo|td) (?:bem|bom|certo|tranquilo|joia|beleza)|(?:vc|voce|ce) (?:ta|esta|tá) (?:bem|bom|ai)|como (?:vai|voce esta|vc ta|ce ta)|beleza|suave)\b[\s?!.]*(?:com voce|e voce|e vc|ai)?[\s?!.]*$/;
const THANKS = /^(?:(?:muito|mt) )?(?:obrigad[oa]|brigad[oa]|valeu|vlw|grato|grata)(?: (?:viu|mesmo|amigo|ai))*[\s!.]*$/;

export function detectMeta(text: string, opts: { voice?: boolean } = {}): MetaTurn | null {
  const n = normalizeText(text).replace(/[^\p{L}\p{N}\s?!.,]/gu, " ").replace(/\s+/g, " ").trim();
  if (!n) return null;
  const words = n.split(" ").length;
  if (words <= 12 && RESTART.test(n)) return "restart";
  // teste de áudio: por voz, ou falando de áudio explicitamente ("testando o áudio")
  const talksAudio = AUDIO_WORDS.test(n);
  if (words <= 25 && talksAudio && (AUDIO_TEST_STRONG.test(n) || AUDIO_TEST_WEAK.test(n))) return "audio_test";
  if (opts.voice && words <= 10 && AUDIO_TEST_STRONG.test(n)) return "audio_test";
  if (words <= 8 && THANKS.test(n)) return "thanks";
  if (words <= 9 && SMALL_TALK.test(n)) return "small_talk";
  return null;
}
