import { Outlet, createFileRoute, redirect } from "@tanstack/react-router";
import { getActiveOrganization } from "@/lib/auth-helpers";
import { getProjectServerFn } from "@/lib/projects-helpers";

export const Route = createFileRoute("/dashboard/projects/$projectId")({
  beforeLoad: async ({ params }) => {
    const organization = await getActiveOrganization();

    if (!organization) {
      throw redirect({ to: "/dashboard", search: { projectId: undefined } });
    }

    const project = await getProjectServerFn({ data: { id: params.projectId } });

    if (!project) {
      throw redirect({
        to: "/dashboard/projects",
        search: {
          page: 1,
          pageSize: 25,
          q: undefined,
          sort: undefined,
          order: undefined,
        },
      });
    }
  },
  component: () => <Outlet />,
});
