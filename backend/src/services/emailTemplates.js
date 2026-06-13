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
};
