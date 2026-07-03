-- Seed default salon agenda operations data for existing tenants.
--
-- Idempotent: each insert is scoped by tenant + business key, so it is safe to
-- re-run after new tenants are added or after the agenda migration is applied.

INSERT INTO public.appointment_cancellation_reasons (
  tenant_id,
  name,
  description,
  requires_notes,
  is_active,
  sort_order
)
SELECT
  t.id,
  reason.name,
  reason.description,
  reason.requires_notes,
  true,
  reason.sort_order
FROM saas_core.tenants t
CROSS JOIN (
  VALUES
    ('Cliente desmarcou', 'Cliente solicitou o cancelamento antes do horario.', false, 10),
    ('Profissional indisponivel', 'Profissional nao podera atender no horario marcado.', true, 20),
    ('Nao compareceu', 'Cliente nao compareceu ao agendamento.', false, 30),
    ('Reagendado', 'Atendimento foi cancelado porque sera remarcado.', false, 40)
) AS reason(name, description, requires_notes, sort_order)
WHERE NOT EXISTS (
  SELECT 1
  FROM public.appointment_cancellation_reasons existing
  WHERE existing.tenant_id = t.id
    AND lower(existing.name) = lower(reason.name)
);

INSERT INTO public.appointment_confirmation_channels (
  tenant_id,
  name,
  channel,
  template,
  send_offset_hours,
  retry_offset_hours,
  is_default,
  is_active,
  sort_order
)
SELECT
  t.id,
  channel.name,
  channel.channel,
  channel.template,
  channel.send_offset_hours,
  channel.retry_offset_hours,
  channel.is_default,
  true,
  channel.sort_order
FROM saas_core.tenants t
CROSS JOIN (
  VALUES
    (
      'WhatsApp padrao',
      'whatsapp',
      'Ola {{clientName}}, confirmamos seu atendimento {{serviceName}} em {{appointmentDate}} as {{appointmentTime}}.',
      24,
      4,
      true,
      10
    ),
    (
      'Ligacao de confirmacao',
      'phone',
      'Ligar para confirmar atendimentos criticos ou com alto valor.',
      48,
      NULL,
      false,
      20
    )
) AS channel(name, channel, template, send_offset_hours, retry_offset_hours, is_default, sort_order)
WHERE NOT EXISTS (
  SELECT 1
  FROM public.appointment_confirmation_channels existing
  WHERE existing.tenant_id = t.id
    AND lower(existing.name) = lower(channel.name)
);

INSERT INTO public.appointment_schedule_rules (
  tenant_id,
  name,
  scope,
  start_time,
  end_time,
  slot_duration_minutes,
  buffer_minutes,
  min_advance_hours,
  max_advance_days,
  max_concurrent,
  allow_online_booking,
  is_active
)
SELECT
  t.id,
  'Horario padrao do salao',
  'tenant',
  '08:00',
  '20:00',
  30,
  15,
  2,
  30,
  1,
  true,
  true
FROM saas_core.tenants t
WHERE NOT EXISTS (
  SELECT 1
  FROM public.appointment_schedule_rules existing
  WHERE existing.tenant_id = t.id
    AND existing.scope = 'tenant'
    AND lower(existing.name) = 'horario padrao do salao'
);
