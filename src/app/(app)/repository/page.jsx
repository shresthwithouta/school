import { requireUser } from "@/lib/session";
import { isOwner } from "@/lib/rbac";
import { listRepositoryFiles } from "@/lib/repository";
import { listVisibleUsers } from "@/lib/users";
import { RepositoryClient } from "@/components/repository/repository-client";

export const metadata = { title: "Repository" };

export default async function RepositoryPage() {
  const user = await requireUser();
  const chairman = isOwner(user.role);

  const files = await listRepositoryFiles(user);
  // The Chairman shares with anyone — load the people list only for them.
  const people = chairman
    ? (await listVisibleUsers(user))
        .filter((u) => u.id !== user.id)
        .map((u) => ({ id: u.id, name: u.name, role: u.role }))
    : [];

  return (
    <RepositoryClient
      files={files}
      people={people}
      isChairman={chairman}
    />
  );
}
