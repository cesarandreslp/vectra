import { RestablecerForm } from '../_components/reset-forms'

export const metadata = { title: 'Nueva contraseña' }

export default async function RestablecerPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams
  return <RestablecerForm token={token ?? ''} />
}
