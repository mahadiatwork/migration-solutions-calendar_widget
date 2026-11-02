import { getActiveUsersFromResponse } from "./zohoUserService";

describe("getActiveUsersFromResponse", () => {
  const activeUser = { id: "1", full_name: "Active User", status: "active" };
  const inactiveUser = {
    id: "2",
    full_name: "Inactive User",
    status: "inactive",
  };

  test("reads users from the wrapped SDK response", () => {
    expect(
      getActiveUsersFromResponse({
        data: { users: [activeUser, inactiveUser] },
        $responseHeaders: {},
      })
    ).toEqual([activeUser]);
  });

  test("supports legacy and standard record response shapes", () => {
    expect(getActiveUsersFromResponse({ users: [activeUser] })).toEqual([
      activeUser,
    ]);
    expect(getActiveUsersFromResponse({ data: [activeUser] })).toEqual([
      activeUser,
    ]);
  });

  test("returns an empty array for a missing or malformed response", () => {
    expect(getActiveUsersFromResponse(undefined)).toEqual([]);
    expect(getActiveUsersFromResponse({ data: {} })).toEqual([]);
  });
});
