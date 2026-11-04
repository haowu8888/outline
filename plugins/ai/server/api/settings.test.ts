import { AISetting } from "@server/models";
import { buildAdmin, buildUser } from "@server/test/factories";
import { getTestServer } from "@server/test/support";

const server = getTestServer();

describe("#ai.settings", () => {
  it("should require an admin", async () => {
    const user = await buildUser();
    const res = await server.post("/api/ai.settings.update", {
      body: {
        token: user.getJwtToken(),
        baseUrl: "https://api.example.com/v1",
      },
    });
    expect(res.status).toEqual(403);
  });

  it("should save settings, encrypt the key and never return it", async () => {
    const admin = await buildAdmin();
    const res = await server.post("/api/ai.settings.update", {
      body: {
        token: admin.getJwtToken(),
        baseUrl: "https://api.example.com/v1",
        model: "test-model",
        apiKey: "sk-secret",
      },
    });
    const body = await res.json();
    expect(res.status).toEqual(200);
    expect(body.data.hasApiKey).toEqual(true);
    expect(JSON.stringify(body)).not.toContain("sk-secret");

    const setting = await AISetting.findOne({
      where: { teamId: admin.teamId },
    });
    expect(setting?.apiKey).toEqual("sk-secret");
    expect(String(setting?.getDataValue("apiKey"))).not.toContain("sk-secret");

    const info = await server.post("/api/ai.settings.info", {
      body: { token: admin.getJwtToken() },
    });
    const infoBody = await info.json();
    expect(infoBody.data.model).toEqual("test-model");
    expect(JSON.stringify(infoBody)).not.toContain("sk-secret");
  });

  it("should report availability to members and take effect immediately", async () => {
    const admin = await buildAdmin();
    const member = await buildUser({ teamId: admin.teamId });
    const config = () =>
      server
        .post("/api/ai.config", { body: { token: member.getJwtToken() } })
        .then((res) => res.json());

    expect((await config()).data.enabled).toEqual(false);

    await server.post("/api/ai.settings.update", {
      body: {
        token: admin.getJwtToken(),
        baseUrl: "https://api.example.com/v1",
        apiKey: "sk-secret",
      },
    });
    expect((await config()).data.enabled).toEqual(true);

    await server.post("/api/ai.settings.update", {
      body: { token: admin.getJwtToken(), enabled: false },
    });
    expect((await config()).data.enabled).toEqual(false);

    const write = await server.post("/api/ai.write", {
      body: { token: member.getJwtToken(), action: "polish", text: "hello" },
    });
    expect(write.status).toEqual(400);
  });

  it("should keep the key when not provided and remove it with null", async () => {
    const admin = await buildAdmin();
    const update = (body: Record<string, unknown>) =>
      server
        .post("/api/ai.settings.update", {
          body: { token: admin.getJwtToken(), ...body },
        })
        .then((res) => res.json());

    await update({ baseUrl: "https://api.example.com/v1", apiKey: "sk-1" });
    expect((await update({ model: "other" })).data.hasApiKey).toEqual(true);
    expect((await update({ apiKey: null })).data.hasApiKey).toEqual(false);
  });
});
