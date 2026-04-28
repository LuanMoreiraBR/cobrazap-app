import { Link } from 'react-router-dom'

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
    <div className="landing-page">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&display=swap');

        * { box-sizing: border-box; }

        html {
          scroll-behavior: smooth;
        }

        body {
          margin: 0;
          overflow-x: hidden;
        }

        .landing-page {
          min-height: 100vh;
          width: 100%;
          overflow-x: hidden;
          background: #020617;
          color: #fff;
          font-family: 'Plus Jakarta Sans', sans-serif;
        }

        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(32px); }
          to { opacity: 1; transform: translateY(0); }
        }

        @keyframes float {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-10px); }
        }

        @keyframes pulse-ring {
          0% { transform: scale(1); opacity: 0.4; }
          70% { transform: scale(1.15); opacity: 0; }
          100% { transform: scale(1.15); opacity: 0; }
        }

        @keyframes scroll-left {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }

        @keyframes glow {
          0%, 100% { box-shadow: 0 0 40px rgba(91,75,255,0.3); }
          50% { box-shadow: 0 0 80px rgba(91,75,255,0.55); }
        }

        @keyframes shimmer {
          0% { background-position: -200% center; }
          100% { background-position: 200% center; }
        }

        .container {
          width: min(1200px, calc(100% - 48px));
          margin: 0 auto;
        }

        .hero-animate { animation: fadeUp 0.7s cubic-bezier(0.22,1,0.36,1) both; }
        .hero-animate-2 { animation: fadeUp 0.7s cubic-bezier(0.22,1,0.36,1) both; animation-delay: 0.15s; }
        .hero-animate-3 { animation: fadeUp 0.7s cubic-bezier(0.22,1,0.36,1) both; animation-delay: 0.3s; }
        .hero-animate-4 { animation: fadeUp 0.7s cubic-bezier(0.22,1,0.36,1) both; animation-delay: 0.45s; }
        .hero-animate-5 { animation: fadeUp 0.7s cubic-bezier(0.22,1,0.36,1) both; animation-delay: 0.6s; }
        .card-float { animation: float 5s ease-in-out infinite; }

        .logo-ring-anim {
          position: absolute;
          inset: -8px;
          border-radius: 22px;
          border: 2px solid rgba(91,75,255,0.4);
          animation: pulse-ring 2.5s ease-out infinite;
        }

        .btn-primary,
        .btn-outline {
          min-height: 48px;
          border-radius: 14px;
          padding: 16px 32px;
          font-size: 15px;
          cursor: pointer;
          transition: transform 0.15s, box-shadow 0.15s, background 0.15s, border-color 0.15s;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          text-decoration: none;
          white-space: nowrap;
        }

        .btn-primary {
          background: #5B4BFF;
          color: #fff;
          font-weight: 700;
          border: none;
          animation: glow 3s ease-in-out infinite;
        }

        .btn-primary:hover {
          background: #4A3BE8;
          transform: translateY(-2px);
          box-shadow: 0 12px 40px rgba(91,75,255,0.5);
        }

        .btn-outline {
          background: transparent;
          color: #fff;
          font-weight: 600;
          border: 1.5px solid rgba(255,255,255,0.2);
        }

        .btn-outline:hover {
          background: rgba(255,255,255,0.07);
          border-color: rgba(255,255,255,0.4);
        }

        .section-label {
          display: inline-flex;
          align-items: center;
          gap: 8px;
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

        .shimmer-text {
          background: linear-gradient(90deg, #fff 0%, #7C6CFF 40%, #fff 60%, #fff 100%);
          background-size: 200% auto;
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          animation: shimmer 4s linear infinite;
        }

        .hero-glow {
          position: absolute;
          border-radius: 50%;
          filter: blur(120px);
          pointer-events: none;
        }

        .nav {
          position: sticky;
          top: 0;
          z-index: 50;
          border-bottom: 1px solid rgba(255,255,255,0.06);
          background: rgba(2,6,23,0.82);
          backdrop-filter: blur(20px);
        }

        .nav-inner {
          min-height: 64px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 14px;
          padding: 10px 0;
        }

        .brand {
          display: flex;
          align-items: center;
          gap: 10px;
          min-width: 0;
        }

        .brand-icon-wrap {
          position: relative;
          width: 36px;
          height: 36px;
          flex: 0 0 auto;
        }

        .brand-icon {
          width: 36px;
          height: 36px;
          border-radius: 10px;
          display: block;
        }

        .brand-name {
          font-weight: 800;
          font-size: 18px;
          color: #fff;
        }

        .nav-actions {
          display: flex;
          gap: 12px;
          align-items: center;
        }

        .nav-actions .btn-primary,
        .nav-actions .btn-outline {
          min-height: 40px;
          padding: 10px 20px;
          font-size: 14px;
        }

        .hero {
          position: relative;
          overflow: hidden;
          padding: 80px 0 100px;
        }

        .hero-grid {
          display: grid;
          grid-template-columns: minmax(0, 1fr) minmax(320px, 1fr);
          gap: 60px;
          align-items: center;
        }

        .hero-title {
          font-size: clamp(36px, 5vw, 58px);
          font-weight: 800;
          line-height: 1.1;
          margin: 24px 0 0;
          letter-spacing: -0.04em;
        }

        .hero-copy {
          font-size: 18px;
          line-height: 1.75;
          color: #94a3b8;
          margin: 24px 0 0;
          max-width: 520px;
        }

        .hero-actions {
          display: flex;
          gap: 12px;
          margin-top: 36px;
          flex-wrap: wrap;
        }

        .hero-stats {
          display: flex;
          gap: 32px;
          margin-top: 40px;
          flex-wrap: wrap;
        }

        .hero-stat-value {
          font-size: 22px;
          font-weight: 800;
          color: #fff;
        }

        .hero-stat-label {
          font-size: 12px;
          color: #64748b;
          margin-top: 2px;
        }

        .mockup-wrap {
          position: relative;
          max-width: 560px;
          justify-self: end;
        }

        .mockup-shell {
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 28px;
          padding: 20px;
          box-shadow: 0 40px 120px rgba(0,0,0,0.6);
        }

        .mockup-card {
          background: #0f172a;
          border-radius: 20px;
          padding: 20px;
        }

        .mockup-head {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 14px;
          margin-bottom: 20px;
        }

        .stat-badge {
          background: rgba(91,75,255,0.15);
          border: 1px solid rgba(91,75,255,0.3);
          border-radius: 12px;
          padding: 8px 14px;
          font-size: 13px;
          font-weight: 600;
          color: #a89fff;
          white-space: nowrap;
        }

        .message-box {
          background: #020617;
          border-radius: 16px;
          padding: 20px;
          font-size: 14px;
          line-height: 1.8;
          color: #cbd5e1;
          margin-bottom: 20px;
        }

        .mockup-info-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 10px;
        }

        .mockup-info {
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.06);
          border-radius: 12px;
          padding: 12px;
          min-width: 0;
        }

        .mockup-info-label {
          font-size: 10px;
          color: #475569;
          text-transform: uppercase;
          letter-spacing: 0.1em;
        }

        .mockup-info-value {
          font-size: 13px;
          font-weight: 600;
          margin-top: 6px;
          overflow-wrap: anywhere;
        }

        .mockup-actions {
          margin-top: 16px;
          display: flex;
          gap: 8px;
        }

        .mockup-main-action {
          flex: 1;
          background: #5B4BFF;
          border-radius: 10px;
          padding: 10px 0;
          text-align: center;
          font-size: 13px;
          font-weight: 700;
          cursor: pointer;
        }

        .mockup-edit-action {
          background: rgba(255,255,255,0.06);
          border-radius: 10px;
          padding: 10px 14px;
          font-size: 13px;
          cursor: pointer;
        }

        .floating-badge {
          position: absolute;
          border-radius: 100px;
          padding: 8px 14px;
          font-size: 12px;
          white-space: nowrap;
        }

        .floating-badge-paid {
          top: -16px;
          right: -16px;
          background: #10b981;
          font-weight: 700;
          box-shadow: 0 4px 20px rgba(16,185,129,0.4);
        }

        .floating-badge-sent {
          bottom: -12px;
          left: -16px;
          background: #0f172a;
          border: 1px solid rgba(255,255,255,0.1);
          font-weight: 600;
          color: #94a3b8;
        }

        .logo-bar {
          border-top: 1px solid rgba(255,255,255,0.06);
          border-bottom: 1px solid rgba(255,255,255,0.06);
          background: rgba(255,255,255,0.02);
          padding: 20px 0;
          overflow: hidden;
        }

        .logo-bar-label {
          font-size: 12px;
          color: #475569;
          text-align: center;
          margin-bottom: 16px;
          letter-spacing: 0.15em;
          text-transform: uppercase;
          font-weight: 600;
          padding: 0 20px;
        }

        .marquee-viewport {
          overflow: hidden;
          width: 100%;
        }

        .marquee-track {
          display: flex;
          width: max-content;
          animation: scroll-left 30s linear infinite;
        }

        .marquee-track:hover {
          animation-play-state: paused;
        }

        .marquee-item {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-right: 48px;
          color: #64748b;
          font-size: 14px;
          font-weight: 500;
          white-space: nowrap;
        }

        .section {
          padding: 100px 0;
        }

        .section-muted {
          background: rgba(255,255,255,0.02);
          border-top: 1px solid rgba(255,255,255,0.06);
          border-bottom: 1px solid rgba(255,255,255,0.06);
        }

        .section-head {
          text-align: center;
          margin-bottom: 64px;
        }

        .section-title {
          font-size: clamp(28px, 4vw, 44px);
          font-weight: 800;
          margin: 20px 0 0;
          line-height: 1.15;
          letter-spacing: -0.035em;
        }

        .section-subtitle {
          color: #64748b;
          margin: 16px 0 0;
          font-size: 17px;
          line-height: 1.6;
        }

        .benefits-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 20px;
        }

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

        .benefit-icon {
          font-size: 36px;
          margin-bottom: 16px;
        }

        .benefit-title {
          font-size: 17px;
          font-weight: 700;
          margin: 0 0 10px;
        }

        .benefit-description {
          font-size: 14px;
          color: #64748b;
          line-height: 1.7;
          margin: 0;
        }

        .steps-grid-wrap {
          position: relative;
        }

        .steps-line {
          position: absolute;
          top: 32px;
          left: 20%;
          right: 20%;
          height: 1px;
          background: linear-gradient(90deg, transparent, rgba(91,75,255,0.3), rgba(91,75,255,0.3), transparent);
          pointer-events: none;
        }

        .steps-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 32px;
        }

        .step-card {
          background: rgba(255,255,255,0.03);
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 24px;
          padding: 32px;
          position: relative;
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

        .step-title {
          font-size: 18px;
          font-weight: 700;
          margin: 16px 0 10px;
        }

        .step-description {
          font-size: 14px;
          color: #64748b;
          line-height: 1.7;
          margin: 0;
        }

        .metrics-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 20px;
        }

        .metric-card {
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 20px;
          padding: 28px;
          text-align: center;
        }

        .metric-value {
          font-size: 36px;
          font-weight: 800;
          color: #5B4BFF;
        }

        .metric-label {
          font-size: 15px;
          font-weight: 700;
          margin-top: 8px;
        }

        .metric-sub {
          font-size: 12px;
          color: #475569;
          margin-top: 4px;
        }

        .testimonials-section {
          padding: 100px 0;
          overflow: hidden;
        }

        .testimonial-card {
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 24px;
          padding: 28px;
          width: 340px;
          flex: 0 0 340px;
          margin-right: 20px;
        }

        .stars {
          color: #f59e0b;
          font-size: 14px;
          letter-spacing: 1px;
        }

        .testimonial-text {
          font-size: 14px;
          color: #cbd5e1;
          line-height: 1.75;
          margin: 14px 0 20px;
        }

        .testimonial-result {
          background: rgba(91,75,255,0.1);
          border: 1px solid rgba(91,75,255,0.2);
          border-radius: 12px;
          padding: 10px 14px;
          margin-bottom: 18px;
        }

        .testimonial-result-value {
          font-size: 20px;
          font-weight: 800;
          color: #7C6CFF;
        }

        .testimonial-result-label {
          font-size: 12px;
          color: #64748b;
          margin-left: 8px;
        }

        .testimonial-user {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .avatar {
          width: 44px;
          height: 44px;
          border-radius: 50%;
          background: linear-gradient(135deg, #5B4BFF, #9c8dff);
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 700;
          font-size: 14px;
          color: #fff;
          flex-shrink: 0;
        }

        .testimonial-name {
          font-size: 14px;
          font-weight: 700;
        }

        .testimonial-role {
          font-size: 12px;
          color: #475569;
        }

        .audience-grid {
          display: grid;
          grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
          gap: 80px;
          align-items: center;
        }

        .audience-title {
          font-size: clamp(28px, 4vw, 40px);
          font-weight: 800;
          margin: 0 0 16px;
          line-height: 1.15;
          letter-spacing: -0.035em;
        }

        .audience-copy {
          color: #64748b;
          font-size: 16px;
          line-height: 1.75;
          margin: 0;
        }

        .audience-pills {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
        }

        .audience-pill {
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 100px;
          padding: 12px 20px;
          font-size: 14px;
          font-weight: 500;
          color: #cbd5e1;
          display: flex;
          align-items: center;
          gap: 10px;
          transition: all 0.2s;
        }

        .audience-pill:hover {
          background: rgba(91,75,255,0.1);
          border-color: rgba(91,75,255,0.3);
          color: #fff;
        }

        .final-cta {
          position: relative;
          overflow: hidden;
          padding: 100px 0;
        }

        .final-cta-inner {
          max-width: 760px;
          margin: 0 auto;
          text-align: center;
          position: relative;
          z-index: 1;
        }

        .online-pill {
          display: inline-flex;
          align-items: center;
          gap: 10px;
          background: rgba(255,255,255,0.05);
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 100px;
          padding: 8px 20px;
          font-size: 13px;
          color: #94a3b8;
          margin-bottom: 32px;
        }

        .online-dot {
          width: 8px;
          height: 8px;
          background: #10b981;
          border-radius: 50%;
          animation: pulse-ring 1.5s ease-out infinite;
        }

        .final-title {
          font-size: clamp(32px, 5vw, 54px);
          font-weight: 800;
          line-height: 1.1;
          margin: 0 0 20px;
          letter-spacing: -0.04em;
        }

        .final-copy {
          color: #64748b;
          font-size: 18px;
          margin: 0 0 40px;
          line-height: 1.6;
        }

        .final-actions {
          display: flex;
          gap: 14px;
          justify-content: center;
          flex-wrap: wrap;
        }

        .final-actions .btn-primary,
        .final-actions .btn-outline {
          font-size: 16px;
          padding: 18px 40px;
        }

        .final-note {
          color: #334155;
          font-size: 13px;
          margin-top: 20px;
        }

        .footer {
          border-top: 1px solid rgba(255,255,255,0.06);
          padding: 40px 0;
        }

        .footer-inner {
          display: flex;
          justify-content: space-between;
          align-items: center;
          flex-wrap: wrap;
          gap: 20px;
        }

        .footer-brand {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .footer-brand img {
          width: 30px;
          height: 30px;
          border-radius: 8px;
        }

        .footer-brand span {
          font-weight: 800;
          font-size: 16px;
        }

        .footer-copy {
          color: #334155;
          font-size: 13px;
        }

        .footer-links {
          display: flex;
          gap: 24px;
        }

        .footer-links a {
          color: #334155;
          font-size: 13px;
          text-decoration: none;
        }

        @media (max-width: 980px) {
          .hero {
            padding: 56px 0 76px;
          }

          .hero-grid {
            grid-template-columns: 1fr;
            gap: 46px;
            text-align: center;
          }

          .hero-copy {
            margin-left: auto;
            margin-right: auto;
          }

          .hero-actions,
          .hero-stats {
            justify-content: center;
          }

          .mockup-wrap {
            justify-self: center;
            width: min(100%, 560px);
          }

          .benefits-grid,
          .steps-grid {
            grid-template-columns: 1fr 1fr;
          }

          .metrics-grid {
            grid-template-columns: 1fr 1fr;
          }

          .audience-grid {
            grid-template-columns: 1fr;
            gap: 32px;
            text-align: center;
          }

          .audience-pills {
            justify-content: center;
          }

          .steps-line {
            display: none;
          }
        }

        @media (max-width: 640px) {
          .container {
            width: min(100% - 32px, 1200px);
          }

          .nav-inner {
            min-height: 62px;
          }

          .brand-name {
            font-size: 16px;
          }

          .brand-icon-wrap,
          .brand-icon {
            width: 32px;
            height: 32px;
          }

          .logo-ring-anim {
            inset: -6px;
            border-radius: 18px;
          }

          .nav-actions {
            gap: 8px;
          }

          .nav-actions .btn-outline {
            display: none;
          }

          .nav-actions .btn-primary {
            min-height: 38px;
            padding: 9px 13px;
            font-size: 12px;
            border-radius: 12px;
          }

          .hero {
            padding: 42px 0 62px;
          }

          .hero-grid {
            gap: 34px;
          }

          .hero-title {
            font-size: clamp(34px, 11vw, 44px);
            line-height: 1.05;
          }

          .hero-copy {
            font-size: 16px;
            line-height: 1.65;
          }

          .section-label {
            font-size: 10px;
            padding: 6px 12px;
            letter-spacing: 0.1em;
          }

          .hero-actions {
            flex-direction: column;
            margin-top: 28px;
          }

          .hero-actions .btn-primary,
          .hero-actions .btn-outline,
          .final-actions .btn-primary,
          .final-actions .btn-outline {
            width: 100%;
            padding: 15px 18px;
          }

          .hero-stats {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 12px;
            margin-top: 30px;
          }

          .hero-stat-value {
            font-size: 18px;
          }

          .hero-stat-label {
            font-size: 10px;
            line-height: 1.35;
          }

          .hero-glow {
            filter: blur(90px);
            opacity: 0.75;
          }

          .card-float {
            animation: none;
          }

          .mockup-shell {
            border-radius: 22px;
            padding: 10px;
          }

          .mockup-card {
            border-radius: 16px;
            padding: 14px;
          }

          .mockup-head {
            align-items: flex-start;
          }

          .mockup-head-title {
            font-size: 16px !important;
          }

          .stat-badge {
            padding: 7px 10px;
            font-size: 11px;
          }

          .message-box {
            padding: 14px;
            font-size: 12.5px;
            line-height: 1.65;
          }

          .mockup-info-grid {
            grid-template-columns: 1fr;
          }

          .mockup-info {
            padding: 10px 12px;
          }

          .floating-badge {
            position: static;
            display: inline-flex;
            margin-top: 10px;
            max-width: 100%;
          }

          .floating-badges-mobile {
            display: flex;
            flex-wrap: wrap;
            gap: 8px;
            justify-content: center;
          }

          .logo-bar {
            padding: 18px 0;
          }

          .logo-bar-label {
            font-size: 10px;
            line-height: 1.5;
          }

          .marquee-track {
            animation-duration: 24s;
          }

          .marquee-item {
            margin-right: 30px;
            font-size: 13px;
          }

          .section,
          .testimonials-section,
          .final-cta {
            padding: 68px 0;
          }

          .section-head {
            margin-bottom: 34px;
          }

          .section-title,
          .audience-title {
            font-size: clamp(26px, 8vw, 34px);
          }

          .section-subtitle {
            font-size: 15px;
          }

          .benefits-grid,
          .steps-grid,
          .metrics-grid {
            grid-template-columns: 1fr;
            gap: 14px;
          }

          .benefit-card,
          .step-card,
          .metric-card {
            padding: 22px;
            border-radius: 20px;
          }

          .benefit-card:hover {
            transform: none;
          }

          .step-number {
            font-size: 42px;
          }

          .metric-value {
            font-size: 30px;
          }

          .testimonial-card {
            width: min(82vw, 320px);
            flex-basis: min(82vw, 320px);
            padding: 22px;
            margin-right: 14px;
          }

          .testimonial-result-value {
            display: block;
            margin-bottom: 3px;
          }

          .testimonial-result-label {
            margin-left: 0;
            display: block;
            line-height: 1.4;
          }

          .audience-pills {
            display: grid;
            grid-template-columns: 1fr;
            gap: 10px;
          }

          .audience-pill {
            justify-content: center;
            padding: 12px 14px;
          }

          .online-pill {
            font-size: 12px;
            padding: 8px 14px;
            margin-bottom: 24px;
          }

          .final-title {
            font-size: clamp(30px, 9vw, 40px);
          }

          .final-copy {
            font-size: 16px;
            margin-bottom: 30px;
          }

          .final-actions {
            flex-direction: column;
          }

          .footer {
            padding: 32px 0;
          }

          .footer-inner {
            justify-content: center;
            text-align: center;
          }

          .footer-links {
            width: 100%;
            justify-content: center;
            gap: 18px;
          }
        }

        @media (max-width: 380px) {
          .container {
            width: min(100% - 24px, 1200px);
          }

          .hero-title {
            font-size: 31px;
          }

          .hero-stats {
            grid-template-columns: 1fr;
          }

          .nav-actions .btn-primary {
            padding: 9px 10px;
          }

          .testimonial-card {
            width: 86vw;
            flex-basis: 86vw;
          }
        }

        @media (prefers-reduced-motion: reduce) {
          *,
          *::before,
          *::after {
            animation-duration: 0.01ms !important;
            animation-iteration-count: 1 !important;
            scroll-behavior: auto !important;
          }
        }
      `}</style>

      <nav className="nav">
        <div className="container nav-inner">
          <div className="brand">
            <div className="brand-icon-wrap">
              <div className="logo-ring-anim" />
              <img src="/icon-lembrei.png" alt="Lembrei" className="brand-icon" />
            </div>
            <span className="brand-name">Lembrei</span>
          </div>

          <div className="nav-actions">
            <a href="/login" className="btn-outline">Entrar</a>
            <a href="/cadastro" className="btn-primary">Começar grátis</a>
          </div>
        </div>
      </nav>

      <section className="hero">
        <div className="hero-glow" style={{ width: 600, height: 600, background: 'rgba(91,75,255,0.25)', top: -200, left: -100 }} />
        <div className="hero-glow" style={{ width: 400, height: 400, background: 'rgba(124,108,255,0.15)', top: 100, right: -100 }} />

        <div className="container hero-grid">
          <div>
            <div className="hero-animate">
              <div className="section-label">
                <span>✦</span> Plataforma de Cobranças
              </div>
            </div>

            <h1 className="hero-title hero-animate-2">
              Cobre com <span className="shimmer-text">profissionalismo.</span>
              <br />
              Receba com mais <span style={{ color: '#5B4BFF' }}>frequência.</span>
            </h1>

            <p className="hero-copy hero-animate-3">
              O Lembrei ajuda autônomos e pequenos negócios a organizar cobranças e enviar mensagens profissionais no WhatsApp — sem constrangimento, sem esquecimento.
            </p>

            <div className="hero-actions hero-animate-4">
              <a href="/cadastro" className="btn-primary">Começar grátis →</a>
              <a href="#como-funciona" className="btn-outline">Ver como funciona</a>
            </div>

            <div className="hero-stats hero-animate-5">
              {[
                { value: '2.400+', label: 'usuários ativos' },
                { value: 'R$12M+', label: 'em cobranças enviadas' },
                { value: '94%', label: 'taxa de recebimento' },
              ].map(m => (
                <div key={m.value}>
                  <div className="hero-stat-value">{m.value}</div>
                  <div className="hero-stat-label">{m.label}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="mockup-wrap card-float">
            <div className="mockup-shell">
              <div className="mockup-card">
                <div className="mockup-head">
                  <div>
                    <div style={{ fontSize: 12, color: '#64748b' }}>Cobrança gerada</div>
                    <div className="mockup-head-title" style={{ fontSize: 18, fontWeight: 700 }}>Mensagem profissional</div>
                  </div>
                  <div className="stat-badge">WhatsApp ✓</div>
                </div>

                <div className="message-box">
                  <p style={{ margin: 0 }}>Olá <strong style={{ color: '#fff' }}>Maria</strong>,</p>
                  <p style={{ margin: '12px 0 0' }}>Identificamos um pagamento pendente referente a <strong style={{ color: '#fff' }}>Criação de logo</strong>, no valor de <strong style={{ color: '#5B4BFF' }}>R$ 350,00</strong>, com vencimento em <strong style={{ color: '#fff' }}>24/04/2026</strong>.</p>
                  <p style={{ margin: '12px 0 0', color: '#94a3b8' }}>Ficamos à disposição para qualquer dúvida.</p>
                </div>

                <div className="mockup-info-grid">
                  {[
                    { label: 'Cliente', value: 'Maria Souza' },
                    { label: 'Valor', value: 'R$ 350,00' },
                    { label: 'Status', value: '⏳ Pendente' },
                  ].map(item => (
                    <div key={item.label} className="mockup-info">
                      <div className="mockup-info-label">{item.label}</div>
                      <div className="mockup-info-value">{item.value}</div>
                    </div>
                  ))}
                </div>

                <div className="mockup-actions">
                  <div className="mockup-main-action">Abrir no WhatsApp</div>
                  <div className="mockup-edit-action">✏️</div>
                </div>
              </div>
            </div>

            <div className="floating-badges-mobile">
              <div className="floating-badge floating-badge-paid">✓ Pago! R$ 350,00</div>
              <div className="floating-badge floating-badge-sent">📲 3 cobranças enviadas hoje</div>
            </div>
          </div>
        </div>
      </section>

      <div className="logo-bar">
        <div className="logo-bar-label">Confiado por autônomos em todo o Brasil</div>
        <div className="marquee-viewport">
          <div className="marquee-track">
            {[...audiences, ...audiences].map((a, i) => (
              <div key={i} className="marquee-item">
                <span>{a.icon}</span> {a.label}
              </div>
            ))}
          </div>
        </div>
      </div>

      <section className="section">
        <div className="container">
          <div className="section-head">
            <div className="section-label">Benefícios</div>
            <h2 className="section-title">
              Tudo que você precisa para<br />cobrar com confiança
            </h2>
            <p className="section-subtitle">Simples, direto, sem complicação.</p>
          </div>

          <div className="benefits-grid">
            {benefits.map((b) => (
              <div key={b.title} className="benefit-card">
                <div className="benefit-icon">{b.icon}</div>
                <h3 className="benefit-title">{b.title}</h3>
                <p className="benefit-description">{b.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="como-funciona" className="section section-muted">
        <div className="container">
          <div className="section-head">
            <div className="section-label">Como funciona</div>
            <h2 className="section-title">Em 3 passos você já está cobrando</h2>
          </div>

          <div className="steps-grid-wrap">
            <div className="steps-line" />
            <div className="steps-grid">
              {steps.map((step) => (
                <div key={step.number} className="step-card">
                  <div className="step-number">{step.number}</div>
                  <h3 className="step-title">{step.title}</h3>
                  <p className="step-description">{step.description}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="container metrics-grid">
          {[
            { value: '2.400+', label: 'Usuários ativos', sub: 'em todo o Brasil' },
            { value: 'R$12M+', label: 'Em cobranças', sub: 'geradas na plataforma' },
            { value: '94%', label: 'Taxa de recebimento', sub: 'média dos usuários' },
            { value: '-61%', label: 'Menos inadimplência', sub: 'após 60 dias de uso' },
          ].map(m => (
            <div key={m.value} className="metric-card">
              <div className="metric-value">{m.value}</div>
              <div className="metric-label">{m.label}</div>
              <div className="metric-sub">{m.sub}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="testimonials-section section-muted">
        <div className="container" style={{ marginBottom: 56 }}>
          <div className="section-head" style={{ marginBottom: 0 }}>
            <div className="section-label">Depoimentos</div>
            <h2 className="section-title">Quem usa, recomenda</h2>
            <p className="section-subtitle">Veja o que nossos usuários estão falando sobre o Lembrei</p>
          </div>
        </div>

        <div className="marquee-viewport">
          <div className="marquee-track" style={{ animationDuration: '40s' }}>
            {[...testimonials, ...testimonials].map((t, i) => (
              <div key={i} className="testimonial-card">
                <div className="stars">★★★★★</div>
                <p className="testimonial-text">"{t.text}"</p>
                <div className="testimonial-result">
                  <span className="testimonial-result-value">{t.value}</span>
                  <span className="testimonial-result-label">{t.label}</span>
                </div>
                <div className="testimonial-user">
                  <div className="avatar">{t.avatar}</div>
                  <div>
                    <div className="testimonial-name">{t.name}</div>
                    <div className="testimonial-role">{t.role}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="section">
        <div className="container audience-grid">
          <div>
            <div className="section-label" style={{ marginBottom: 20 }}>Para quem é</div>
            <h2 className="audience-title">Feito para quem presta serviço e precisa receber</h2>
            <p className="audience-copy">Se você tem clientes, emite cobranças e usa o WhatsApp, o Lembrei foi feito para você.</p>
          </div>

          <div className="audience-pills">
            {audiences.map((a) => (
              <div key={a.label} className="audience-pill">
                <span>{a.icon}</span> {a.label}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="final-cta">
        <div className="hero-glow" style={{ width: 600, height: 400, background: 'rgba(91,75,255,0.2)', top: '50%', left: '50%', transform: 'translate(-50%,-50%)' }} />
        <div className="container">
          <div className="final-cta-inner">
            <div className="online-pill">
              <div className="online-dot" />
              Mais de 2.400 usuários ativos agora
            </div>

            <h2 className="final-title">
              Chega de cobrar com vergonha.<br />
              <span style={{ color: '#5B4BFF' }}>Comece a receber de verdade.</span>
            </h2>

            <p className="final-copy">Crie sua conta grátis e envie sua primeira cobrança em menos de 5 minutos.</p>

            <div className="final-actions">
              <a href="/cadastro" className="btn-primary">Criar minha conta grátis →</a>
              <a href="/login" className="btn-outline">Já tenho conta</a>
            </div>

            <p className="final-note">Sem cartão de crédito • Sem compromisso</p>
          </div>
        </div>
      </section>

      <footer className="footer">
        <div className="container footer-inner">
          <div className="footer-brand">
            <img src="/icon-lembrei.png" alt="Lembrei" />
            <span>Lembrei</span>
          </div>

          <div className="footer-copy">
            © {new Date().getFullYear()} Lembrei. Feito para autônomos brasileiros.
          </div>

              <div className="footer-links">
  <Link to="/termos">Termos</Link>
  <Link to="/privacidade">Privacidade</Link>
  <Link to="/contato">Contato</Link>
</div>
        </div>
      </footer>
    </div>
  )
}
