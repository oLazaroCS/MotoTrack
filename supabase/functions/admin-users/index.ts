import { createClient } from 'npm:@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-bootstrap-secret',
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

const limits = { name: 80, nickname: 30, email: 254, phone: 15, password: 128, teamName: 80, teamTag: 24, teamCode: 64 } as const;
const textValue = (value: unknown) => String(value ?? '').trim();
const normalizePhone = (value: unknown) => textValue(value).replace(/\D/g, '');
const validEmail = (value: unknown) => { const email = textValue(value); return email.length <= limits.email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email); };
const validPhone = (value: unknown) => /^\d{10,15}$/.test(normalizePhone(value));
const validPassword = (value: unknown) => { const password = String(value ?? ''); return password.length >= 8 && password.length <= limits.password && /[a-z]/.test(password) && /[A-Z]/.test(password) && /\d/.test(password) && /[^A-Za-z0-9]/.test(password); };
const validName = (value: unknown) => { const name = textValue(value); return name.length >= 3 && name.length <= limits.name; };
const validNickname = (value: unknown) => { const nickname = textValue(value); return nickname.length >= 2 && nickname.length <= limits.nickname; };
const uniqueIds = (value: unknown) => [...new Set(Array.isArray(value) ? value.map(textValue).filter(Boolean) : [])];

