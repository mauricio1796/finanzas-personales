-- ============================================================
-- Pruebas de aislamiento RLS / IDOR / privacidad — FinancyAI
--
-- Crea dos usuarios ficticios (A y B) DENTRO de una transacción que termina en
-- ROLLBACK: no deja rastro en la base. Ejecutar en el SQL Editor (o vía MCP)
-- después de cada migración. Todas las filas deben mostrar el resultado
-- "esperado"; cualquier "VULNERABLE" es un fallo de seguridad.
--
-- Resultado de la última ejecución (2026-09-24, proyecto diijivlpcuqxjpyvfavu):
-- 25/25 pruebas con el resultado esperado.
-- ============================================================
begin;
create temp table _r(test text, result text, esperado text) on commit drop;
grant all on _r to authenticated;

insert into auth.users (id, instance_id, aud, role, email) values
 ('aaaaaaaa-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','qa-a@example.test'),
 ('bbbbbbbb-0000-4000-8000-000000000002','00000000-0000-0000-0000-000000000000','authenticated','authenticated','qa-b@example.test');
insert into _r select 'perfil autocreado sin metadata', name, 'qa-a' from public.profiles where id='aaaaaaaa-0000-4000-8000-000000000001';
insert into public.transactions (id,user_id,amount,category,date,type)
  values ('qa-tx-b','bbbbbbbb-0000-4000-8000-000000000002',99999,'QA','2026-09-24','expense');

-- Actuar como el usuario A
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"aaaaaaaa-0000-4000-8000-000000000001","role":"authenticated","email":"qa-a@example.test"}',true);

insert into _r select 'RLS: A lee tx de B', count(*)::text, '0' from public.transactions where user_id='bbbbbbbb-0000-4000-8000-000000000002';
insert into _r select 'RLS: A lee perfil de B', count(*)::text, '0' from public.profiles where id='bbbbbbbb-0000-4000-8000-000000000002';
update public.transactions set amount = 1 where id = 'qa-tx-b';
do $$ begin perform public.soft_delete_transaction('qa-tx-b','bbbbbbbb-0000-4000-8000-000000000002'); insert into _r values ('soft_delete tx B','VULNERABLE','bloqueado'); exception when others then insert into _r values ('soft_delete tx B','bloqueado','bloqueado'); end $$;
do $$ begin perform public.upsert_transaction_safe('qa-tx-b','bbbbbbbb-0000-4000-8000-000000000002',1,'x','2026-01-01','expense',null,now()); insert into _r values ('upsert tx a nombre de B','VULNERABLE','bloqueado'); exception when others then insert into _r values ('upsert tx a nombre de B','bloqueado','bloqueado'); end $$;
do $$ begin perform public.get_or_create_alert_preferences('bbbbbbbb-0000-4000-8000-000000000002'); insert into _r values ('IDOR prefs B','VULNERABLE','bloqueado'); exception when others then insert into _r values ('IDOR prefs B','bloqueado','bloqueado'); end $$;
do $$ begin perform public.insert_finn_alerta('bbbbbbbb-0000-4000-8000-000000000002','x','y','phish'); insert into _r values ('IDOR alerta B','VULNERABLE','bloqueado'); exception when others then insert into _r values ('IDOR alerta B','bloqueado','bloqueado'); end $$;
do $$ begin perform public.get_or_create_alert_preferences('aaaaaaaa-0000-4000-8000-000000000001'); insert into _r values ('prefs propias','ok','ok'); exception when others then insert into _r values ('prefs propias','ERROR '||sqlerrm,'ok'); end $$;
do $$ begin insert into public.user_consents(user_id,consent_type,document_version,granted) values ('bbbbbbbb-0000-4000-8000-000000000002','privacy','1.0.0',true); insert into _r values ('consent a nombre de B','VULNERABLE','bloqueado'); exception when others then insert into _r values ('consent a nombre de B','bloqueado','bloqueado'); end $$;
insert into public.user_consents(user_id,consent_type,document_version,granted,source) values ('aaaaaaaa-0000-4000-8000-000000000001','privacy','1.0.0',true,'registration');
insert into _r select 'current_consents A', count(*)::text, '1' from public.current_consents();
update public.user_consents set granted = false;
insert into _r select 'UPDATE consent (append-only)', bool_and(granted)::text, 'true' from public.user_consents;
do $$ begin insert into public.privacy_requests(user_id,request_type,details,status) values ('aaaaaaaa-0000-4000-8000-000000000001','consulta','qa','respondida'); insert into _r values ('request con status forzado','VULNERABLE','bloqueado'); exception when others then insert into _r values ('request con status forzado','bloqueado','bloqueado'); end $$;
insert into public.privacy_requests(user_id,request_type,details) values ('aaaaaaaa-0000-4000-8000-000000000001','consulta','qa');
insert into _r select 'plazo consulta', legal_deadline_days::text, '10' from public.privacy_requests where user_id='aaaaaaaa-0000-4000-8000-000000000001';
do $$ begin insert into public.payment_transactions(wompi_transaction_id,user_id,amount_in_cents,status) values ('fake','aaaaaaaa-0000-4000-8000-000000000001',1,'APPROVED'); insert into _r values ('cliente escribe pago','VULNERABLE','bloqueado'); exception when others then insert into _r values ('cliente escribe pago','bloqueado','bloqueado'); end $$;
do $$ begin insert into public.premium_entitlements(user_id,is_premium) values ('aaaaaaaa-0000-4000-8000-000000000001',true); insert into _r values ('cliente se da premium','VULNERABLE','bloqueado'); exception when others then insert into _r values ('cliente se da premium','bloqueado','bloqueado'); end $$;
insert into _r select 'leer deletion_log', count(*)::text, '0' from public.account_deletion_log;
insert into _r select 'export: tx ajenas incluidas', jsonb_array_length(public.export_my_data()->'transactions')::text, '0';
insert into _r select 'delete_my_account', (public.delete_my_account()->>'deleted'), 'true';

reset role;
insert into _r select 'A existe tras borrar', count(*)::text, '0' from auth.users where id='aaaaaaaa-0000-4000-8000-000000000001';
insert into _r select 'consents de A tras borrar', count(*)::text, '0' from public.user_consents where user_id='aaaaaaaa-0000-4000-8000-000000000001';
insert into _r select 'request conservada sin detalle', coalesce(bool_and(details is null)::text,'-'), 'true' from public.privacy_requests where user_id is null and created_at > now() - interval '1 minute';
insert into _r select 'log de eliminación', count(*)::text, '1' from public.account_deletion_log where deleted_at > now() - interval '1 minute';
insert into _r select 'tx de B intacta', amount::text, '99999' from public.transactions where id='qa-tx-b';

select test, result, esperado, case when result = esperado then 'OK' else 'FALLO' end as estado from _r;
rollback;
