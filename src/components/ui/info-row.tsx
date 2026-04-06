interface InfoRowProps {
  label: string
  value: React.ReactNode
  mono?: boolean
}

export function InfoRow({ label, value, mono }: InfoRowProps) {
  return (
    <div className="space-y-1">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <div className={`text-sm font-medium ${mono ? 'font-mono' : ''}`}>{value}</div>
    </div>
  )
}