async function removeStorageFolder(admin: ReturnType<typeof createClient>, bucket: string, folder: string) {
  let offset = 0;
  const paths: string[] = [];
  while (true) {
    const { data, error } = await admin.storage.from(bucket).list(folder, { limit: 100, offset });
    if (error) throw error;
    const files = (data ?? []).filter((item) => item.id).map((item) => `${folder}/${item.name}`);
    paths.push(...files);
    if ((data?.length ?? 0) < 100) break;
    offset += 100;
  }
  if (paths.length) {
    const { error } = await admin.storage.from(bucket).remove(paths);
    if (error) throw error;
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  try {
    const url = Deno.env.get('SUPABASE_URL')!;
    const anon = Deno.env.get('SUPABASE_ANON_KEY')!;
    const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const admin = createClient(url, service, { auth: { autoRefreshToken: false, persistSession: false } });
    const body = await req.json();

    if (body.action === 'bootstrap-master') {
      const expectedSecret = Deno.env.get('MASTER_BOOTSTRAP_SECRET');
      const suppliedSecret = req.headers.get('x-bootstrap-secret');
      if (!expectedSecret || suppliedSecret !== expectedSecret) return json({ error: 'Bootstrap não autorizado' }, 403);
      const { count } = await admin.from('profiles').select('id', { count: 'exact', head: true }).eq('is_master_admin', true);
      if (count) return json({ error: 'O administrador master já existe' }, 409);
      if (!body.master?.email || !body.master?.password || !body.master?.name) return json({ error: 'Dados do master incompletos' }, 400);
      if (!validName(body.master.name) || !validEmail(body.master.email) || !validPassword(body.master.password)) return json({ error: 'Dados do master inválidos' }, 400);
      if (body.master.phone && !validPhone(body.master.phone)) return json({ error: 'Telefone do master inválido' }, 400);

      let { data: bootstrapTeam } = await admin.from('teams').select('id, join_code').limit(1).maybeSingle();
      let temporaryTeamId: string | null = null;
      if (!bootstrapTeam) {
        const temporaryCode = `BOOT-${crypto.randomUUID()}`;
        const { data, error } = await admin.from('teams').insert({ name: 'Equipe temporária do sistema', tag: `SYSTEM-${crypto.randomUUID().slice(0, 8)}`, join_code: temporaryCode }).select('id, join_code').single();
        if (error) throw error;
        bootstrapTeam = data;
        temporaryTeamId = data.id;
      }

      const { data: created, error: createError } = await admin.auth.admin.createUser({
        email: textValue(body.master.email).toLowerCase(),
        password: body.master.password,
        email_confirm: true,
        user_metadata: { name: textValue(body.master.name), nickname: 'Master', phone: body.master.phone ? normalizePhone(body.master.phone) : null, driver_code: 'MASTER', team_code: bootstrapTeam.join_code },
      });
      if (createError) throw createError;

      const { error: promoteError } = await admin.from('profiles').update({ is_master_admin: true, role: 'admin', account_status: 'active', team_id: null, driver_code: 'MASTER' }).eq('id', created.user.id);
      if (promoteError) throw promoteError;
      if (temporaryTeamId) await admin.from('teams').delete().eq('id', temporaryTeamId);

      const { data: users, error: listError } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
      if (listError) throw listError;
      for (const oldUser of users.users) {
        if (oldUser.id !== created.user.id) {
          await removeStorageFolder(admin, 'avatars', oldUser.id);
          const { error } = await admin.auth.admin.deleteUser(oldUser.id);
          if (error) throw error;
        }
      }
      return json({ id: created.user.id, email: created.user.email, removedUsers: Math.max(0, users.users.length - 1) }, 201);
    }

    const authHeader = req.headers.get('Authorization') || '';
    const callerClient = createClient(url, anon, { global: { headers: { Authorization: authHeader } } });
    const { data: { user } } = await callerClient.auth.getUser();
    if (!user) return json({ error: 'Não autenticado' }, 401);

    const { data: caller } = await admin.from('profiles').select('id, team_id, role, account_status, is_master_admin').eq('id', user.id).single();
    const isMaster = Boolean(caller?.is_master_admin && caller.account_status === 'active');
    const { data: callerMembership } = caller?.team_id
      ? await admin.from('team_memberships').select('role, status').eq('user_id', user.id).eq('team_id', caller.team_id).maybeSingle()
      : { data: null };
    const isTeamAdmin = Boolean(caller?.team_id && callerMembership?.role === 'admin' && callerMembership.status === 'active');
    if (!isMaster && !isTeamAdmin) return json({ error: 'Acesso negado' }, 403);

    if (body.action === 'create-team') {
      if (!isMaster) return json({ error: 'Apenas o master pode criar equipes' }, 403);
      const input = body.team;
      if (!input?.name || !input?.tag) return json({ error: 'Nome e tag são obrigatórios' }, 400);
      const teamName = textValue(input.name);
      const teamTag = textValue(input.tag).toUpperCase();
      if (teamName.length < 3 || teamName.length > limits.teamName) return json({ error: 'O nome da equipe deve ter de 3 a 80 caracteres' }, 400);
      if (teamTag.length < 2 || teamTag.length > limits.teamTag) return json({ error: 'A tag deve ter de 2 a 24 caracteres' }, 400);
      const { data: team, error } = await admin.from('teams').insert({
        name: teamName,
        tag: teamTag,
        created_by: user.id,
      }).select('id, name, tag, join_code, logo_url, created_by').single();
      if (error) throw error;
      if (input.adminUserId) {
        const { error: assignError } = await admin.from('team_memberships').upsert({ team_id: team.id, user_id: input.adminUserId, role: 'admin', status: 'active' });
        if (assignError) { await admin.from('teams').delete().eq('id', team.id); throw assignError; }
      }
      return json({ team }, 201);
    }

    if (body.action === 'update-team') {
      if (!isMaster) return json({ error: 'Apenas o master pode editar equipes' }, 403);
      const allowed = Object.fromEntries(Object.entries(body.changes || {}).filter(([key]) => ['name', 'tag', 'logo_url'].includes(key)));
      if (typeof allowed.name === 'string') { allowed.name = allowed.name.trim(); if (allowed.name.length < 3 || allowed.name.length > limits.teamName) return json({ error: 'Nome da equipe inválido' }, 400); }
      if (typeof allowed.tag === 'string') { allowed.tag = allowed.tag.trim().toUpperCase(); if (allowed.tag.length < 2 || allowed.tag.length > limits.teamTag) return json({ error: 'Tag da equipe inválida' }, 400); }
      if (typeof allowed.logo_url === 'string' && allowed.logo_url.length > 500) return json({ error: 'Referência do logo muito longa' }, 400);
      const { error } = await admin.from('teams').update(allowed).eq('id', body.teamId);
      if (error) throw error;
      if (body.adminUserId) {
        const { error: assignError } = await admin.from('team_memberships').upsert({ team_id: body.teamId, user_id: body.adminUserId, role: 'admin', status: 'active' });
        if (assignError) throw assignError;
      }
      return json({ ok: true });
    }

    if (body.action === 'delete-team') {
      if (!isMaster) return json({ error: 'Apenas o master pode remover equipes' }, 403);
      await removeStorageFolder(admin, 'team-logos', textValue(body.teamId));
      const { error } = await admin.from('teams').delete().eq('id', body.teamId);
      if (error) throw error;
      return json({ ok: true });
    }

    if (body.action === 'create-user') {
      if (!isMaster) return json({ error: 'Apenas o master pode criar usuários diretamente' }, 403);
      const input = body.user;
      const teamIds = uniqueIds(input?.teamIds);
      if (!input?.email || !input?.password || !input?.name || !input?.nickname || !teamIds.length) return json({ error: 'Dados obrigatórios ausentes' }, 400);
      if (!validName(input.name)) return json({ error: 'Nome inválido' }, 400);
      if (!validNickname(input.nickname)) return json({ error: 'Apelido inválido' }, 400);
      if (!validEmail(input.email)) return json({ error: 'E-mail inválido' }, 400);
      if (!validPhone(input.phone)) return json({ error: 'Telefone inválido' }, 400);
      if (!validPassword(input.password)) return json({ error: 'A senha não atende aos requisitos de segurança' }, 400);
      const { data: teams, error: teamError } = await admin.from('teams').select('id, join_code').in('id', teamIds);
      if (teamError) throw teamError;
      if (teams.length !== teamIds.length) return json({ error: 'Uma ou mais equipes não existem' }, 400);
      const primaryTeam = teams.find((team) => team.id === teamIds[0])!;
      const memberRole = input.role === 'admin' ? 'admin' : 'driver';
      const { data: created, error } = await admin.auth.admin.createUser({
        email: textValue(input.email).toLowerCase(),
        password: input.password,
        email_confirm: true,
        user_metadata: { name: textValue(input.name), nickname: textValue(input.nickname), phone: normalizePhone(input.phone), team_code: primaryTeam.join_code },
      });
      if (error) throw error;
      const memberships = teamIds.map((teamId) => ({ team_id: teamId, user_id: created.user.id, role: memberRole, status: 'active' }));
      const { error: membershipError } = await admin.from('team_memberships').upsert(memberships);
      if (membershipError) { await admin.auth.admin.deleteUser(created.user.id); throw membershipError; }
      const { error: profileError } = await admin.from('profiles').update({ team_id: teamIds[0], role: memberRole, account_status: 'active' }).eq('id', created.user.id);
      if (profileError) throw profileError;
      return json({ id: created.user.id }, 201);
    }

    const { data: target } = await admin.from('profiles').select('*').eq('id', body.userId).single();
    if (!target) return json({ error: 'Usuário não encontrado' }, 404);
    if (target.is_master_admin) return json({ error: 'A conta master é protegida' }, 403);
    const { data: targetMembership } = !isMaster && caller?.team_id
      ? await admin.from('team_memberships').select('role, status').eq('user_id', target.id).eq('team_id', caller.team_id).maybeSingle()
      : { data: null };
    if (!isMaster && !targetMembership) return json({ error: 'Usuário fora da equipe' }, 404);
    if (!isMaster && target.id === user.id) return json({ error: 'Você não pode alterar a própria função' }, 400);

    if (body.action === 'update-user') {
      const requested = body.changes || {};
      const profileChanges: Record<string, unknown> = {};
      if (isMaster && requested.name !== undefined) { if (!validName(requested.name)) return json({ error: 'Nome inválido' }, 400); profileChanges.name = textValue(requested.name); }
      if (isMaster && requested.nickname !== undefined) { if (!validNickname(requested.nickname)) return json({ error: 'Apelido inválido' }, 400); profileChanges.nickname = textValue(requested.nickname); }
      if (isMaster && requested.phone !== undefined) { if (!validPhone(requested.phone)) return json({ error: 'Telefone inválido' }, 400); profileChanges.phone = normalizePhone(requested.phone); }
      const role = requested.role === 'admin' ? 'admin' : requested.role === 'driver' ? 'driver' : undefined;
      const status = ['active', 'inactive', 'pending'].includes(String(requested.account_status)) ? requested.account_status : undefined;
      if (requested.role !== undefined && !role) return json({ error: 'Função inválida' }, 400);
      if (requested.account_status !== undefined && !status) return json({ error: 'Status inválido' }, 400);
      const authChanges: { email?: string; password?: string } = {};
      if (isMaster && requested.email) { if (!validEmail(requested.email)) return json({ error: 'E-mail inválido' }, 400); authChanges.email = textValue(requested.email).toLowerCase(); }
      if (isMaster && requested.password) { if (!validPassword(requested.password)) return json({ error: 'A senha não atende aos requisitos de segurança' }, 400); authChanges.password = requested.password; }
      if (Object.keys(authChanges).length) {
        const { error } = await admin.auth.admin.updateUserById(target.id, authChanges);
        if (error) throw error;
        if (authChanges.email) profileChanges.email = authChanges.email;
      }

      if (isMaster && Array.isArray(requested.team_ids)) {
        const teamIds = uniqueIds(requested.team_ids);
        if (!teamIds.length) return json({ error: 'Selecione ao menos uma equipe' }, 400);
        const { data: existingTeams, error: teamError } = await admin.from('teams').select('id').in('id', teamIds);
        if (teamError) throw teamError;
        if (existingTeams.length !== teamIds.length) return json({ error: 'Uma ou mais equipes não existem' }, 400);
        const { data: currentMemberships, error: currentError } = await admin.from('team_memberships').select('team_id').eq('user_id', target.id);
        if (currentError) throw currentError;
        const membershipRole = role ?? target.role;
        const membershipStatus = status ?? target.account_status;
        const { error: upsertError } = await admin.from('team_memberships').upsert(teamIds.map((teamId) => ({ team_id: teamId, user_id: target.id, role: membershipRole, status: membershipStatus })));
        if (upsertError) throw upsertError;
        for (const membership of currentMemberships ?? []) {
          if (!teamIds.includes(membership.team_id)) {
            const { error: removeError } = await admin.from('team_memberships').delete().eq('team_id', membership.team_id).eq('user_id', target.id);
            if (removeError) throw removeError;
          }
        }
        Object.assign(profileChanges, { team_id: teamIds[0], role: membershipRole, account_status: membershipStatus });
      } else {
        const teamId = isMaster ? target.team_id : caller!.team_id;
        if (teamId && (role || status)) {
          const membershipChanges = { ...(role ? { role } : {}), ...(status ? { status } : {}) };
          const { error: membershipError } = await admin.from('team_memberships').update(membershipChanges).eq('team_id', teamId).eq('user_id', target.id);
          if (membershipError) throw membershipError;
        }
      }

      if (Object.keys(profileChanges).length) {
        const { error } = await admin.from('profiles').update(profileChanges).eq('id', target.id);
        if (error) throw error;
      }
      if (status && status !== 'active') {
        await admin.from('driver_locations').update({ is_online: false, last_online_at: new Date().toISOString() }).eq('user_id', target.id);
      }
      return json({ ok: true });
    }

    if (body.action === 'remove-team-member') {
      const teamId = isMaster ? textValue(body.teamId) : caller!.team_id!;
      if (!teamId) return json({ error: 'Equipe inválida' }, 400);
      const { error } = await admin.from('team_memberships').delete().eq('team_id', teamId).eq('user_id', target.id);
      if (error) throw error;
      return json({ ok: true });
    }

    if (body.action === 'delete-user') {
      if (!isMaster) return json({ error: 'Apenas o master pode excluir uma conta definitivamente' }, 403);
      await removeStorageFolder(admin, 'avatars', target.id);
      const { error } = await admin.auth.admin.deleteUser(target.id);
      if (error) throw error;
      return json({ ok: true });
    }

    return json({ error: 'Ação inválida' }, 400);
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'Erro interno' }, 500);
  }
});
