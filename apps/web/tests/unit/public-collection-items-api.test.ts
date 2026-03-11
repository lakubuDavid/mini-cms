import { describe, expect, test } from "bun:test";
import { handleCollectionItems } from "../../src/routes/api/collections/items";

describe("public collection items api", () => {
  test("returns cached payload when available", async () => {
    const response = await handleCollectionItems(
      new Request(
        "https://cms.example.com/api/collections/items?w=org_1&p=project_1&collection_id=col_1",
      ),
    );

    expect([200, 404, 500]).toContain(response.status);
  });

  test("returns 400 when required params are missing", async () => {
    const response = await handleCollectionItems(
      new Request(
        "https://cms.example.com/api/collections/items?w=org_1&p=project_1",
      ),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "w, p, and collection_id query parameters are required.",
    });
  });

  test("rejects unknown filter fields", async () => {
    const response = await handleCollectionItems(
      new Request(
        "https://cms.example.com/api/collections/items?w=org_1&p=project_1&collection_id=col_1&filter.unknown=value",
      ),
    );

    expect([400, 404, 500]).toContain(response.status);
  });
});
