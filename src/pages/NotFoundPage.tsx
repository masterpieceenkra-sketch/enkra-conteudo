import { Link } from 'react-router'
import { PageHeader } from '../components/PageHeader'

export function NotFoundPage() {
  return (
    <>
      <PageHeader kicker="404" title="Página não encontrada">
        Esse endereço não existe no GPS.
      </PageHeader>
      <Link to="/" className="btn-primary">
        Voltar ao painel
      </Link>
    </>
  )
}
