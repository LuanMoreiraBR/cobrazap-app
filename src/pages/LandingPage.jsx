export default function LandingPage() {
  const testimonials = [
    {
      name: 'Carla Mendes',
      role: 'Designer Freelancer • São Paulo',
      avatar: 'CM',
      text: 'Antes eu perdia horas lembrando clientes no WhatsApp e ainda me sentia mal. Com o Lembrei, mando a cobrança em segundos e fica profissional. Recebi 3 pagamentos na mesma semana que comecei a usar.',
      value: 'R$ 4.200',
      label: 'recuperados no primeiro mês',
    },
    {
      name: 'Rafael Teixeira',
      role: 'Personal Trainer • Curitiba',
      avatar: 'RT',
      text: 'Tenho 40 alunos e antes vivia esquecendo quem tinha pago. Agora vejo tudo num painel só. Reduzi minha inadimplência em mais da metade.',
      value: '-58%',
      label: 'de inadimplência em 60 dias',
    },
    {
      name: 'Dra. Priscila Fonseca',
      role: 'Psicóloga Clínica • Belo Horizonte',
      avatar: 'PF',
      text: 'Como profissional de saúde, cobrar sempre foi desconfortável pra mim. O Lembrei me deu uma forma respeitosa e automática de fazer isso sem constrangimento.',
      value: '100%',
      label: 'das sessões cobradas pontualmente',
    },
    {
      name: 'Bruno Castilho',
      role: 'Consultor de TI • Porto Alegre',
      avatar: 'BC',
      text: 'Simples, rápido e profissional. Meus clientes recebem a mensagem e pagam. Não preciso mais ficar mandando "oi, tudo bem?" antes de cobrar.',
      value: '3x',
      label: 'mais rápido para receber',
    },
    {
      name: 'Juliana Rocha',
      role: 'Professora Particular • Recife',
      avatar: 'JR',
      text: 'Dava aula pra 20 alunos e mal conseguia controlar quem pagou. Hoje o Lembrei faz isso por mim. Sobra tempo pra focar no que realmente importa.',
      value: '20+',
      label: 'alunos organizados num só lugar',
    },
    {
      name: 'Marcos Oliveira',
      role: 'Fotógrafo • Rio de Janeiro',
      avatar: 'MO',
      text: 'Minha inadimplência era um caos. Com o Lembrei passei a cobrar com confiança e os clientes até agradecem pela organização. Parece empresa grande.',
      value: 'Zero',
      label: 'cobranças esquecidas desde então',
    },
  ]

  const benefits = [
    {
      icon: '💬',
      title: 'Mensagens prontas no WhatsApp',
      description: 'Escolha o tom — amigável, profissional ou urgente — e envie em segundos. Sem improvisar, sem constrangimento.',
    },
    {
      icon: '📋',
      title: 'Painel completo de clientes',
      description: 'Cadastre, acompanhe vencimentos e veja rapidamente quem pagou e quem está pendente — tudo num só lugar.',
    },
    {
      icon: '⏰',
      title: 'Lembretes no momento certo',
      description: 'Programe cobranças com antecedência e receba avisos antes do vencimento. Nunca mais esqueça uma cobrança.',
    },
    {
      icon: '📊',
      title: 'Controle financeiro real',
      description: 'Acompanhe o que foi recebido, o que está pendente e o que está em atraso com clareza visual imediata.',
    },
    {
      icon: '🔒',
      title: 'Dados seguros e privados',
      description: 'Seus dados e dos seus clientes são armazenados com segurança. Você tem controle total sobre suas informações.',
    },
    {
      icon: '⚡',
      title: 'Pronto em minutos',
      description: 'Sem configuração complicada. Crie sua conta, cadastre um cliente e envie sua primeira cobrança em menos de 5 minutos.',
    },
  ]

  const steps = [
    {
      number: '01',
      title: 'Cadastre seu cliente',
      description: 'Salve nome, telefone e observações para manter tudo organizado em um só lugar.',
    },
    {
      number: '02',
      title: 'Crie a cobrança',
      description: 'Defina descrição, valor, vencimento e o tom da mensagem que melhor se encaixa.',
    },
    {
      number: '03',
      title: 'Envie no WhatsApp',
      description: 'Abra a mensagem pronta direto no WhatsApp e acompanhe o status até o recebimento.',
    },
  ]

  const audiences = [
    { icon: '🎨', label: 'Designers & Criativos' },
    { icon: '💪', label: 'Personal Trainers' },
    { icon: '🧠', label: 'Psicólogos & Terapeutas' },
    { icon: '💻', label: 'Consultores de TI' },
    { icon: '📸', label: 'Fotógrafos' },
    { icon: '📚', label: 'Professores Particulares' },
    { icon: '🔧', label: 'Prestadores de Serviço' },
    { icon: '🏥', label: 'Clínicas & Consultórios' },
    { icon: '⚖️', label: 'Advogados & Contadores' },
  ]

  return (
    <div className="min-h-screen bg-slate-950 text-white" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&display=swap');

        * { box-sizing: border-box; }

        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(32px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        @keyframes float {
          0%, 100% { transform: translateY(0px); }
          50%       { transform: translateY(-10px); }
        }
        @keyframes pulse-ring {
          0%   { transform: scale(1);    opacity: 0.4; }
          70%  { transform: scale(1.15); opacity: 0; }
          100% { transform: scale(1.15); opacity: 0; }
        }
        @keyframes scroll-left {
          0%   { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        @keyframes glow {
          0%, 100% { box-shadow: 0 0 40px rgba(91,75,255,0.3); }
          50%       { box-shadow: 0 0 80px rgba(91,75,255,0.6); }
        }
        @keyframes shimmer {
          0%   { background-position: -200% center; }
          100% { background-position: 200% center; }
        }

        .hero-animate { animation: fadeUp 0.7s cubic-bezier(0.22,1,0.36,1) both; }
        .hero-animate-2 { animation: fadeUp 0.7s cubic-bezier(0.22,1,0.36,1) both; animation-delay: 0.15s; }
        .hero-animate-3 { animation: fadeUp 0.7s cubic-bezier(0.22,1,0.36,1) both; animation-delay: 0.3s; }
        .hero-animate-4 { animation: fadeUp 0.7s cubic-bezier(0.22,1,0.36,1) both; animation-delay: 0.45s; }
        .hero-animate-5 { animation: fadeUp 0.7s cubic-bezier(0.22,1,0.36,1) both; animation-delay: 0.6s; }
        .card-float     { animation: float 5s ease-in-out infinite; }

        .logo-ring-anim {
          position: absolute; inset: -8px; border-radius: 22px;
          border: 2px solid rgba(91,75,255,0.4);
          animation: pulse-ring 2.5s ease-out infinite;
        }

        .marquee-track {
          display: flex; width: max-content;
          animation: scroll-left 30s linear infinite;
        }
        .marquee-track:hover { animation-play-state: paused; }

        .btn-primary {
          background: #5B4BFF;
          color: #fff;
          font-weight: 700;
          border-radius: 14px;
          padding: 16px 32px;
          font-size: 15px;
          border: none;
          cursor: pointer;
          transition: transform 0.15s, box-shadow 0.15s, background 0.15s;
          display: inline-flex; align-items: center; justify-content: center;
          text-decoration: none;
          animation: glow 3s ease-in-out infinite;
        }
        .btn-primary:hover { background: #4A3BE8; transform: translateY(-2px); box-shadow: 0 12px 40px rgba(91,75,255,0.5); }

        .btn-outline {
          background: transparent;
          color: #fff;
          font-weight: 600;
          border-radius: 14px;
          padding: 16px 32px;
          font-size: 15px;
          border: 1.5px solid rgba(255,255,255,0.2);
          cursor: pointer;
          transition: all 0.15s;
          display: inline-flex; align-items: center; justify-content: center;
          text-decoration: none;
        }
        .btn-outline:hover { background: rgba(255,255,255,0.07); border-color: rgba(255,255,255,0.4); }

        .benefit-card {
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 24px;
          padding: 28px;
          transition: all 0.3s;
        }
        .benefit-card:hover {
          background: rgba(91,75,255,0.08);
          border-color: rgba(91,75,255,0.3);
          transform: translateY(-4px);
          box-shadow: 0 20px 60px rgba(91,75,255,0.15);
        }

        .testimonial-card {
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 24px;
          padding: 28px;
          min-width: 340px;
          max-width: 340px;
          flex-shrink: 0;
          margin-right: 20px;
        }

        .step-number {
          background: linear-gradient(135deg, #5B4BFF, #7C6CFF);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          font-size: 52px;
          font-weight: 800;
          line-height: 1;
        }

        .shimmer-text {
          background: linear-gradient(90deg, #fff 0%, #7C6CFF 40%, #fff 60%, #fff 100%);
          background-size: 200% auto;
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          animation: shimmer 4s linear infinite;
        }

        .noise-bg::before {
          content: '';
          position: absolute; inset: 0;
          background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 512 512' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.75' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.03'/%3E%3C/svg%3E");
          pointer-events: none; opacity: 0.4;
        }

        .hero-glow {
          position: absolute;
          border-radius: 50%;
          filter: blur(120px);
          pointer-events: none;
        }

        .stat-badge {
          background: rgba(91,75,255,0.15);
          border: 1px solid rgba(91,75,255,0.3);
          border-radius: 12px;
          padding: 8px 14px;
          font-size: 13px;
          font-weight: 600;
          color: #a89fff;
        }

        .avatar {
          width: 44px; height: 44px;
          border-radius: 50%;
          background: linear-gradient(135deg, #5B4BFF, #9c8dff);
          display: flex; align-items: center; justify-content: center;
          font-weight: 700; font-size: 14px; color: #fff;
          flex-shrink: 0;
        }

        .stars { color: #f59e0b; font-size: 14px; letter-spacing: 1px; }

        .section-label {
          display: inline-flex; align-items: center; gap: 8px;
          background: rgba(91,75,255,0.1);
          border: 1px solid rgba(91,75,255,0.25);
          border-radius: 100px;
          padding: 6px 16px;
          font-size: 12px;
          font-weight: 700;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          color: #9c8dff;
        }

        .audience-pill {
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 100px;
          padding: 12px 20px;
          font-size: 14px;
          font-weight: 500;
          color: #cbd5e1;
          display: flex; align-items: center; gap: 10px;
          transition: all 0.2s;
        }
        .audience-pill:hover {
          background: rgba(91,75,255,0.1);
          border-color: rgba(91,75,255,0.3);
          color: #fff;
        }

        .metric-card {
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 20px;
          padding: 28px;
          text-align: center;
        }
      `}</style>

      {/* ── NAV ── */}
      <nav style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', background: 'rgba(2,6,23,0.8)', backdropFilter: 'blur(20px)', position: 'sticky', top: 0, zIndex: 50 }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 24px', height: 64, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ position: 'relative', width: 36, height: 36 }}>
              <div className="logo-ring-anim" />
              <img src="/icon-lembrei.png" alt="Lembrei" style={{ width: 36, height: 36, borderRadius: 10, display: 'block' }} />
            </div>
            <span style={{ fontWeight: 800, fontSize: 18, color: '#fff' }}>Lembrei</span>
          </div>
          <div style={{ display: 'flex', gap: 12 }}>
            <a href="/login" className="btn-outline" style={{ padding: '10px 20px', fontSize: 14 }}>Entrar</a>
            <a href="/cadastro" className="btn-primary" style={{ padding: '10px 20px', fontSize: 14 }}>Começar grátis</a>
          </div>
        </div>
      </nav>

      {/* ── HERO ── */}
      <section style={{ position: 'relative', overflow: 'hidden', paddingTop: 80, paddingBottom: 100 }}>
        <div className="hero-glow" style={{ width: 600, height: 600, background: 'rgba(91,75,255,0.25)', top: -200, left: -100 }} />
        <div className="hero-glow" style={{ width: 400, height: 400, background: 'rgba(124,108,255,0.15)', top: 100, right: -100 }} />

        <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 24px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 60, alignItems: 'center' }}>
          <div>
            <div className="hero-animate">
              <div className="section-label">
                <span>✦</span> Plataforma de Cobranças
              </div>
            </div>

            <h1 className="hero-animate-2" style={{ fontSize: 'clamp(36px, 5vw, 58px)', fontWeight: 800, lineHeight: 1.1, marginTop: 24, marginBottom: 0 }}>
              Cobre com{' '}
              <span className="shimmer-text">profissionalismo.</span>
              <br />
              Receba com mais{' '}
              <span style={{ color: '#5B4BFF' }}>frequência.</span>
            </h1>

            <p className="hero-animate-3" style={{ fontSize: 18, lineHeight: 1.75, color: '#94a3b8', marginTop: 24, maxWidth: 480 }}>
              O Lembrei ajuda autônomos e pequenos negócios a organizar cobranças e enviar mensagens profissionais no WhatsApp — sem constrangimento, sem esquecimento.
            </p>

            <div className="hero-animate-4" style={{ display: 'flex', gap: 12, marginTop: 36, flexWrap: 'wrap' }}>
              <a href="/cadastro" className="btn-primary">
                Começar grátis →
              </a>
              <a href="#como-funciona" className="btn-outline">
                Ver como funciona
              </a>
            </div>

            <div className="hero-animate-5" style={{ display: 'flex', gap: 32, marginTop: 40 }}>
              {[
                { value: '2.400+', label: 'usuários ativos' },
                { value: 'R$12M+', label: 'em cobranças enviadas' },
                { value: '94%', label: 'taxa de recebimento' },
              ].map(m => (
                <div key={m.value}>
                  <div style={{ fontSize: 22, fontWeight: 800, color: '#fff' }}>{m.value}</div>
                  <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>{m.label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* MOCKUP */}
          <div className="card-float" style={{ position: 'relative' }}>
            <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 28, padding: 20, boxShadow: '0 40px 120px rgba(0,0,0,0.6)' }}>
              <div style={{ background: '#0f172a', borderRadius: 20, padding: 20 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                  <div>
                    <div style={{ fontSize: 12, color: '#64748b' }}>Cobrança gerada</div>
                    <div style={{ fontSize: 18, fontWeight: 700 }}>Mensagem profissional</div>
                  </div>
                  <div className="stat-badge">WhatsApp ✓</div>
                </div>

                <div style={{ background: '#020617', borderRadius: 16, padding: 20, fontSize: 14, lineHeight: 1.8, color: '#cbd5e1', marginBottom: 20 }}>
                  <p>Olá <strong style={{ color: '#fff' }}>Maria</strong>,</p>
                  <p style={{ marginTop: 12 }}>Identificamos um pagamento pendente referente a <strong style={{ color: '#fff' }}>Criação de logo</strong>, no valor de <strong style={{ color: '#5B4BFF' }}>R$ 350,00</strong>, com vencimento em <strong style={{ color: '#fff' }}>24/04/2026</strong>.</p>
                  <p style={{ marginTop: 12, color: '#94a3b8' }}>Ficamos à disposição para qualquer dúvida.</p>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
                  {[
                    { label: 'Cliente', value: 'Maria Souza' },
                    { label: 'Valor', value: 'R$ 350,00' },
                    { label: 'Status', value: '⏳ Pendente' },
                  ].map(item => (
                    <div key={item.label} style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 12, padding: 12 }}>
                      <div style={{ fontSize: 10, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.1em' }}>{item.label}</div>
                      <div style={{ fontSize: 13, fontWeight: 600, marginTop: 6 }}>{item.value}</div>
                    </div>
                  ))}
                </div>

                <div style={{ marginTop: 16, display: 'flex', gap: 8 }}>
                  <div style={{ flex: 1, background: '#5B4BFF', borderRadius: 10, padding: '10px 0', textAlign: 'center', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                    Abrir no WhatsApp
                  </div>
                  <div style={{ background: 'rgba(255,255,255,0.06)', borderRadius: 10, padding: '10px 14px', fontSize: 13, cursor: 'pointer' }}>
                    ✏️
                  </div>
                </div>
              </div>
            </div>

            {/* Floating badges */}
            <div style={{ position: 'absolute', top: -16, right: -16, background: '#10b981', borderRadius: 100, padding: '8px 14px', fontSize: 12, fontWeight: 700, boxShadow: '0 4px 20px rgba(16,185,129,0.4)', whiteSpace: 'nowrap' }}>
              ✓ Pago! R$ 1.800
            </div>
            <div style={{ position: 'absolute', bottom: -12, left: -16, background: '#0f172a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 100, padding: '8px 14px', fontSize: 12, fontWeight: 600, color: '#94a3b8', whiteSpace: 'nowrap' }}>
              📲 3 cobranças enviadas hoje
            </div>
          </div>
        </div>
      </section>

      {/* ── LOGO BAR ── */}
      <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', borderBottom: '1px solid rgba(255,255,255,0.06)', background: 'rgba(255,255,255,0.02)', padding: '20px 0', overflow: 'hidden' }}>
        <div style={{ fontSize: 12, color: '#475569', textAlign: 'center', marginBottom: 16, letterSpacing: '0.15em', textTransform: 'uppercase', fontWeight: 600 }}>
          Confiado por autônomos em todo o Brasil
        </div>
        <div style={{ overflow: 'hidden' }}>
          <div className="marquee-track">
            {[...audiences, ...audiences].map((a, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, marginRight: 48, color: '#475569', fontSize: 14, fontWeight: 500, whiteSpace: 'nowrap' }}>
                <span>{a.icon}</span> {a.label}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── BENEFÍCIOS ── */}
      <section style={{ maxWidth: 1200, margin: '0 auto', padding: '100px 24px' }}>
        <div style={{ textAlign: 'center', marginBottom: 64 }}>
          <div className="section-label" style={{ margin: '0 auto 20px' }}>Benefícios</div>
          <h2 style={{ fontSize: 'clamp(28px, 4vw, 44px)', fontWeight: 800, margin: 0 }}>
            Tudo que você precisa para<br />cobrar com confiança
          </h2>
          <p style={{ color: '#64748b', marginTop: 16, fontSize: 17 }}>Simples, direto, sem complicação.</p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20 }}>
          {benefits.map((b) => (
            <div key={b.title} className="benefit-card">
              <div style={{ fontSize: 36, marginBottom: 16 }}>{b.icon}</div>
              <h3 style={{ fontSize: 17, fontWeight: 700, margin: '0 0 10px' }}>{b.title}</h3>
              <p style={{ fontSize: 14, color: '#64748b', lineHeight: 1.7, margin: 0 }}>{b.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── COMO FUNCIONA ── */}
      <section id="como-funciona" style={{ background: 'rgba(255,255,255,0.02)', borderTop: '1px solid rgba(255,255,255,0.06)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', padding: '100px 24px' }}>
          <div style={{ textAlign: 'center', marginBottom: 64 }}>
            <div className="section-label" style={{ margin: '0 auto 20px' }}>Como funciona</div>
            <h2 style={{ fontSize: 'clamp(28px, 4vw, 44px)', fontWeight: 800, margin: 0 }}>
              Em 3 passos você já está cobrando
            </h2>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 32, position: 'relative' }}>
            <div style={{ position: 'absolute', top: 32, left: '20%', right: '20%', height: 1, background: 'linear-gradient(90deg, transparent, rgba(91,75,255,0.3), rgba(91,75,255,0.3), transparent)', pointerEvents: 'none' }} />
            {steps.map((step) => (
              <div key={step.number} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 24, padding: 32, position: 'relative' }}>
                <div className="step-number">{step.number}</div>
                <h3 style={{ fontSize: 18, fontWeight: 700, margin: '16px 0 10px' }}>{step.title}</h3>
                <p style={{ fontSize: 14, color: '#64748b', lineHeight: 1.7, margin: 0 }}>{step.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── MÉTRICAS ── */}
      <section style={{ maxWidth: 1200, margin: '0 auto', padding: '100px 24px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 20 }}>
          {[
            { value: '2.400+', label: 'Usuários ativos', sub: 'em todo o Brasil' },
            { value: 'R$12M+', label: 'Em cobranças', sub: 'geradas na plataforma' },
            { value: '94%', label: 'Taxa de recebimento', sub: 'média dos usuários' },
            { value: '-61%', label: 'Menos inadimplência', sub: 'após 60 dias de uso' },
          ].map(m => (
            <div key={m.value} className="metric-card">
              <div style={{ fontSize: 36, fontWeight: 800, color: '#5B4BFF' }}>{m.value}</div>
              <div style={{ fontSize: 15, fontWeight: 700, marginTop: 8 }}>{m.label}</div>
              <div style={{ fontSize: 12, color: '#475569', marginTop: 4 }}>{m.sub}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── DEPOIMENTOS ── */}
      <section style={{ background: 'rgba(255,255,255,0.02)', borderTop: '1px solid rgba(255,255,255,0.06)', borderBottom: '1px solid rgba(255,255,255,0.06)', padding: '100px 0', overflow: 'hidden' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 24px', marginBottom: 56 }}>
          <div style={{ textAlign: 'center' }}>
            <div className="section-label" style={{ margin: '0 auto 20px' }}>Depoimentos</div>
            <h2 style={{ fontSize: 'clamp(28px, 4vw, 44px)', fontWeight: 800, margin: 0 }}>
              Quem usa, recomenda
            </h2>
            <p style={{ color: '#64748b', marginTop: 12, fontSize: 17 }}>
              Veja o que nossos usuários estão falando sobre o Lembrei
            </p>
          </div>
        </div>

        <div style={{ overflow: 'hidden' }}>
          <div className="marquee-track" style={{ animation: 'scroll-left 40s linear infinite' }}>
            {[...testimonials, ...testimonials].map((t, i) => (
              <div key={i} className="testimonial-card">
                <div className="stars">★★★★★</div>
                <p style={{ fontSize: 14, color: '#cbd5e1', lineHeight: 1.75, margin: '14px 0 20px' }}>
                  "{t.text}"
                </p>
                <div style={{ background: 'rgba(91,75,255,0.1)', border: '1px solid rgba(91,75,255,0.2)', borderRadius: 12, padding: '10px 14px', marginBottom: 18 }}>
                  <span style={{ fontSize: 20, fontWeight: 800, color: '#7C6CFF' }}>{t.value}</span>
                  <span style={{ fontSize: 12, color: '#64748b', marginLeft: 8 }}>{t.label}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div className="avatar">{t.avatar}</div>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 700 }}>{t.name}</div>
                    <div style={{ fontSize: 12, color: '#475569' }}>{t.role}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── PARA QUEM É ── */}
      <section style={{ maxWidth: 1200, margin: '0 auto', padding: '100px 24px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 80, alignItems: 'center' }}>
          <div>
            <div className="section-label" style={{ marginBottom: 20 }}>Para quem é</div>
            <h2 style={{ fontSize: 'clamp(28px, 4vw, 40px)', fontWeight: 800, margin: '0 0 16px' }}>
              Feito para quem presta serviço e precisa receber
            </h2>
            <p style={{ color: '#64748b', fontSize: 16, lineHeight: 1.75 }}>
              Se você tem clientes, emite cobranças e usa o WhatsApp, o Lembrei foi feito para você.
            </p>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
            {audiences.map((a) => (
              <div key={a.label} className="audience-pill">
                <span>{a.icon}</span> {a.label}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA FINAL ── */}
      <section style={{ position: 'relative', overflow: 'hidden', padding: '100px 24px' }}>
        <div className="hero-glow" style={{ width: 600, height: 400, background: 'rgba(91,75,255,0.2)', top: '50%', left: '50%', transform: 'translate(-50%,-50%)' }} />
        <div style={{ maxWidth: 760, margin: '0 auto', textAlign: 'center', position: 'relative', zIndex: 1 }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 100, padding: '8px 20px', fontSize: 13, color: '#94a3b8', marginBottom: 32 }}>
            <div style={{ width: 8, height: 8, background: '#10b981', borderRadius: '50%', animation: 'pulse-ring 1.5s ease-out infinite' }} />
            Mais de 2.400 usuários ativos agora
          </div>
          <h2 style={{ fontSize: 'clamp(32px, 5vw, 54px)', fontWeight: 800, lineHeight: 1.1, margin: '0 0 20px' }}>
            Chega de cobrar com vergonha.<br />
            <span style={{ color: '#5B4BFF' }}>Comece a receber de verdade.</span>
          </h2>
          <p style={{ color: '#64748b', fontSize: 18, marginBottom: 40 }}>
            Crie sua conta grátis e envie sua primeira cobrança em menos de 5 minutos.
          </p>
          <div style={{ display: 'flex', gap: 14, justifyContent: 'center', flexWrap: 'wrap' }}>
            <a href="/cadastro" className="btn-primary" style={{ fontSize: 16, padding: '18px 40px' }}>
              Criar minha conta grátis →
            </a>
            <a href="/login" className="btn-outline" style={{ fontSize: 16, padding: '18px 40px' }}>
              Já tenho conta
            </a>
          </div>
          <p style={{ color: '#334155', fontSize: 13, marginTop: 20 }}>Sem cartão de crédito • Sem compromisso</p>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer style={{ borderTop: '1px solid rgba(255,255,255,0.06)', padding: '40px 24px' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <img src="/icon-lembrei.png" alt="Lembrei" style={{ width: 30, height: 30, borderRadius: 8 }} />
            <span style={{ fontWeight: 800, fontSize: 16 }}>Lembrei</span>
          </div>
          <div style={{ color: '#334155', fontSize: 13 }}>
            © {new Date().getFullYear()} Lembrei. Feito para autônomos brasileiros.
          </div>
          <div style={{ display: 'flex', gap: 24 }}>
            {['Termos', 'Privacidade', 'Contato'].map(l => (
              <a key={l} href="#" style={{ color: '#334155', fontSize: 13, textDecoration: 'none' }}>{l}</a>
            ))}
          </div>
        </div>
      </footer>
    </div>
  )
}