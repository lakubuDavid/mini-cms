import { createAccessControl } from "better-auth/plugins/access";
import {
  adminAc,
  defaultStatements as adminStatements,
} from "better-auth/plugins/admin/access";
import {
  adminAc as organizationAdminAc,
  defaultStatements as organizationStatements,
  memberAc,
  ownerAc,
} from "better-auth/plugins/organization/access";

export const statements = {
  ...adminStatements,
  ...organizationStatements,
  apiKey: ["create", "read", "update", "delete"],
} as const;

export const ac = createAccessControl(statements);

export const reviewer = ac.newRole({
  organization: [],
  member: [],
  invitation: [],
  team: [],
  apiKey: [],
  ac: ["read"],
  user: ["get", "list"],
  session: ["list"],
});

export const adminRole = ac.newRole({
  ...adminAc.statements,
  ...organizationAdminAc.statements,
  apiKey: ["create", "read", "update", "delete"],
});

export const ownerRole = ac.newRole({
  ...adminAc.statements,
  ...ownerAc.statements,
  apiKey: ["create", "read", "update", "delete"],
});

export const memberRole = ac.newRole({
  ...memberAc.statements,
  apiKey: [],
});
