import { auth } from '@/server/auth';

export default async function DashboardPage() {
  const session = await auth();
  return (
    <div>
      <h1 className="text-2xl font-bold mb-2">Overview</h1>
      <p className="text-gray-400">
        Welcome, {session?.user.name ?? session?.user.email}
      </p>
      <p className="text-sm text-gray-500 mt-1">
        Organisation: <span className="text-gray-300">{session?.user.orgSlug}</span>
      </p>
    </div>
  );
}
