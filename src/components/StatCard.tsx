type Props = {
  title: string;
  value: string;
};

export default function StatCard({
  title,
  value,
}: Props) {
  return (
    <div className="stat-card">
      <p>{title}</p>
      <strong>{value}</strong>
    </div>
  );
}
