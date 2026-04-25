type ReminderBannerProps = {
  message: string
}

function ReminderBanner({ message }: ReminderBannerProps): React.JSX.Element {
  return (
    <section className="card reminder">
      <h2>Reminder</h2>
      <p aria-live="polite">{message}</p>
    </section>
  )
}

export default ReminderBanner
