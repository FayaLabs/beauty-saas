import React from 'react'
import { PersonTimeline, type EntityDef } from '@fayz-ai/saas'

// ---------------------------------------------------------------------------
// A linha do tempo do cliente.
//
// Esta aba tinha 220 linhas: duas consultas escritas à mão (v_appointments e
// plg_crm_activities), o desenho do trilho, e um merge que perdia evento — 12
// por fonte, cortado em 20, então com 30 agendamentos nenhuma interação de CRM
// aparecia, nem a de ontem.
//
// Agora ela é um mount. O que ela mostra passou a ser decidido por QUEM instala
// o quê: `PersonTimeline` (@fayz-ai/admin) intercala as fontes registradas —
// cadastro e edições da trilha de auditoria, pedidos, pagamentos e agenda pelo
// core; gravações, documentos e interações pelos plugins de scribe, forms e
// crm. Num tenant sem o scribe, não existe fonte de gravação, e nada aqui
// precisa saber disso.
//
// O app não perde nada com isso: o que era app-específico nesta tela (quais
// tabelas, qual ordem) não era app-específico coisa nenhuma — era o mesmo
// "o que aconteceu com esta pessoa" que aluno e paciente também têm.
// ---------------------------------------------------------------------------

export function ClientTimelineTab({
  item,
}: {
  item: unknown
  entityDef: EntityDef
}) {
  const client = (item ?? {}) as Record<string, unknown>
  // `personId` porque em entidade de extensão (clients) o id da ficha JÁ é o da
  // pessoa — as fontes se ligam todas em people.id.
  const personId = String(client.id ?? client.personId ?? '')

  if (!personId) return null

  // A rota da ficha é a única coisa que o SDK não tem como saber — é o app que
  // decide onde os clientes moram (ver `path: '/clients'` em config/pages.tsx).
  // Com ela, clicar num pagamento na linha do tempo abre o Extrato, e clicar
  // numa gravação abre Gravações.
  return <PersonTimeline personId={personId} recordPath={`/clients/${personId}`} />
}
