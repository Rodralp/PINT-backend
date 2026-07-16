const baseStyle = `
  font-family: Arial, Helvetica, sans-serif;
  max-width: 600px;
  margin: 0 auto;
  padding: 20px;
  color: #333;
`;

const headerStyle = `
  background-color: #2563eb;
  color: #fff;
  padding: 20px;
  text-align: center;
  border-radius: 8px 8px 0 0;
`;

const bodyStyle = `
  background-color: #f9fafb;
  padding: 24px;
  border: 1px solid #e5e7eb;
  border-radius: 0 0 8px 8px;
`;

const buttonStyle = `
  display: inline-block;
  background-color: #2563eb;
  color: #fff;
  text-decoration: none;
  padding: 12px 24px;
  border-radius: 6px;
  font-weight: bold;
  margin-top: 16px;
`;

const footerStyle = `
  text-align: center;
  font-size: 12px;
  color: #9ca3af;
  margin-top: 24px;
`;

const wrapTemplate = (title, content) => `
  <div style="${baseStyle}">
    <div style="${headerStyle}">
      <h1 style="margin:0;font-size:20px;">${title}</h1>
    </div>
    <div style="${bodyStyle}">
      ${content}
    </div>
    <div style="${footerStyle}">
      <p>Este e um email automático. Por favor, nao responda.</p>
    </div>
  </div>
`;

export const emailTemplates = {
  registrationApproved: ({ userName }) =>
    wrapTemplate('Conta Aprovada', `
      <p>Ola <strong>${userName}</strong>,</p>
      <p>A sua conta foi aprovada e ja pode aceder a plataforma.</p>
      <p>
        <a href="${process.env.FRONTEND_URL || 'http://localhost:5173'}/entrar"
           style="${buttonStyle}">
          Iniciar Sessao
        </a>
      </p>
      <p>Se tiver alguma duvida, contacte o administrador.</p>
    `),

  requestSubmittedToTM: ({ userName, badgeName }) =>
    wrapTemplate('Pedido Enviado', `
      <p>Ola <strong>${userName}</strong>,</p>
      <p>O seu pedido da badge <strong>${badgeName}</strong> foi submetido com sucesso e esta agora a ser revisto pelo Talent Manager.</p>
      <p>Recebera uma notificacao quando houver uma decisao sobre o seu pedido.</p>
    `),

  requestApproved: ({ userName, badgeName }) =>
    wrapTemplate('Pedido Aprovado', `
      <p>Ola <strong>${userName}</strong>,</p>
      <p>O seu pedido da badge <strong>${badgeName}</strong> foi <strong style="color:#16a34a;">aprovado</strong>.</p>
      <p>A badge ja esta disponivel no seu perfil.</p>
    `),

  requestRejected: ({ userName, badgeName, comment }) =>
    wrapTemplate('Pedido Rejeitado', `
      <p>Ola <strong>${userName}</strong>,</p>
      <p>O seu pedido da badge <strong>${badgeName}</strong> foi <strong style="color:#dc2626;">rejeitado</strong>.</p>
      ${comment ? '<p><strong>Motivo:</strong> ' + comment + '</p>' : ''}
      <p>Se tiver duvidas, contacte o seu Talent Manager ou Service Line Leader.</p>
    `),

  requestSubmittedToManager: ({ managerName, consultorName, badgeName }) =>
    wrapTemplate('Novo Pedido de Badge', `
      <p>Ola <strong>${managerName}</strong>,</p>
      <p>O consultor <strong>${consultorName}</strong> submeteu um novo pedido da badge <strong>${badgeName}</strong>.</p>
      <p>Pode rever o pedido na plataforma na secao de gestao de pedidos.</p>
      <p>
        <a href="${process.env.FRONTEND_URL || 'http://localhost:5173'}/talent-manager/gestao-pedidos"
           style="${buttonStyle}">
          Reverter Pedido
        </a>
      </p>
    `),

  requestApprovedForwardedToSLL: ({ sllName, consultorName, badgeName }) =>
    wrapTemplate('Pedido Encaminhado para Validacao', `
      <p>Ola <strong>${sllName}</strong>,</p>
      <p>O pedido da badge <strong>${badgeName}</strong> do consultor <strong>${consultorName}</strong> foi aprovado pelo Talent Manager e aguarda a sua validacao.</p>
      <p>
        <a href="${process.env.FRONTEND_URL || 'http://localhost:5173'}/service-line-leader/gestao-pedidos"
           style="${buttonStyle}">
          Reverter Pedido
        </a>
      </p>
    `),

  managerApprovalConfirmation: ({ managerName, consultorName, badgeName }) =>
    wrapTemplate('Aprovacao Registada', `
      <p>Ola <strong>${managerName}</strong>,</p>
      <p>A sua aprovacao do pedido da badge <strong>${badgeName}</strong> do consultor <strong>${consultorName}</strong> foi registada com sucesso.</p>
      <p>O pedido foi encaminhado para o Service Line Leader para validacao final.</p>
    `),

  sllApprovalConfirmation: ({ sllName, consultorName, badgeName }) =>
    wrapTemplate('Aprovacao Registada', `
      <p>Ola <strong>${sllName}</strong>,</p>
      <p>A sua aprovacao do pedido da badge <strong>${badgeName}</strong> do consultor <strong>${consultorName}</strong> foi registada com sucesso.</p>
      <p>A badge foi atribuida ao consultor e esta disponivel no perfil dele.</p>
    `),

  managerRejectionConfirmation: ({ managerName, consultorName, badgeName }) =>
    wrapTemplate('Rejeicao Registada', `
      <p>Ola <strong>${managerName}</strong>,</p>
      <p>A sua rejeicao do pedido da badge <strong>${badgeName}</strong> do consultor <strong>${consultorName}</strong> foi registada com sucesso.</p>
      <p>O consultor foi notificado da decisao.</p>
    `),

  sllRejectionConfirmation: ({ sllName, consultorName, badgeName }) =>
    wrapTemplate('Rejeicao Registada', `
      <p>Ola <strong>${sllName}</strong>,</p>
      <p>A sua rejeicao do pedido da badge <strong>${badgeName}</strong> do consultor <strong>${consultorName}</strong> foi registada com sucesso.</p>
      <p>O consultor foi notificado da decisao.</p>
    `),

  registrationReceived: ({ userName }) =>
    wrapTemplate('Registo Recebido', `
      <p>Ola <strong>${userName}</strong>,</p>
      <p>O seu registo foi recebido com sucesso e esta pendente de aprovacao pelo administrador.</p>
      <p>Recebera uma notificacao assim que a sua conta for aprovada.</p>
      <p>
        <a href="${process.env.FRONTEND_URL || 'http://localhost:5173'}/entrar"
           style="${buttonStyle}">
          Ver Plataforma
        </a>
      </p>
    `),

  newRegistrationPending: ({ adminName, userName, userEmail }) =>
    wrapTemplate('Novo Registo Pendente', `
      <p>Ola <strong>${adminName}</strong>,</p>
      <p>Um novo utilizador registou-se na plataforma e aguarda a sua aprovacao.</p>
      <p><strong>Nome:</strong> ${userName}</p>
      <p><strong>Email:</strong> ${userEmail}</p>
      <p>
        <a href="${process.env.FRONTEND_URL || 'http://localhost:5173'}/admin/gestao-utilizadores"
           style="${buttonStyle}">
          Gerir Utilizadores
        </a>
      </p>
    `),
};
