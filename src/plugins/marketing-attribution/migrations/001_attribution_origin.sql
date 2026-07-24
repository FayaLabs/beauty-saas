-- Beauty override of plugin-marketing's generic attribution view.
-- The SDK view (plugin-marketing 006) only reads spine metadata; in beauty the
-- acquisition origin lives in the Ring-2 extension clients.origin (fed by the
-- Origins registry). Replace the view KEEPING the plugin's column contract:
--   (tenant_id uuid, kind text, source text, channel_raw text,
--    occurred_at timestamptz, value numeric)
-- Lives in src/plugins/ (incubator, step 5) ON PURPOSE: it must run AFTER the
-- plugin step (4) so this replace wins over the generic view on fresh pools.

CREATE OR REPLACE VIEW public.v_marketing_attribution WITH (security_invoker=true) AS
-- lead events (CRM leads; sourceId aligns with lead-sources/channel ids)
SELECT p.tenant_id,
       'lead'::text AS kind,
       'crm'::text AS source,
       COALESCE(p.metadata->>'sourceId', p.metadata->>'sourceName', p.metadata->>'origin') AS channel_raw,
       p.created_at AS occurred_at,
       NULLIF(p.metadata->>'value', '')::numeric AS value
FROM public.people p
WHERE p.kind = 'lead'
UNION ALL
-- booking conversions, attributed by the CLIENT's origin (clients.origin)
SELECT b.tenant_id, 'conversion', 'agenda',
       COALESCE(b.metadata->>'origin', c.origin, pc.metadata->>'origin', pc.metadata->>'sourceId'),
       b.starts_at,
       o.total
FROM public.appointments b
LEFT JOIN public.people pc ON pc.id = b.party_id
LEFT JOIN public.clients c ON c.person_id = b.party_id
LEFT JOIN public.orders o ON o.id = b.order_id
WHERE b.status NOT IN ('cancelled', 'no_show')
UNION ALL
-- order conversions (retail/product sales)
SELECT o.tenant_id, 'conversion', 'orders',
       COALESCE(o.metadata->>'origin', c.origin, pp.metadata->>'origin', pp.metadata->>'sourceId'),
       o.created_at,
       o.total
FROM public.orders o
LEFT JOIN public.people pp ON pp.id = o.party_id
LEFT JOIN public.clients c ON c.person_id = o.party_id
WHERE o.kind NOT IN ('appointment', 'deal')
  AND o.status NOT IN ('cancelled', 'draft')
UNION ALL
-- won-deal conversions (CRM)
SELECT o.tenant_id, 'conversion', 'crm',
       COALESCE(pp.metadata->>'sourceId', pp.metadata->>'sourceName', o.metadata->>'origin'),
       o.updated_at,
       o.total
FROM public.orders o
LEFT JOIN public.people pp ON pp.id = o.party_id
WHERE o.kind = 'deal' AND o.status = 'won';

GRANT SELECT ON public.v_marketing_attribution TO authenticated;
