export default function AcessoNegadoPage() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', gap: 24 }}>
      <h1 style={{ fontSize: 32, color: '#e53e3e', marginBottom: 16 }}>Acesso Negado</h1>
      <p style={{ fontSize: 18, color: '#555' }}>
        Você não tem permissão para acessar esta página.<br />
        Caso acredite que isso é um erro, entre em contato com o administrador do sistema.
      </p>
      <a href="/" style={{ marginTop: 32, color: '#3182ce', fontWeight: 500, fontSize: 18 }}>Voltar para o início</a>
    </div>
  );
}
