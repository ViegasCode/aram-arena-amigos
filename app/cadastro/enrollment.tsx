'use client';
import { useState, useEffect } from 'react';
import { Swords, ArrowUpRight, CheckCircle2, ShieldCheck, Zap, Trophy, Users, MessageCircle, Mail } from 'lucide-react';
type Player = {
  id: string;
  name: string;
  riot_id: string;
  tagline: string;
  icon: string;
  active: number;
};
export default function Enrollment({ signedIn }: { signedIn: boolean }) {
  const [player, setPlayer] = useState<Player | null>(null),
    [form, setForm] = useState({ name: '', riotId: '', tagline: '', icon: '' }),
    [loading, setLoading] = useState(signedIn),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [saved, setSaved] = useState(false),
    [loaded, setLoaded] = useState(!signedIn);
  async function load() {
    setLoading(true);
    setError('');
    try {
      const r = await fetch('/api/profile', { cache: 'no-store' });
      const d: any = await r.json();
      if (!r.ok) throw new Error(d.error);
      setPlayer(d.player);
      if (d.player)
        setForm({
          name: d.player.name,
          riotId: d.player.riot_id,
          tagline: d.player.tagline,
          icon: d.player.icon,
        });
      setLoaded(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao carregar cadastro.');
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    if (signedIn) void load();
  }, [signedIn]);
  async function save(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const r = await fetch('/api/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const d: any = await r.json();
      if (!r.ok) throw new Error(d.error);
      setPlayer({
        id: d.id,
        name: form.name,
        riot_id: form.riotId,
        tagline: form.tagline,
        icon: form.icon,
        active: player?.active ?? 1,
      });
      setSaved(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Não foi possível salvar.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="enrollment">
      <header className="enrollment-header">
        <a className="brand" href="/">
          <Swords />
          <span>
            ARAM<b>ARENA</b>
          </span>
        </a>
        <a href="/">← Voltar à arena</a>
      </header>
      <div className="enrollment-layout">
        <section>
          <p className="eyebrow"><Zap size={14}/> ENTRE NO SISTEMA</p>
          <h1>
            Sua lenda começa
            <br />
            na ponte<span>.</span>
          </h1>
          <p className="muted">
            Conecte sua conta, vincule seu Riot ID e dispute o topo da arena com seus amigos.
          </p>
          <div className="enrollment-step">
            <span>01</span>
            <div>
              <h3>Acesse a Arena</h3>
              <p>Escolha uma conta segura para identificar seu jogador.</p>
            </div>
          </div>
          <div className="enrollment-step">
            <span>02</span>
            <div>
              <h3>Apresente seu jogador</h3>
              <p>Escolha seu apelido e informe seu Riot ID.</p>
            </div>
          </div>
          <div className="enrollment-step">
            <span>03</span>
            <div>
              <h3>Pronto para o sorteio</h3>
              <p>Seu cadastro aparece automaticamente para o administrador.</p>
            </div>
          </div>
        </section>
        <section className="panel enrollment-card">
          {!signedIn ? (
            <div className="login-gateway">
              <div className="login-status"><i/><span>SERVIDOR ONLINE</span><small>ACESSO SEGURO</small></div>
              <div className="login-emblem"><ShieldCheck/><span><Zap size={15}/></span></div>
              <span className="login-kicker">ARAM ARENA NETWORK</span>
              <h2>Entre na competição</h2>
              <p className="muted">Acesse seu jogador e mantenha seu progresso, histórico e conquistas.</p>
              <div className="login-providers">
                <a className="login-provider google" href="/signin-with-chatgpt?return_to=%2Fcadastro" target="_top"><Mail size={20}/><span><strong>Continuar com Google</strong><small>pela conta vinculada ao ChatGPT</small></span><ArrowUpRight size={17}/></a>
                <button className="login-provider discord" type="button" disabled title="Integração com Discord em preparação"><MessageCircle size={21}/><span><strong>Continuar com Discord</strong><small>Em breve</small></span><i>EM BREVE</i></button>
              </div>
              <div className="login-divider"><span/>OU<span/></div>
              <a className="login-chatgpt" href="/signin-with-chatgpt?return_to=%2Fcadastro" target="_top">Entrar com minha conta atual <ArrowUpRight size={16}/></a>
              <div className="login-trust"><span><ShieldCheck size={14}/> Cadastro protegido</span><span><Users size={14}/> Apenas seu grupo</span><span><Trophy size={14}/> Progresso preservado</span></div>
              <p className="login-footnote">Você também pode acompanhar o ranking sem se cadastrar.</p>
            </div>
          ) : loading ? (
            <p role="status">Carregando seu cadastro…</p>
          ) : saved ? (
            <>
              <CheckCircle2 size={40} className="good" />
              <h2>Seu cadastro está pronto.</h2>
              <p>{player?.name}, você já aparece na lista de jogadores.</p>
              {player?.active === 0 && (
                <p className="notice">
                  Seu cadastro foi desativado pelo administrador. Ele precisa
                  reativá-lo para os próximos sorteios.
                </p>
              )}
              <a
                className="button gold"
                href={'/?view=Jogadores&player=' + player?.id}
              >
                Ver meu perfil <ArrowUpRight size={18} />
              </a>
              <a className="button secondary" href="/?view=Jogadores">
                Ver jogadores
              </a>
              <button className="secondary" onClick={() => setSaved(false)}>
                Editar meu cadastro
              </button>
            </>
          ) : loaded ? (
            <>
              <h2>{player ? 'Meu cadastro' : 'Cadastre seu jogador'}</h2>
              <p className="muted">
                Apelido e Riot ID ficam visíveis no campeonato. Seu e-mail de
                login não é publicado.
              </p>
              {player?.active === 0 && (
                <p className="notice">
                  Seu cadastro está inativo. Somente o administrador pode
                  reativá-lo.
                </p>
              )}
              <form className="form" onSubmit={save}>
                {(
                  [
                    ['name', 'Apelido', 'Como você quer aparecer', 40],
                    ['riotId', 'Riot ID', 'Ex.: The Summoning', 50],
                    ['tagline', 'Tagline', 'Ex.: BR2', 10],
                    ['icon', 'Ícone ou iniciais (opcional)', 'Ex.: DG', 4],
                  ] as const
                ).map(([key, label, placeholder, max]) => (
                  <label key={key} htmlFor={'register-' + key}>
                    {label}
                    <input
                      id={'register-' + key}
                      required={key !== 'icon'}
                      maxLength={max}
                      placeholder={placeholder}
                      value={form[key]}
                      disabled={busy}
                      onChange={(e) =>
                        setForm({ ...form, [key]: e.target.value })
                      }
                    />
                  </label>
                ))}
                {error && (
                  <p className="error" role="alert">
                    {error}
                  </p>
                )}
                <button className="gold" disabled={busy}>
                  {busy
                    ? 'Salvando…'
                    : player
                      ? 'Salvar meu cadastro'
                      : 'Concluir cadastro e participar'}
                </button>
              </form>
              <p className="muted">
                Uma inscrição por conta. O Riot ID é informado por você; a
                validação oficial pela Riot ainda não está ativa.
              </p>
            </>
          ) : (
            <div role="alert">
              <p className="error">{error}</p>
              <button className="secondary" onClick={() => void load()}>
                Tentar novamente
              </button>
            </div>
          )}
          {signedIn && (
            <a
              className="muted"
              href="/signout-with-chatgpt?return_to=/cadastro"
              target="_top"
            >
              Sair da conta
            </a>
          )}
        </section>
      </div>
    </main>
  );
}
