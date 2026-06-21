import { getCloudflareContext } from "@opennextjs/cloudflare";

export default function Home() {
  const env = getCloudflareContext().env;
  // const owner = (env.GITHUB_OWNER as string) ?? "—";
  // const repo = (env.GITHUB_REPO as string) ?? "—";

  return (
    <div className="font-sans min-h-screen flex items-center justify-center p-8">
      <main className="flex flex-col gap-4 items-center text-center">
        <h1 className="text-2xl font-bold">Maven Proxy</h1>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Personal Maven repository.
        </p>
      </main>
    </div>
  );
}
