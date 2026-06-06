import { useEffect, useState } from 'react'
import type { ServiceDescriptor } from '@shared/types'
import { Sidebar } from './components/Sidebar'
import { ServicePanel } from './components/ServicePanel'
import { ViewerPanel } from './components/ViewerPanel'
import { SettingsPanel } from './components/SettingsPanel'

export type View = { kind: 'service'; serviceId: string } | { kind: 'viewer' } | { kind: 'settings' }

export function App(): JSX.Element {
  const [services, setServices] = useState<ServiceDescriptor[]>([])
  const [view, setView] = useState<View>({ kind: 'viewer' })

  useEffect(() => {
    void window.api['services:list']().then((list) => {
      setServices(list)
      if (list.length > 0) setView({ kind: 'service', serviceId: list[0].id })
    })
  }, [])

  return (
    <div className="app">
      <Sidebar services={services} view={view} onNavigate={setView} />
      <main className="content">
        {view.kind === 'service' && (
          <ServicePanel
            key={view.serviceId}
            service={services.find((s) => s.id === view.serviceId)!}
          />
        )}
        {view.kind === 'viewer' && <ViewerPanel />}
        {view.kind === 'settings' && <SettingsPanel />}
      </main>
    </div>
  )
}
