import { getFayzSupabaseClientOptional } from '@fayz-ai/saas'
import {
  createFayzConnectorCredentialSink,
  createFayzConnectorOAuthStarter,
  createFayzRuntimeTokenSource,
  setConnectorCredentialSink,
  setConnectorOAuthStarter,
} from '@fayz-ai/sdk'

/**
 * As duas portas por onde uma credencial de conector sai deste app — e por que
 * este arquivo faltava.
 *
 * Sem ele, todo conector do beauty recusava com "este app não está ligado a um
 * projeto Fayz", o que era enganoso: o app SEMPRE esteve ligado a um projeto na
 * plataforma. O que faltava era o bundle registrar as portas. `VITE_FAYZ_PROJECT_ID`
 * já estava no `.env`; ninguém o lia.
 *
 * O hub de integrações separa o formulário em duas metades: o que é
 * configuração vai para a linha do app, e o que é credencial — todo campo
 * `type: 'password'` — vai para o sink, nunca para o código do conector. Sem
 * sink instalado o botão Conectar recusa, de propósito: é a única forma segura
 * de um app que não tem onde guardar segredo se comportar.
 *
 * A credencial fica cifrada no Fayz, não no pool desta clínica. O pool guarda
 * só "está ligado?" (`plg_connections`); quem responde "com qual chave" é a
 * plataforma. É o que permite revogar em um lugar só e o que faz `select *` na
 * tabela da clínica não devolver token nenhum — a lição que o Google Calendar
 * e o PlugBank custaram caro para ensinar.
 */

const projectId = import.meta.env.VITE_FAYZ_PROJECT_ID
const baseUrl = import.meta.env.VITE_FAYZ_API_BASE_URL

if (projectId) {
  // Um só, compartilhado pelas duas portas: a que guarda a credencial digitada
  // e a que abre o consentimento no provedor. Duas fontes de token seriam duas
  // sessões para o mesmo lojista.
  const runtimeToken = createFayzRuntimeTokenSource({
    projectId,
    baseUrl,
    // Getter, e não o cliente: ele só existe depois que o app monta o
    // backend, que acontece bem depois deste módulo carregar.
    supabase: getFayzSupabaseClientOptional,
  })

  setConnectorCredentialSink(
    createFayzConnectorCredentialSink({ projectId, baseUrl, runtimeToken }),
  )

  /**
   * O outro caminho: o conector que é OAuth não pede chave nenhuma a quem
   * instala. O botão Conectar sai daqui para a tela do próprio provedor e volta
   * com a autorização feita — a credencial nunca passa pelo navegador dele.
   *
   * Instalar nada aqui também é uma resposta: o botão recusa em vez de abrir um
   * consentimento que ninguém saberia concluir.
   */
  setConnectorOAuthStarter(
    createFayzConnectorOAuthStarter({ projectId, baseUrl, runtimeToken }),
  )
}
