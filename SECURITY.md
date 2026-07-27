# Política de segurança

## Versões suportadas

A versão mais recente da branch `main` é a versão mantida e deve receber correções de segurança.

## Como relatar uma vulnerabilidade

Não abra uma issue pública com detalhes de uma vulnerabilidade, dados pessoais, credenciais ou formas de exploração.

Use o recurso privado do GitHub em **Security → Advisories → Report a vulnerability**. Inclua:

- descrição e impacto;
- passos mínimos para reprodução;
- versão, plataforma e dispositivo afetados;
- sugestão de correção, quando houver.

Não envie tokens, senhas, dados reais de usuários ou coordenadas de localização. Substitua qualquer informação sensível por exemplos fictícios.

## Segredos e configuração

- O arquivo `.env` real nunca deve ser versionado.
- O aplicativo aceita somente a URL do projeto e a chave publicável do Supabase.
- `SUPABASE_SERVICE_ROLE_KEY`, segredos de bootstrap, tokens do GitHub e chaves de assinatura devem permanecer exclusivamente nos ambientes seguros dos respectivos provedores.
- Se um segredo for exposto, ele deve ser revogado e substituído antes da remoção do histórico do Git.
