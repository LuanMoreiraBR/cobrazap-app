export const clients = [
  {
    id: 1,
    name: 'Maria Souza',
    phone: '11999999999',
    notes: 'Prefere contato à tarde',
  },
  {
    id: 2,
    name: 'João Lima',
    phone: '21988888888',
    notes: 'Cliente recorrente',
  },
  {
    id: 3,
    name: 'Ana Costa',
    phone: '31977777777',
    notes: 'Paga normalmente no vencimento',
  },
]

export const charges = [
  {
    id: 1,
    clientId: 1,
    clientName: 'Maria Souza',
    description: 'Criação de logo',
    amount: 350,
    dueDate: '2026-04-24',
    status: 'pendente',
  },
  {
    id: 2,
    clientId: 2,
    clientName: 'João Lima',
    description: 'Gestão de Instagram',
    amount: 600,
    dueDate: '2026-04-20',
    status: 'atrasado',
  },
  {
    id: 3,
    clientId: 3,
    clientName: 'Ana Costa',
    description: 'Consultoria mensal',
    amount: 500,
    dueDate: '2026-04-18',
    status: 'pago',
  },
]