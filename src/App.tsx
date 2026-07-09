import './styles.css'

export function App() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="text-center space-y-4 p-8">
        <img src="/logo.png" alt="Beauty SaaS" className="h-16 mx-auto" />
        <h1 className="text-3xl font-bold text-foreground">Beauty SaaS</h1>
        <p className="text-muted-foreground max-w-md">
          This project uses the private <code className="font-mono text-sm bg-muted px-1 py-0.5 rounded">@fayz-ai</code> SDK
          which must be run inside the FayaLabs monorepo. The app is fully functional when run locally with the SDK packages available.
        </p>
        <div className="text-sm text-muted-foreground">
          Logged in users: dra.silvaniamaia@gmail.com · maia.silvio.rj@gmail.com
        </div>
      </div>
    </div>
  )
}
