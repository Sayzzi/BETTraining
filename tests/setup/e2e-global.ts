import resetTestDatabase from "./integration-global";

// Same reset as the integration suite: a clean, migrated test database.
export default async function setup() {
  await resetTestDatabase();
}
