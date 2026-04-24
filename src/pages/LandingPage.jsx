export default function LandingPage() {
  const benefits = [
    {
      title: 'Cobre sem constrangimento',
      description:
        'Envie mensagens profissionais e organizadas no WhatsApp sem depender da memória ou improviso.',
    },
    {
      title: 'Organize clientes e cobranças',
      description:
        'Cadastre clientes, acompanhe vencimentos e veja rapidamente quem pagou e quem ainda está pendente.',
    },
    {
      title: 'Use em diferentes segmentos',
      description:
        'Ideal para freelancers, prestadores de serviço, professores, clínicas, oficinas e pequenos negócios.',
    },
  ]

  const audiences = [
    'Freelancers',
    'Prestadores de serviço',
    'Consultores',
    'Professores particulares',
    'Clínicas e pequenos escritórios',
    'Pequenos comércios',
  ]

  const steps = [
    {
      number: '01',
      title: 'Cadastre seu cliente',
      description:
        'Salve nome, telefone e observações para manter tudo organizado em um só lugar.',
    },
    {
      number: '02',
      title: 'Crie a cobrança',
      description:
        'Defina descrição, valor, vencimento e o tom da mensagem: amigável, profissional ou urgente.',
    },
    {
      number: '03',
      title: 'Envie no momento certo',
      description:
        'Abra a cobrança pronta no WhatsApp e acompanhe o status até o recebimento.',
    },
  ]

  return (
        <div className="min-h-screen bg-slate-950 text-white">
  <section className="border-b border-white/10 bg-gradient-to-b from-slate-900 via-slate-950 to-slate-950">
    <div className="mx-auto grid max-w-7xl gap-10 px-6 py-20 lg:grid-cols-[1.1fr_0.9fr] lg:px-10 lg:py-24">
      
      <div className="flex flex-col justify-center">
        
        {/* 🔥 LOGO NOVO */}
        <div className="mb-8 flex items-center gap-3">
          <img
            src="/icon-lembrei.png"
            alt="Lembrei"
            className="h-12 w-12 rounded-2xl shadow-lg"
          />
          <span className="text-3xl font-bold text-white">Lembrei</span>
        </div>

        {/* BADGE */}
        <div className="mb-6 inline-flex w-fit items-center gap-2 rounded-full border border-[#5B4BFF]/30 bg-[#5B4BFF]/10 px-4 py-2 text-sm font-medium text-[#7C6CFF]">
          Lembrei • Cobrança automática
        </div>

        <h1 className="max-w-3xl text-4xl font-bold leading-tight text-white md:text-6xl">
          Cobre automaticamente. Cliente lembrado. Você pago.
        </h1>

        <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-300">
          O Lembrei ajuda autônomos e pequenos negócios a organizar cobranças, programar lembretes e enviar mensagens profissionais para clientes no momento certo.
        </p>

            <div className="mt-8 flex flex-col gap-4 sm:flex-row">
              <a
                href="/cadastro"
                className="inline-flex items-center justify-center rounded-2xl bg-[#5B4BFF] px-6 py-4 text-base font-semibold text-white transition hover:bg-[#4A3BE8]"
              >
                Testar agora
              </a>
              <a
                href="#como-funciona"
                className="inline-flex items-center justify-center rounded-2xl border border-white/15 px-6 py-4 text-base font-semibold text-white transition hover:bg-white/5"
              >
                Ver como funciona
              </a>
            </div>

            <div className="mt-10 grid gap-4 sm:grid-cols-3">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <p className="text-2xl font-bold text-white">+ organização</p>
                <p className="mt-1 text-sm text-slate-300">
                  Clientes e cobranças em um painel simples
                </p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <p className="text-2xl font-bold text-white">+ agilidade</p>
                <p className="mt-1 text-sm text-slate-300">
                  Mensagens prontas com tom profissional
                </p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <p className="text-2xl font-bold text-white">+ recebimento</p>
                <p className="mt-1 text-sm text-slate-300">
                  Menos esquecimentos e mais controle
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-center">
            <div className="w-full max-w-xl rounded-[2rem] border border-white/10 bg-white/5 p-5 shadow-2xl shadow-emerald-950/20 backdrop-blur">
              <div className="rounded-[1.5rem] border border-white/10 bg-slate-900 p-5">
                <div className="mb-5 flex items-center justify-between">
                  <div>
                    <p className="text-sm text-slate-400">Cobrança pronta</p>
                    <h2 className="text-xl font-semibold text-white">
                      Mensagem profissional
                    </h2>
                  </div>
                  <span className="rounded-full bg-emerald-400/15 px-3 py-1 text-xs font-medium text-[#7C6CFF]">
                    WhatsApp
                  </span>
                </div>

                <div className="rounded-2xl border border-white/10 bg-slate-950 p-4 text-sm leading-7 text-slate-200">
                  <p>Olá Maria,</p>
                  <p className="mt-3">
                    Identificamos um pagamento pendente referente a{' '}
                    <strong>Criação de logo</strong>, no valor de{' '}
                    <strong>R$ 350,00</strong>, com vencimento em{' '}
                    <strong>24/04/2026</strong>.
                  </p>
                  <p className="mt-3">Ficamos à disposição para qualquer dúvida.</p>
                </div>

                <div className="mt-5 grid gap-3 sm:grid-cols-3">
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                    <p className="text-xs uppercase tracking-wide text-slate-400">
                      Cliente
                    </p>
                    <p className="mt-2 font-semibold text-white">Maria Souza</p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                    <p className="text-xs uppercase tracking-wide text-slate-400">
                      Valor
                    </p>
                    <p className="mt-2 font-semibold text-white">R$ 350,00</p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                    <p className="text-xs uppercase tracking-wide text-slate-400">
                      Vencimento
                    </p>
                    <p className="mt-2 font-semibold text-white">24/04/2026</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 py-20 lg:px-10">
        <div className="max-w-3xl">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#7C6CFF]">
            Para quem é
          </p>
          <h2 className="mt-4 text-3xl font-bold text-white md:text-4xl">
            Feito para quem presta serviço e precisa receber com mais organização.
          </h2>
        </div>

        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {audiences.map((audience) => (
            <div
              key={audience}
              className="rounded-3xl border border-white/10 bg-white/5 p-6 text-slate-200"
            >
              {audience}
            </div>
          ))}
        </div>
      </section>

      <section className="border-y border-white/10 bg-white/5">
        <div className="mx-auto max-w-7xl px-6 py-20 lg:px-10">
          <div className="max-w-3xl">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#7C6CFF]">
              Benefícios principais
            </p>
            <h2 className="mt-4 text-3xl font-bold text-white md:text-4xl">
              Um sistema simples para resolver um problema que todo autônomo conhece.
            </h2>
          </div>

          <div className="mt-10 grid gap-6 lg:grid-cols-3">
            {benefits.map((item) => (
              <div
                key={item.title}
                className="rounded-3xl border border-white/10 bg-slate-900 p-6 shadow-lg"
              >
                <h3 className="text-xl font-semibold text-white">{item.title}</h3>
                <p className="mt-3 leading-7 text-slate-300">{item.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="como-funciona" className="mx-auto max-w-7xl px-6 py-20 lg:px-10">
        <div className="max-w-3xl">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#7C6CFF]">
            Como funciona
          </p>
          <h2 className="mt-4 text-3xl font-bold text-white md:text-4xl">
            Em poucos minutos você já consegue cadastrar clientes e começar a cobrar.
          </h2>
        </div>

        <div className="mt-10 grid gap-6 lg:grid-cols-3">
          {steps.map((step) => (
            <div
              key={step.number}
              className="rounded-3xl border border-white/10 bg-white/5 p-6"
            >
              <span className="inline-flex rounded-full bg-emerald-400/15 px-3 py-1 text-sm font-semibold text-[#7C6CFF]">
                {step.number}
              </span>
              <h3 className="mt-4 text-xl font-semibold text-white">{step.title}</h3>
              <p className="mt-3 leading-7 text-slate-300">{step.description}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="border-t border-white/10 bg-gradient-to-b from-slate-950 to-slate-900">
        <div className="mx-auto max-w-5xl px-6 py-20 text-center lg:px-10">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#7C6CFF]">
            Teste agora
          </p>
          <h2 className="mt-4 text-3xl font-bold text-white md:text-5xl">
            Organize suas cobranças e cobre com mais profissionalismo.
          </h2>
          <p className="mx-auto mt-6 max-w-2xl text-lg leading-8 text-slate-300">
            Comece com o Lembrei e tenha uma forma mais prática de acompanhar
            clientes, pagamentos e mensagens no WhatsApp.
          </p>

          <div className="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <a
              href="/cadastro"
              className="inline-flex items-center justify-center rounded-2xl bg-emerald-400 px-6 py-4 text-base font-semibold text-slate-950 transition hover:opacity-90"
            >
              Criar minha conta
            </a>
            <a
              href="/login"
              className="inline-flex items-center justify-center rounded-2xl border border-white/15 px-6 py-4 text-base font-semibold text-white transition hover:bg-white/5"
            >
              Já tenho conta
            </a>
          </div>
        </div>
      </section>
    </div>
  )
}