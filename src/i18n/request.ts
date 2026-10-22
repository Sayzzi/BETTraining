import { getRequestConfig } from "next-intl/server";

// French only for now; messages are externalised so English can be added later.
export default getRequestConfig(async () => ({
  locale: "fr",
  messages: (await import("../../messages/fr.json")).default,
}));
